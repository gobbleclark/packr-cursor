import { prisma } from '@packr/database';
import { trackstarClient, TrackstarFilters } from './client';
import { logger } from '../../utils/logger';
import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../../lib/redis';

export class TrackstarIntegrationService {
  private syncQueue: Queue;
  private webhookQueue: Queue;

  constructor() {
    this.syncQueue = new Queue('trackstar-sync', { connection: redis });
    this.webhookQueue = new Queue('trackstar-webhook', { connection: redis });
    
    this.setupWorkers();
  }

  private setupWorkers() {
    // Sync worker
    new Worker('trackstar-sync', async (job: Job) => {
      await this.processSyncJob(job);
    }, { connection: redis });

    // Webhook worker
    new Worker('trackstar-webhook', async (job: Job) => {
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

      // According to Trackstar docs, /link/token endpoint works with just API key
      // Let's try without additional parameters first
      const response = await trackstarClient.instance.createLinkToken();
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

      const response = await trackstarClient.instance.exchangeAuthCode(request);

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
      
      // Schedule incremental sync job (every 5 minutes, 2-hour lookback)
      await this.scheduleIncrementalSync(brandId);
      
      // Schedule delayed backfill job (5 hours after integration)
      await this.scheduleDelayedBackfill(brandId);
      
      // Subscribe to all available webhooks
      await this.subscribeToWebhooks(response.connection_id, response.access_token);
      
    } catch (error) {
      logger.error('Failed to exchange auth code:', error);
      throw error;
    }
  }

  /**
   * Schedule incremental sync job that runs every 5 minutes with 2-hour lookback
   */
  private async scheduleIncrementalSync(brandId: string): Promise<void> {
    try {
      // Add recurring job for incremental sync
      await this.syncQueue.add(
        'incremental-sync',
        { brandId, lookbackHours: 2 },
        {
          repeat: {
            every: 5 * 60 * 1000, // 5 minutes in milliseconds
          },
          jobId: `incremental-sync-${brandId}`, // Unique job ID to prevent duplicates
          removeOnComplete: 10, // Keep last 10 completed jobs
          removeOnFail: 5, // Keep last 5 failed jobs
        }
      );
      
      logger.info(`Scheduled incremental sync for brand ${brandId} - every 5 minutes with 2-hour lookback`);
    } catch (error) {
      logger.error('Failed to schedule incremental sync:', error);
      throw error;
    }
  }

  /**
   * Schedule delayed backfill job that runs 5 hours after integration
   */
  private async scheduleDelayedBackfill(brandId: string): Promise<void> {
    try {
      // Add delayed job for full backfill
      await this.syncQueue.add(
        'delayed-backfill',
        { brandId },
        {
          delay: 5 * 60 * 60 * 1000, // 5 hours in milliseconds
          jobId: `delayed-backfill-${brandId}`, // Unique job ID
          removeOnComplete: 1, // Keep only the completed job
          removeOnFail: 1, // Keep only the failed job
        }
      );
      
      logger.info(`Scheduled delayed backfill for brand ${brandId} - will run in 5 hours`);
    } catch (error) {
      logger.error('Failed to schedule delayed backfill:', error);
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
    const { brandId, accessToken, function: func, type, lookbackHours } = job.data;

    try {
      logger.info(`Processing sync job for brand ${brandId}, function: ${func}, type: ${type}, lookback: ${lookbackHours}h`);

      // Handle different job types
      if (job.name === 'incremental-sync') {
        await this.processIncrementalSync(brandId, lookbackHours);
      } else if (job.name === 'delayed-backfill') {
        await this.processDelayedBackfill(brandId);
      } else if (job.name === 'delayed-backfill-retry') {
        await this.processDelayedBackfill(brandId);
      } else if (job.name === 'nightly-reconciliation') {
        await this.processNightlyReconciliation();
      } else {
        // Legacy sync job handling
      switch (func) {
        case 'get_products':
          await this.syncProducts(brandId, accessToken, type === 'initial');
          break;
        case 'get_inventory':
          await this.syncInventory(brandId, accessToken, type === 'initial');
          break;
        case 'get_orders':
            await this.syncOrders(brandId, accessToken, type === 'initial', lookbackHours);
          break;
        case 'get_shipments':
          await this.syncShipments(brandId, accessToken, type === 'initial');
          break;
        default:
          logger.warn(`Unknown sync function: ${func}`);
      }

        // Update last synced timestamp for legacy jobs
      await prisma.brandIntegration.update({
        where: { brandId_provider: { brandId, provider: 'TRACKSTAR' } },
        data: { lastSyncedAt: new Date() }
      });
      }

      logger.info(`Sync job completed for brand ${brandId}, function: ${func}`);
    } catch (error) {
      logger.error(`Sync job failed for brand ${brandId}, function: ${func}:`, error);
      throw error;
    }
  }

  /**
   * Process incremental sync with 2-hour lookback for orders only
   * Based on Trackstar API docs: 10 requests/second rate limit, 1000 items default pagination
   */
  private async processIncrementalSync(brandId: string, lookbackHours: number = 2): Promise<void> {
    try {
      const integration = await prisma.brandIntegration.findUnique({
        where: {
          brandId_provider: {
            brandId,
            provider: 'TRACKSTAR',
          },
        },
      });

      if (!integration || integration.status !== 'ACTIVE') {
        logger.warn(`No active Trackstar integration found for brand ${brandId}`);
        return;
      }

      logger.info(`Starting incremental sync for brand ${brandId} with ${lookbackHours}h lookback`);

      // Only sync orders for incremental updates (most critical for real-time)
      await this.syncOrders(brandId, integration.accessToken, false, lookbackHours);
      
      // Update last sync time
      await prisma.brandIntegration.update({
        where: { id: integration.id },
        data: { lastSyncedAt: new Date() }
      });

      logger.info(`Completed incremental sync for brand ${brandId}`);
    } catch (error) {
      logger.error(`Failed incremental sync for brand ${brandId}:`, error);
      throw error;
    }
  }

  /**
   * Process delayed backfill for all historical data
   * Runs 5 hours after integration to allow Trackstar to pull WMS data
   */
  private async processDelayedBackfill(brandId: string): Promise<void> {
    try {
      const integration = await prisma.brandIntegration.findUnique({
        where: {
          brandId_provider: {
            brandId,
            provider: 'TRACKSTAR',
          },
        },
      });

      if (!integration || integration.status !== 'ACTIVE') {
        logger.warn(`No active Trackstar integration found for brand ${brandId}`);
        return;
      }

      logger.info(`Starting delayed backfill for brand ${brandId} - pulling all historical data`);

      // Check if we should retry backfill (in case Trackstar is still syncing)
      const shouldRetry = await this.shouldRetryBackfill(brandId, integration.accessToken);
      if (shouldRetry) {
        logger.info(`Trackstar may still be syncing for brand ${brandId}, scheduling retry in 2 hours`);
        await this.scheduleBackfillRetry(brandId);
        return;
      }

      // Full backfill of all data types with proper sequencing
      await this.syncProducts(brandId, integration.accessToken, true);
      await this.syncInventory(brandId, integration.accessToken, true);
      await this.syncOrders(brandId, integration.accessToken, true);
      await this.syncShipments(brandId, integration.accessToken, true);

      // Mark backfill as completed
      await prisma.brandIntegration.update({
        where: { id: integration.id },
        data: { 
          lastSyncedAt: new Date(),
          config: {
            ...((integration.config as any) || {}),
            initialBackfillCompleted: true,
            initialBackfillCompletedAt: new Date().toISOString()
          }
        }
      });

      logger.info(`Completed delayed backfill for brand ${brandId}`);
    } catch (error) {
      logger.error(`Failed delayed backfill for brand ${brandId}:`, error);
      throw error;
    }
  }

  /**
   * Check if we should retry the backfill (Trackstar might still be syncing)
   */
  private async shouldRetryBackfill(brandId: string, accessToken: string): Promise<boolean> {
    try {
      // Try to get a small sample of orders to see if Trackstar has data
      const testFilters: TrackstarFilters = { limit: 10 };
      const response = await trackstarClient.instance.getOrders(accessToken, testFilters);
      
      // If we get 0 orders, Trackstar might still be syncing
      // This is a heuristic - in production you might want to call a Trackstar status API
      if (!response.data || response.data.length === 0) {
        logger.warn(`No orders returned from Trackstar for brand ${brandId} - may still be syncing`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Error checking Trackstar sync status for brand ${brandId}:`, error);
      return false; // Proceed with backfill anyway
    }
  }

  /**
   * Schedule a backfill retry in 2 hours
   */
  private async scheduleBackfillRetry(brandId: string): Promise<void> {
    const retryJob = await this.syncQueue.add(
      'delayed-backfill-retry',
      { brandId },
      {
        delay: 2 * 60 * 60 * 1000, // 2 hours
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000, // 1 minute base delay
        },
      }
    );
    
    logger.info(`Scheduled backfill retry for brand ${brandId} in 2 hours (job: ${retryJob.id})`);
  }

  /**
   * Nightly reconciliation sync - runs every night at 2 AM
   * Syncs last 30 days of data to ensure integrity
   */
  async processNightlyReconciliation(): Promise<void> {
    try {
      logger.info('Starting nightly reconciliation sync for all Trackstar integrations');

      // Get all active Trackstar integrations
      const integrations = await prisma.brandIntegration.findMany({
        where: {
          provider: 'TRACKSTAR',
          status: 'ACTIVE'
        },
        include: {
          brand: true
        }
      });

      logger.info(`Found ${integrations.length} active Trackstar integrations for nightly reconciliation`);

      for (const integration of integrations) {
        try {
          await this.processNightlyReconciliationForBrand(integration.brandId, integration.accessToken);
        } catch (error) {
          logger.error(`Nightly reconciliation failed for brand ${integration.brandId}:`, error);
          // Continue with other brands even if one fails
        }
      }

      logger.info('Completed nightly reconciliation sync for all integrations');
    } catch (error) {
      logger.error('Failed to run nightly reconciliation:', error);
      throw error;
    }
  }

  /**
   * Process nightly reconciliation for a specific brand
   * Syncs last 30 days of all data types
   */
  private async processNightlyReconciliationForBrand(brandId: string, accessToken: string): Promise<void> {
    logger.info(`Starting nightly reconciliation for brand ${brandId}`);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Sync all data types with 30-day lookback
    await this.syncProductsWithDateFilter(brandId, accessToken, thirtyDaysAgo);
    await this.syncInventoryWithDateFilter(brandId, accessToken, thirtyDaysAgo);
    await this.syncOrdersWithDateFilter(brandId, accessToken, thirtyDaysAgo);
    await this.syncShipmentsWithDateFilter(brandId, accessToken, thirtyDaysAgo);

    // Update last reconciliation timestamp
    await prisma.brandIntegration.update({
      where: { brandId_provider: { brandId, provider: 'TRACKSTAR' } },
      data: { 
        lastSyncedAt: new Date(),
        config: {
          ...((await prisma.brandIntegration.findUnique({
            where: { brandId_provider: { brandId, provider: 'TRACKSTAR' } }
          }))?.config as any || {}),
          lastNightlyReconciliation: new Date().toISOString()
        }
      }
    });

    logger.info(`Completed nightly reconciliation for brand ${brandId}`);
  }

  /**
   * Subscribe to all available webhooks for real-time updates
   * This ensures we get notified immediately when orders/shipments change
   */
  async subscribeToWebhooks(connectionId: string, accessToken: string): Promise<void> {
    try {
      logger.info(`Subscribing to webhooks for connection ${connectionId}`);

      // Get the webhook URL for our API - use ngrok URL in development
      const webhookUrl = process.env.NGROK_URL 
        ? `${process.env.NGROK_URL}/api/webhooks/trackstar`
        : `${process.env.API_BASE_URL || 'http://localhost:4000'}/api/webhooks/trackstar`;
      
      // Skip webhook subscriptions only if no ngrok URL is provided in development
      if (!process.env.NGROK_URL && (webhookUrl.includes('localhost') || webhookUrl.includes('127.0.0.1'))) {
        logger.warn('Skipping webhook subscriptions in development - set NGROK_URL environment variable to enable webhooks');
        return;
      }
      
      // Subscribe to all critical webhook events
      const webhookEvents = [
        'order.created',
        'order.updated', 
        'order.cancelled',
        'shipment.created',
        'shipment.updated',
        'shipment.shipped',
        'shipment.delivered',
        'product.created',
        'product.updated',
        'inventory.updated'
      ];

      for (const eventType of webhookEvents) {
        try {
          await trackstarClient.instance.subscribeToWebhook(accessToken, {
            event_type: eventType,
            url: webhookUrl,
            connection_id: connectionId
          });
          
          logger.info(`Successfully subscribed to webhook: ${eventType}`);
        } catch (webhookError) {
          logger.warn(`Failed to subscribe to webhook ${eventType}:`, webhookError);
          // Continue with other webhooks even if one fails
        }
      }

      logger.info(`Completed webhook subscription for connection ${connectionId}`);
    } catch (error) {
      logger.error(`Failed to subscribe to webhooks for connection ${connectionId}:`, error);
      // Don't throw error - webhook subscription failure shouldn't break integration
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

    try {
      const response = await trackstarClient.instance.getProducts(accessToken, filters);
      const products = response.data || [];
      
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
      
      logger.info(`Synced ${products.length} products for brand ${brandId}`);
    } catch (error) {
      logger.error(`Failed to sync products for brand ${brandId}:`, error);
      throw error;
    }
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

    try {
      const response = await trackstarClient.instance.getInventory(accessToken, filters);
      const inventoryItems = response.data || [];
      
      for (const item of inventoryItems) {
        // Skip items without SKU (Trackstar inventory uses SKU as the primary identifier)
        if (!item.sku) {
          logger.warn(`Skipping inventory item without SKU:`, item);
          continue;
        }

        // Find product by SKU (since Trackstar inventory doesn't have product_id)
        const product = await prisma.product.findFirst({
          where: {
            brandId,
            sku: item.sku
          }
        });

        // Handle warehouse creation/lookup
        let warehouseId = null;
        if (item.locations?.[0]?.location_id) {
          const locationId = item.locations[0].location_id;
          
          // Find or create warehouse
          let warehouse = await prisma.warehouse.findUnique({
            where: {
              tenantId_externalId: {
                tenantId: brand.threeplId,
                externalId: locationId
              }
            }
          });

          if (!warehouse) {
            warehouse = await prisma.warehouse.create({
              data: {
                tenantId: brand.threeplId,
                externalId: locationId,
                name: item.locations[0].name || `Warehouse ${locationId}`,
                address: item.locations[0].address || null,
                city: item.locations[0].city || null,
                state: item.locations[0].state || null,
                zipCode: item.locations[0].zip_code || null,
                country: item.locations[0].country || null,
                active: true,
                metadata: {
                  trackstarData: item.locations[0],
                  createdFrom: 'inventory_sync'
                }
              }
            });
            logger.info(`Created new warehouse: ${warehouse.name} (${warehouse.externalId})`);
          }

          warehouseId = warehouse.id;
        }

        // Create or update inventory item
        await prisma.inventoryItem.upsert({
          where: {
            tenantId_brandId_warehouseId_sku: {
              tenantId: brand.threeplId,
              brandId,
              warehouseId: warehouseId || '',
              sku: item.sku
            }
          },
          create: {
            tenantId: brand.threeplId,
            brandId,
            warehouseId,
            sku: item.sku,
            productName: product?.name || `Product ${item.sku}`,
            trackstarProductId: item.product_id,
            trackstarVariantId: item.variant_id,
            onHand: item.onhand || 0,
            available: item.fulfillable || 0,
            incoming: item.incoming || 0,
            committed: item.committed || 0,
            unfulfillable: item.unfulfillable || 0,
            unsellable: item.unsellable || 0,
            sellable: item.sellable || 0,
            awaiting: item.awaiting || 0,
            unitCost: item.unit_cost || null,
            lastTrackstarUpdateAt: new Date(),
            rawData: item,
          },
          update: {
            productName: product?.name || `Product ${item.sku}`,
            trackstarProductId: item.product_id,
            trackstarVariantId: item.variant_id,
            onHand: item.onhand || 0,
            available: item.fulfillable || 0,
            incoming: item.incoming || 0,
            committed: item.committed || 0,
            unfulfillable: item.unfulfillable || 0,
            unsellable: item.unsellable || 0,
            sellable: item.sellable || 0,
            awaiting: item.awaiting || 0,
            unitCost: item.unit_cost || null,
            lastTrackstarUpdateAt: new Date(),
            rawData: item,
          }
        });
        
        logger.info(`Synced inventory for SKU: ${item.sku}, Warehouse: ${warehouseId || 'none'}, On Hand: ${item.onhand}, Available: ${item.fulfillable}`);
      }
      
      logger.info(`Synced ${inventoryItems.length} inventory items for brand ${brandId}`);
    } catch (error) {
      logger.error(`Failed to sync inventory for brand ${brandId}:`, error);
      throw error;
    }
  }

  private async syncOrders(brandId: string, accessToken: string, isInitial: boolean, lookbackHours?: number): Promise<void> {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: { threepl: true }
    });

    if (!brand) return;

    const filters: TrackstarFilters = {
      limit: 1000 // Trackstar API default: 1000 items per page
    };

    if (!isInitial) {
      if (lookbackHours) {
        // Use specified lookback hours (for incremental sync)
        const lookbackTime = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
        filters.updated_date = {
          gte: lookbackTime.toISOString()
        };
        logger.info(`Syncing orders with ${lookbackHours}h lookback from ${lookbackTime.toISOString()}`);
      } else {
        // Use last sync time with 2-minute overlap (legacy behavior)
      const integration = await prisma.brandIntegration.findUnique({
        where: { brandId_provider: { brandId, provider: 'TRACKSTAR' } }
      });
      
      if (integration?.lastSyncedAt) {
        filters.updated_date = {
          gte: new Date(integration.lastSyncedAt.getTime() - 2 * 60 * 1000).toISOString()
        };
        }
      }
    }

    try {
      const response = await trackstarClient.instance.getOrders(accessToken, filters);
      const orders = response.data || [];
      
      for (const order of orders) {
        // Check for backorder items by cross-referencing with inventory
        const backorderInfo = await this.checkBackorderStatus(brandId, order.line_items || []);

        // Map comprehensive order data from Trackstar API response
        const orderData = {
          orderNumber: order.order_number || order.reference_id || order.id,
          customerId: order.warehouse_customer_id || 'unknown',
          customerEmail: order.ship_to_address?.email_address,
          customerName: order.ship_to_address?.full_name || order.ship_to_address?.company,
          status: this.mapOrderStatus(order.status, order.raw_status),
          total: order.total_price || 0,
          subtotal: (order.total_price || 0) - (order.total_tax || 0) - (order.total_shipping || 0),
          tax: order.total_tax,
          shipping: order.total_shipping,
          metadata: {
            // Store all additional Trackstar fields in metadata
            warehouse_id: order.warehouse_id,
            reference_id: order.reference_id,
            channel: order.channel,
            channel_object: order.channel_object,
            type: order.type,
            trading_partner: order.trading_partner,
            shipping_method: order.shipping_method,
            is_third_party_freight: order.is_third_party_freight,
            third_party_freight_account_number: order.third_party_freight_account_number,
            first_party_freight_account_number: order.first_party_freight_account_number,
            invoice_currency_code: order.invoice_currency_code,
            total_discount: order.total_discount,
            ship_to_address: order.ship_to_address,
            tags: order.tags,
            required_ship_date: order.required_ship_date,
            saturday_delivery: order.saturday_delivery,
            signature_required: order.signature_required,
            international_duty_paid_by: order.international_duty_paid_by,
            external_system_url: order.external_system_url,
            additional_fields: order.additional_fields,
            // Track fulfillment status for dashboard logic
            has_shipments: order.shipments && order.shipments.length > 0,
            shipment_count: order.shipments ? order.shipments.length : 0,
            is_fulfilled: order.shipments && order.shipments.some(s => s.shipped_date),
            required_ship_date_parsed: order.required_ship_date ? new Date(order.required_ship_date) : null,
            backorder_info: backorderInfo
          },
          rawData: order, // Store complete raw response
          updatedAtRemote: order.updated_date ? new Date(order.updated_date) : null
        };

        await prisma.order.upsert({
          where: {
            brandId_externalId: {
              brandId,
              externalId: order.id
            }
          },
          update: {
            ...orderData,
            updatedAt: new Date()
          },
          create: {
            threeplId: brand.threeplId,
            brandId,
            externalId: order.id,
            ...orderData
          }
        });

        // Process order line items
        if (order.line_items && order.line_items.length > 0) {
          await this.syncOrderItems(brandId, order.id, order.line_items);
        }

        // Process shipments if they exist (fulfilled orders)
        if (order.shipments && order.shipments.length > 0) {
          await this.syncOrderShipments(brandId, order.id, order.shipments);
        }
      }
      
      logger.info(`Synced ${orders.length} orders for brand ${brandId}`);
    } catch (error) {
      logger.error(`Failed to sync orders for brand ${brandId}:`, error);
      throw error;
    }
  }

  /**
   * Sync order line items from Trackstar order data
   */
  private async syncOrderItems(brandId: string, orderExternalId: string, lineItems: any[]): Promise<void> {
    try {
      // Get the order from our database
      const order = await prisma.order.findUnique({
        where: {
          brandId_externalId: {
            brandId,
            externalId: orderExternalId
          }
        }
      });

      if (!order) {
        logger.warn(`Order not found for line items sync: ${orderExternalId}`);
        return;
      }

      // Delete existing order items to avoid duplicates
      await prisma.orderItem.deleteMany({
        where: { orderId: order.id }
      });

      // Create new order items
      for (const item of lineItems) {
        // Find or create product
        let product = await prisma.product.findFirst({
          where: {
            brandId,
            sku: item.sku
          }
        });

        if (!product && item.product_id) {
          // Try to find by external ID
          product = await prisma.product.findUnique({
            where: {
              brandId_externalId: {
                brandId,
                externalId: item.product_id
              }
            }
          });
        }

        if (product) {
          await prisma.orderItem.create({
            data: {
              orderId: order.id,
              productId: product.id,
              quantity: item.quantity || 0,
              price: item.unit_price || 0,
              total: (item.unit_price || 0) * (item.quantity || 0) - (item.discount_amount || 0),
              metadata: {
                sku: item.sku,
                discount_amount: item.discount_amount,
                is_picked: item.is_picked,
                product_id: item.product_id
              }
            }
          });
        } else {
          logger.warn(`Product not found for order item: SKU ${item.sku}, Product ID ${item.product_id}`);
        }
      }
    } catch (error) {
      logger.error(`Failed to sync order items for order ${orderExternalId}:`, error);
    }
  }

  /**
   * Sync shipments from Trackstar order data
   */
  private async syncOrderShipments(brandId: string, orderExternalId: string, shipments: any[]): Promise<void> {
    try {
      // Get the order from our database
        const order = await prisma.order.findUnique({
          where: {
            brandId_externalId: {
              brandId,
            externalId: orderExternalId
            }
          }
        });

      if (!order) {
        logger.warn(`Order not found for shipments sync: ${orderExternalId}`);
        return;
      }

      for (const shipment of shipments) {
        // Extract tracking information from packages
        const trackingNumbers = [];
        const carriers = [];
        
        if (shipment.packages) {
          for (const pkg of shipment.packages) {
            if (pkg.tracking_number) trackingNumbers.push(pkg.tracking_number);
            if (pkg.carrier) carriers.push(pkg.carrier);
          }
        }

        await prisma.shipment.upsert({
          where: {
            brandId_externalId: {
              brandId,
              externalId: shipment.shipment_id
            }
          },
          update: {
            orderId: order.id,
            trackingNumber: trackingNumbers.join(', ') || null,
            carrier: carriers.join(', ') || null,
            service: shipment.shipping_method,
            status: shipment.status || 'unknown',
            shippedAt: shipment.shipped_date ? new Date(shipment.shipped_date) : null,
            metadata: {
              warehouse_id: shipment.warehouse_id,
              raw_status: shipment.raw_status,
              ship_from_address: shipment.ship_from_address,
              ship_to_address: shipment.ship_to_address,
              line_items: shipment.line_items,
              packages: shipment.packages
            },
            rawData: shipment,
            updatedAt: new Date()
          },
          create: {
            threeplId: order.threeplId,
            brandId,
            orderId: order.id,
            externalId: shipment.shipment_id,
            trackingNumber: trackingNumbers.join(', ') || null,
            carrier: carriers.join(', ') || null,
            service: shipment.shipping_method,
            status: shipment.status || 'unknown',
            shippedAt: shipment.shipped_date ? new Date(shipment.shipped_date) : null,
            metadata: {
              warehouse_id: shipment.warehouse_id,
              raw_status: shipment.raw_status,
              ship_from_address: shipment.ship_from_address,
              ship_to_address: shipment.ship_to_address,
              line_items: shipment.line_items,
              packages: shipment.packages
            },
            rawData: shipment
          }
        });
      }
    } catch (error) {
      logger.error(`Failed to sync shipments for order ${orderExternalId}:`, error);
    }
  }

  private async syncShipments(brandId: string, accessToken: string, isInitial: boolean): Promise<void> {
    // Shipments are now processed as part of orders in syncOrderShipments()
    // This method is kept for compatibility but does nothing
    logger.info(`Shipments are processed as part of orders for brand ${brandId}`);
  }

  /**
   * Date-filtered sync methods for nightly reconciliation
   */
  private async syncProductsWithDateFilter(brandId: string, accessToken: string, fromDate: Date): Promise<void> {
    logger.info(`Syncing products for brand ${brandId} from ${fromDate.toISOString()}`);
    // For now, just call the regular sync - we can optimize with date filters later
    await this.syncProducts(brandId, accessToken, false);
  }

  private async syncInventoryWithDateFilter(brandId: string, accessToken: string, fromDate: Date): Promise<void> {
    logger.info(`Syncing inventory for brand ${brandId} from ${fromDate.toISOString()}`);
    // For now, just call the regular sync - we can optimize with date filters later
    await this.syncInventory(brandId, accessToken, false);
  }

  private async syncOrdersWithDateFilter(brandId: string, accessToken: string, fromDate: Date): Promise<void> {
    logger.info(`Syncing orders for brand ${brandId} from ${fromDate.toISOString()}`);
    
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: { threepl: true }
    });

    if (!brand) return;

    const filters: TrackstarFilters = {
      limit: 1000,
      updated_date: { gte: fromDate.toISOString() }
    };

    logger.info(`Getting orders from WMS with 30-day filter from ${fromDate.toISOString()}`);
    
    try {
      const response = await trackstarClient.instance.getOrders(accessToken, filters);
      const orders = response.data || [];
      
      logger.info(`Successfully fetched ${orders.length} orders from Trackstar for reconciliation`);
      
      // Process orders same as regular sync
      for (const order of orders) {
        // Check for backorder items by cross-referencing with inventory
        const backorderInfo = await this.checkBackorderStatus(brandId, order.line_items || []);

        const orderData = {
          orderNumber: order.order_number,
          customerEmail: order.ship_to_address?.email_address,
          customerName: order.ship_to_address?.full_name || order.ship_to_address?.company,
          status: this.mapOrderStatus(order.status, order.raw_status),
          total: order.total_price || 0,
          subtotal: (order.total_price || 0) - (order.total_tax || 0) - (order.total_shipping || 0),
          tax: order.total_tax,
          shipping: order.total_shipping,
          metadata: {
            warehouse_id: order.warehouse_id,
            reference_id: order.reference_id,
            channel: order.channel,
            required_ship_date: order.required_ship_date,
            has_shipments: order.shipments && order.shipments.length > 0,
            shipment_count: order.shipments ? order.shipments.length : 0,
            is_fulfilled: order.shipments && order.shipments.some(s => s.shipped_date),
            required_ship_date_parsed: order.required_ship_date ? new Date(order.required_ship_date) : null,
            backorder_info: backorderInfo
          },
          rawData: order,
          updatedAtRemote: order.updated_date ? new Date(order.updated_date) : null
        };

        await prisma.order.upsert({
          where: {
            brandId_externalId: {
              brandId,
              externalId: order.id
            }
          },
          update: {
            ...orderData,
            updatedAt: new Date()
          },
          create: {
            threeplId: brand.threeplId,
            brandId,
            externalId: order.id,
            ...orderData
          }
        });

        // Process order line items and shipments
        if (order.line_items && order.line_items.length > 0) {
          await this.syncOrderItems(brandId, order.id, order.line_items);
        }
        if (order.shipments && order.shipments.length > 0) {
          await this.syncOrderShipments(brandId, order.id, order.shipments);
        }
      }
      
      logger.info(`Reconciliation synced ${orders.length} orders for brand ${brandId}`);
    } catch (error) {
      logger.error(`Failed to sync orders for reconciliation for brand ${brandId}:`, error);
      throw error;
    }
  }

  private async syncShipmentsWithDateFilter(brandId: string, accessToken: string, fromDate: Date): Promise<void> {
    logger.info(`Syncing shipments for brand ${brandId} from ${fromDate.toISOString()}`);
    // Shipments are processed as part of orders, so this is a no-op
    logger.info(`Shipments are processed as part of orders for brand ${brandId} reconciliation`);
  }

  /**
   * Check if an order has backorder items by cross-referencing with inventory
   * If ANY line item has 0 available inventory, flag the entire order
   */
  private async checkBackorderStatus(brandId: string, lineItems: any[]): Promise<any> {
    const backorderInfo = {
      has_backorder_items: false,
      backorder_items: [],
      inventory_check_date: new Date().toISOString(),
      total_backorder_qty: 0
    };

    try {
      for (const lineItem of lineItems) {
        if (!lineItem.sku) continue;

        // Get the most recent inventory snapshot for this SKU
        const inventory = await prisma.inventorySnapshot.findFirst({
          where: {
            brandId,
            product: { 
              sku: lineItem.sku 
            }
          },
          orderBy: { createdAt: 'desc' }
        }).catch(() => null); // Handle case where product doesn't exist yet

        const availableQty = inventory?.quantityFulfillable || 0;
        const orderedQty = lineItem.quantity || 0;

        // If available inventory is 0 OR less than ordered quantity, flag as backorder
        if (availableQty === 0 || availableQty < orderedQty) {
          backorderInfo.has_backorder_items = true;
          const backorderQty = Math.max(0, orderedQty - availableQty);
          backorderInfo.total_backorder_qty += backorderQty;
          
          backorderInfo.backorder_items.push({
            sku: lineItem.sku,
            product_id: lineItem.product_id,
            ordered_qty: orderedQty,
            available_qty: availableQty,
            backorder_qty: backorderQty,
            reason: availableQty === 0 ? 'out_of_stock' : 'insufficient_inventory'
          });

          logger.info(`Backorder detected - SKU: ${lineItem.sku}, Ordered: ${orderedQty}, Available: ${availableQty}`);
        }
      }

      if (backorderInfo.has_backorder_items) {
        logger.info(`Order flagged as backorder - ${backorderInfo.backorder_items.length} items affected, total backorder qty: ${backorderInfo.total_backorder_qty}`);
      }

    } catch (error) {
      logger.error('Error checking backorder status:', error);
      // If we can't check inventory, assume no backorder to avoid false positives
    }

    return backorderInfo;
  }

  private mapOrderStatus(trackstarStatus: string, rawStatus?: string): 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED' {
    // Map Trackstar order statuses to our internal statuses
    // Use raw_status for more granular information if available
    
    const status = rawStatus || trackstarStatus;
    
    if (!status) return 'PENDING';
    
    const statusLower = status.toLowerCase();
    
    // Handle Trackstar-specific statuses based on the API response structure
            const statusMap: { [key: string]: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED' } = {
      // Standard statuses
      'pending': 'PENDING',
      'processing': 'PROCESSING',
      'shipped': 'SHIPPED',
      'delivered': 'DELIVERED',
      'cancelled': 'CANCELLED',
      'returned': 'RETURNED',
      
      // Trackstar-specific statuses from API
      'open': 'PENDING',
      'allocated': 'PROCESSING',
      'picked': 'PROCESSING',
      'packed': 'PROCESSING', // Packed but not yet shipped
      'fulfilled': 'SHIPPED',
      'complete': 'DELIVERED',
      'closed': 'DELIVERED',
      
      // Handle various fulfillment states
      'ready_to_ship': 'PROCESSING',
      'in_transit': 'SHIPPED',
      'out_for_delivery': 'SHIPPED'
    };

    return statusMap[statusLower] || 'PENDING';
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
        status: this.mapOrderStatus(data.status, data.fulfillment_status),
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
        status: this.mapOrderStatus(data.status, data.fulfillment_status),
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

    // Use our own sync methods instead of Trackstar's sync endpoint
    for (const func of functionsToSync) {
      try {
        logger.info(`Manual sync: ${func} for brand ${brandId}`);
        
        switch (func) {
          case 'products':
          case 'get_products':
            await this.syncProducts(brandId, integration.accessToken, true); // Full historical sync
            break;
          case 'inventory':
          case 'get_inventory':
            await this.syncInventory(brandId, integration.accessToken, true); // Full historical sync
            break;
          case 'orders':
          case 'get_orders':
            await this.syncOrders(brandId, integration.accessToken, true); // Full historical sync
            break;
          case 'shipments':
          case 'get_shipments':
            await this.syncShipments(brandId, integration.accessToken, true); // Full historical sync
            break;
          default:
            logger.warn(`Unknown sync function: ${func}`);
        }
      } catch (error) {
        logger.error(`Manual sync failed for ${func}:`, error);
        // Continue with other functions even if one fails
      }
    }
    
    // Update last synced timestamp
    await prisma.brandIntegration.update({
      where: { brandId_provider: { brandId, provider: 'TRACKSTAR' } },
      data: { lastSyncedAt: new Date() }
    });
  }

  async getSyncHealth(brandId: string): Promise<any> {
    const integration = await prisma.brandIntegration.findUnique({
      where: { brandId_provider: { brandId, provider: 'TRACKSTAR' } }
    });

    if (!integration) {
      throw new Error('Trackstar integration not found for this brand');
    }

    // Get connection details from Trackstar
    const connectionDetails = await trackstarClient.instance.getConnection(integration.accessToken);

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
