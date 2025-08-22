import { prisma } from '../../../lib/prisma';
import { trackstarClient, TrackstarFilters } from './client';
import { logger } from '../../utils/logger';
import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../../lib/redis';

export class TrackstarIntegrationService {
  private syncQueue: Queue;
  private webhookQueue: Queue;

  constructor() {
    this.syncQueue = new Queue('trackstar:sync', { connection: redis });
    this.webhookQueue = new Queue('trackstar:webhook', { connection: redis });
    
    this.setupWorkers();
  }

  private setupWorkers() {
    // Sync worker
    new Worker('trackstar:sync', async (job: Job) => {
      await this.processSyncJob(job);
    }, { connection: redis });

    // Webhook worker
    new Worker('trackstar:webhook', async (job: Job) => {
      await this.processWebhookJob(job);
    }, { connection: redis });
  }

  async createLinkToken(brandId: string, customerId?: string): Promise<{ linkToken: string }> {
    try {
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        include: { threepl: true }
      });

      if (!brand) {
        throw new Error('Brand not found');
      }

      const request = {
        customer_id: customerId || brand.threepl.slug,
        integration_name: `${brand.name} - ${brand.threepl.name}`
      };

      const response = await trackstarClient.createLinkToken(request);
      return { linkToken: response.link_token };
    } catch (error) {
      logger.error('Failed to create link token:', error);
      throw error;
    }
  }

  async exchangeAuthCode(brandId: string, authCode: string, customerId?: string): Promise<void> {
    try {
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        include: { threepl: true }
      });

      if (!brand) {
        throw new Error('Brand not found');
      }

      const request = {
        auth_code: authCode,
        customer_id: customerId || brand.threepl.slug
      };

      const response = await trackstarClient.exchangeAuthCode(request);

      // Store integration details
      await prisma.brandIntegration.upsert({
        where: {
          brandId_provider: {
            brandId,
            provider: 'TRACKSTAR'
          }
        },
        update: {
          accessToken: response.access_token,
          connectionId: response.connection_id,
          integrationName: response.integration_name,
          availableActions: response.available_actions,
          status: 'ACTIVE',
          lastSyncedAt: null,
          lastWebhookAt: null
        },
        create: {
          brandId,
          provider: 'TRACKSTAR',
          accessToken: response.access_token,
          connectionId: response.connection_id,
          integrationName: response.integration_name,
          availableActions: response.available_actions,
          status: 'ACTIVE'
        }
      });

      // Kick off initial backfill
      await this.queueInitialBackfill(brandId, response.access_token);
    } catch (error) {
      logger.error('Failed to exchange auth code:', error);
      throw error;
    }
  }

  private async queueInitialBackfill(brandId: string, accessToken: string): Promise<void> {
    const functions = ['get_products', 'get_inventory', 'get_orders', 'get_shipments'];
    
    for (const func of functions) {
      await this.syncQueue.add('initial-backfill', {
        brandId,
        accessToken,
        function: func,
        type: 'initial'
      }, {
        delay: 5000, // 5 second delay to ensure integration is ready
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      });
    }
  }

  async processSyncJob(job: Job): Promise<void> {
    const { brandId, accessToken, function: func, type } = job.data;

    try {
      logger.info(`Processing sync job for brand ${brandId}, function: ${func}, type: ${type}`);

      switch (func) {
        case 'get_products':
          await this.syncProducts(brandId, accessToken, type === 'initial');
          break;
        case 'get_inventory':
          await this.syncInventory(brandId, accessToken, type === 'initial');
          break;
        case 'get_orders':
          await this.syncOrders(brandId, accessToken, type === 'initial');
          break;
        case 'get_shipments':
          await this.syncShipments(brandId, accessToken, type === 'initial');
          break;
        default:
          logger.warn(`Unknown sync function: ${func}`);
      }

      // Update last synced timestamp
      await prisma.brandIntegration.update({
        where: { brandId_provider: { brandId, provider: 'TRACKSTAR' } },
        data: { lastSyncedAt: new Date() }
      });

      logger.info(`Sync job completed for brand ${brandId}, function: ${func}`);
    } catch (error) {
      logger.error(`Sync job failed for brand ${brandId}, function: ${func}:`, error);
      throw error;
    }
  }

  private async syncProducts(brandId: string, accessToken: string, isInitial: boolean): Promise<void> {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: { threepl: true }
    });

    if (!brand) return;

    const filters: TrackstarFilters = {
      limit: 1000
    };

    if (!isInitial) {
      // For incremental sync, get products updated since last sync
      const integration = await prisma.brandIntegration.findUnique({
        where: { brandId_provider: { brandId, provider: 'TRACKSTAR' } }
      });
      
      if (integration?.lastSyncedAt) {
        filters.updated_date = {
          gte: new Date(integration.lastSyncedAt.getTime() - 2 * 60 * 1000).toISOString() // 2 minute overlap
        };
      }
    }

    await trackstarClient.paginate('/wms/products', accessToken, filters, async (products, pageNumber) => {
      for (const product of products) {
        await prisma.product.upsert({
          where: {
            brandId_externalId: {
              brandId,
              externalId: product.id
            }
          },
          update: {
            sku: product.sku || product.id,
            name: product.name || product.title || 'Unknown Product',
            description: product.description,
            category: product.category,
            price: product.price,
            cost: product.cost,
            weight: product.weight,
            dimensions: product.dimensions,
            rawData: product,
            updatedAt: new Date()
          },
          create: {
            threeplId: brand.threeplId,
            brandId,
            externalId: product.id,
            sku: product.sku || product.id,
            name: product.name || product.title || 'Unknown Product',
            description: product.description,
            category: product.category,
            price: product.price,
            cost: product.cost,
            weight: product.weight,
            dimensions: product.dimensions,
            rawData: product
          }
        });
      }
    });
  }

  private async syncInventory(brandId: string, accessToken: string, isInitial: boolean): Promise<void> {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: { threepl: true }
    });

    if (!brand) return;

    const filters: TrackstarFilters = {
      limit: 1000
    };

    if (!isInitial) {
      const integration = await prisma.brandIntegration.findUnique({
        where: { brandId_provider: { brandId, provider: 'TRACKSTAR' } }
      });
      
      if (integration?.lastSyncedAt) {
        filters.updated_date = {
          gte: new Date(integration.lastSyncedAt.getTime() - 2 * 60 * 1000).toISOString()
        };
      }
    }

    await trackstarClient.paginate('/wms/inventory', accessToken, filters, async (inventoryItems, pageNumber) => {
      for (const item of inventoryItems) {
        // Find or create product first
        const product = await prisma.product.findUnique({
          where: {
            brandId_externalId: {
              brandId,
              externalId: item.product_id
            }
          }
        });

        if (product) {
          await prisma.inventorySnapshot.create({
            data: {
              threeplId: brand.threeplId,
              brandId,
              productId: product.id,
              quantityFulfillable: item.quantity_fulfillable || 0,
              quantityOnHand: item.quantity_on_hand || 0,
              location: item.location,
              rawData: item
            }
          });
        }
      }
    });
  }

  private async syncOrders(brandId: string, accessToken: string, isInitial: boolean): Promise<void> {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: { threepl: true }
    });

    if (!brand) return;

    const filters: TrackstarFilters = {
      limit: 1000
    };

    if (!isInitial) {
      const integration = await prisma.brandIntegration.findUnique({
        where: { brandId_provider: { brandId, provider: 'TRACKSTAR' } }
      });
      
      if (integration?.lastSyncedAt) {
        filters.updated_date = {
          gte: new Date(integration.lastSyncedAt.getTime() - 2 * 60 * 1000).toISOString()
        };
      }
    }

    await trackstarClient.paginate('/wms/orders', accessToken, filters, async (orders, pageNumber) => {
      for (const order of orders) {
        await prisma.order.upsert({
          where: {
            brandId_externalId: {
              brandId,
              externalId: order.id
            }
          },
          update: {
            orderNumber: order.order_number || order.id,
            customerId: order.customer_id || 'unknown',
            customerEmail: order.customer_email,
            customerName: order.customer_name,
            status: this.mapOrderStatus(order.status),
            total: order.total || 0,
            subtotal: order.subtotal || 0,
            tax: order.tax,
            shipping: order.shipping,
            rawData: order,
            updatedAtRemote: order.updated_at ? new Date(order.updated_at) : null,
            updatedAt: new Date()
          },
          create: {
            threeplId: brand.threeplId,
            brandId,
            externalId: order.id,
            orderNumber: order.order_number || order.id,
            customerId: order.customer_id || 'unknown',
            customerEmail: order.customer_email,
            customerName: order.customer_name,
            status: this.mapOrderStatus(order.status),
            total: order.total || 0,
            subtotal: order.subtotal || 0,
            tax: order.tax,
            shipping: order.shipping,
            rawData: order,
            updatedAtRemote: order.updated_at ? new Date(order.updated_at) : null
          }
        });
      }
    });
  }

  private async syncShipments(brandId: string, accessToken: string, isInitial: boolean): Promise<void> {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: { threepl: true }
    });

    if (!brand) return;

    const filters: TrackstarFilters = {
      limit: 1000
    };

    if (!isInitial) {
      const integration = await prisma.brandIntegration.findUnique({
        where: { brandId_provider: { brandId, provider: 'TRACKSTAR' } }
      });
      
      if (integration?.lastSyncedAt) {
        filters.updated_date = {
          gte: new Date(integration.lastSyncedAt.getTime() - 2 * 60 * 1000).toISOString()
        };
      }
    }

    await trackstarClient.paginate('/wms/shipments', accessToken, filters, async (shipments, pageNumber) => {
      for (const shipment of shipments) {
        // Find the order this shipment belongs to
        const order = await prisma.order.findUnique({
          where: {
            brandId_externalId: {
              brandId,
              externalId: shipment.order_id
            }
          }
        });

        await prisma.shipment.upsert({
          where: {
            brandId_externalId: {
              brandId,
              externalId: shipment.id
            }
          },
          update: {
            orderId: order?.id,
            trackingNumber: shipment.tracking_number,
            carrier: shipment.carrier,
            service: shipment.service,
            status: shipment.status,
            shippedAt: shipment.shipped_at ? new Date(shipment.shipped_at) : null,
            deliveredAt: shipment.delivered_at ? new Date(shipment.delivered_at) : null,
            rawData: shipment,
            updatedAt: new Date()
          },
          create: {
            threeplId: brand.threeplId,
            brandId,
            externalId: shipment.id,
            orderId: order?.id,
            trackingNumber: shipment.tracking_number,
            carrier: shipment.carrier,
            service: shipment.service,
            status: shipment.status,
            shippedAt: shipment.shipped_at ? new Date(shipment.shipped_at) : null,
            deliveredAt: shipment.delivered_at ? new Date(shipment.delivered_at) : null,
            rawData: shipment
          }
        });

        // Update order status to SHIPPED if we have shipment data
        if (order && shipment.status === 'shipped') {
          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'SHIPPED' }
          });
        }
      }
    });
  }

  private mapOrderStatus(trackstarStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'PENDING',
      'processing': 'PROCESSING',
      'shipped': 'SHIPPED',
      'delivered': 'DELIVERED',
      'cancelled': 'CANCELLED',
      'returned': 'RETURNED'
    };

    return statusMap[trackstarStatus.toLowerCase()] || 'PENDING';
  }

  async processWebhookJob(job: Job): Promise<void> {
    const { eventType, connectionId, data, previousAttributes } = job.data;

    try {
      logger.info(`Processing webhook: ${eventType} for connection: ${connectionId}`);

      // Find the integration by connection ID
      const integration = await prisma.brandIntegration.findFirst({
        where: { connectionId }
      });

      if (!integration) {
        logger.warn(`No integration found for connection ID: ${connectionId}`);
        return;
      }

      switch (eventType) {
        case 'order.created':
        case 'order.updated':
          await this.handleOrderWebhook(integration.brandId, data, previousAttributes);
          break;
        case 'order.shipment.created':
          await this.handleShipmentWebhook(integration.brandId, data);
          break;
        case 'product.created':
        case 'product.updated':
          await this.handleProductWebhook(integration.brandId, data);
          break;
        case 'inventory.updated':
          await this.handleInventoryWebhook(integration.brandId, data);
          break;
        case 'connection.historical-sync-completed':
          await this.handleHistoricalSyncCompleted(integration.brandId, data);
          break;
        default:
          logger.info(`Unhandled webhook event type: ${eventType}`);
      }

      // Update last webhook timestamp
      await prisma.brandIntegration.update({
        where: { id: integration.id },
        data: { lastWebhookAt: new Date() }
      });

      logger.info(`Webhook processed successfully: ${eventType}`);
    } catch (error) {
      logger.error(`Webhook processing failed: ${eventType}`, error);
      throw error;
    }
  }

  private async handleOrderWebhook(brandId: string, data: any, previousAttributes?: any): Promise<void> {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: { threepl: true }
    });

    if (!brand) return;

    await prisma.order.upsert({
      where: {
        brandId_externalId: {
          brandId,
          externalId: data.id
        }
      },
      update: {
        orderNumber: data.order_number || data.id,
        customerId: data.customer_id || 'unknown',
        customerEmail: data.customer_email,
        customerName: data.customer_name,
        status: this.mapOrderStatus(data.status),
        total: data.total || 0,
        subtotal: data.subtotal || 0,
        tax: data.tax,
        shipping: data.shipping,
        rawData: data,
        updatedAtRemote: data.updated_at ? new Date(data.updated_at) : null,
        updatedAt: new Date()
      },
      create: {
        threeplId: brand.threeplId,
        brandId,
        externalId: data.id,
        orderNumber: data.order_number || data.id,
        customerId: data.customer_id || 'unknown',
        customerEmail: data.customer_email,
        customerName: data.customer_name,
        status: this.mapOrderStatus(data.status),
        total: data.total || 0,
        subtotal: data.subtotal || 0,
        tax: data.tax,
        shipping: data.shipping,
        rawData: data,
        updatedAtRemote: data.updated_at ? new Date(data.updated_at) : null
      }
    });
  }

  private async handleShipmentWebhook(brandId: string, data: any): Promise<void> {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: { threepl: true }
    });

    if (!brand) return;

    // Find the order this shipment belongs to
    const order = await prisma.order.findUnique({
      where: {
        brandId_externalId: {
          brandId,
          externalId: data.order_id
        }
      }
    });

    await prisma.shipment.upsert({
      where: {
        brandId_externalId: {
          brandId,
          externalId: data.id
        }
      },
      update: {
        orderId: order?.id,
        trackingNumber: data.tracking_number,
        carrier: data.carrier,
        service: data.service,
        status: data.status,
        shippedAt: data.shipped_at ? new Date(data.shipped_at) : null,
        deliveredAt: data.delivered_at ? new Date(data.delivered_at) : null,
        rawData: data,
        updatedAt: new Date()
      },
      create: {
        threeplId: brand.threeplId,
        brandId,
        externalId: data.id,
        orderId: order?.id,
        trackingNumber: data.tracking_number,
        carrier: data.carrier,
        service: data.service,
        status: data.status,
        shippedAt: data.shipped_at ? new Date(data.shipped_at) : null,
        deliveredAt: data.delivered_at ? new Date(data.delivered_at) : null,
        rawData: data
      }
    });

    // Update order status to SHIPPED
    if (order) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'SHIPPED' }
      });
    }
  }

  private async handleProductWebhook(brandId: string, data: any): Promise<void> {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: { threepl: true }
    });

    if (!brand) return;

    await prisma.product.upsert({
      where: {
        brandId_externalId: {
          brandId,
          externalId: data.id
        }
      },
      update: {
        sku: data.sku || data.id,
        name: data.name || data.title || 'Unknown Product',
        description: data.description,
        category: data.category,
        price: data.price,
        cost: data.cost,
        weight: data.weight,
        dimensions: data.dimensions,
        rawData: data,
        updatedAt: new Date()
      },
      create: {
        threeplId: brand.threeplId,
        brandId,
        externalId: data.id,
        sku: data.sku || data.id,
        name: data.name || data.title || 'Unknown Product',
        description: data.description,
        category: data.category,
        price: data.price,
        cost: data.cost,
        weight: data.weight,
        dimensions: data.dimensions,
        rawData: data
      }
    });
  }

  private async handleInventoryWebhook(brandId: string, data: any): Promise<void> {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: { threepl: true }
    });

    if (!brand) return;

    // Find the product
    const product = await prisma.product.findUnique({
      where: {
        brandId_externalId: {
          brandId,
          externalId: data.product_id
        }
      }
    });

    if (product) {
      await prisma.inventorySnapshot.create({
        data: {
          threeplId: brand.threeplId,
          brandId,
          productId: product.id,
          quantityFulfillable: data.quantity_fulfillable || 0,
          quantityOnHand: data.quantity_on_hand || 0,
          location: data.location,
          rawData: data
        }
      });
    }
  }

  private async handleHistoricalSyncCompleted(brandId: string, data: any): Promise<void> {
    logger.info(`Historical sync completed for brand ${brandId}, resource: ${data.resource}`);
    
    // Mark integration as ready for this resource
    await prisma.brandIntegration.update({
      where: { brandId_provider: { brandId, provider: 'TRACKSTAR' } },
      data: { 
        status: 'ACTIVE',
        lastSyncedAt: new Date()
      }
    });
  }

  async triggerManualSync(brandId: string, functionsToSync: string[]): Promise<void> {
    const integration = await prisma.brandIntegration.findUnique({
      where: { brandId_provider: { brandId, provider: 'TRACKSTAR' } }
    });

    if (!integration) {
      throw new Error('Trackstar integration not found for this brand');
    }

    // Call Trackstar's sync endpoint
    await trackstarClient.syncConnection(integration.accessToken, functionsToSync);

    // Queue our sync jobs
    for (const func of functionsToSync) {
      await this.syncQueue.add('manual-sync', {
        brandId,
        accessToken: integration.accessToken,
        function: func,
        type: 'manual'
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      });
    }
  }

  async getSyncHealth(brandId: string): Promise<any> {
    const integration = await prisma.brandIntegration.findUnique({
      where: { brandId_provider: { brandId, provider: 'TRACKSTAR' } }
    });

    if (!integration) {
      throw new Error('Trackstar integration not found for this brand');
    }

    // Get connection details from Trackstar
    const connectionDetails = await trackstarClient.getConnection(integration.accessToken);

    // Get recent webhook events
    const recentWebhooks = await prisma.trackstarWebhookEvent.findMany({
      where: { connectionId: integration.connectionId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Get queue status
    const syncQueueStatus = await this.syncQueue.getJobCounts();
    const webhookQueueStatus = await this.webhookQueue.getJobCounts();

    return {
      integration: {
        status: integration.status,
        lastSyncedAt: integration.lastSyncedAt,
        lastWebhookAt: integration.lastWebhookAt,
        connectionId: integration.connectionId,
        integrationName: integration.integrationName
      },
      connection: connectionDetails,
      queues: {
        sync: syncQueueStatus,
        webhook: webhookQueueStatus
      },
      recentWebhooks: recentWebhooks.map(wh => ({
        eventType: wh.eventType,
        status: wh.status,
        createdAt: wh.createdAt,
        error: wh.error
      }))
    };
  }
}

export const trackstarIntegrationService = new TrackstarIntegrationService();
