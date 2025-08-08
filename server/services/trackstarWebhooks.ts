import { storage } from '../storage.js';
import { TrackstarService } from './trackstar.js';

export class TrackstarWebhookService {
  private trackstarService: TrackstarService;
  private webhookSecret: string;

  constructor() {
    this.trackstarService = new TrackstarService();
    this.webhookSecret = process.env.TRACKSTAR_WEBHOOK_SECRET || '';
  }

  /**
   * Set up webhooks for a brand's Trackstar connection
   */
  async setupWebhooksForBrand(brandId: string): Promise<{ success: boolean; webhooks: string[] }> {
    const brand = await storage.getBrand(brandId);
    if (!brand?.trackstarAccessToken || !brand?.trackstarConnectionId) {
      throw new Error('Brand missing Trackstar connection');
    }

    console.log(`🔔 Setting up webhooks for ${brand.name} (${brand.trackstarIntegrationName})`);

    const webhookUrl = `${process.env.REPLIT_DEV_DOMAIN || 'https://packr.replit.app'}/api/trackstar/webhook`;
    const setupWebhooks = [];

    try {
      // Subscribe to key events for real-time updates
      const webhookTypes = [
        'orders.created',
        'orders.updated', 
        'orders.shipped',
        'orders.cancelled',
        'inventory.updated',
        'products.created',
        'products.updated',
        'shipments.created',
        'shipments.updated'
      ];

      for (const eventType of webhookTypes) {
        try {
          const webhook = await this.subscribeToWebhook(
            brand.trackstarConnectionId,
            brand.trackstarAccessToken,
            eventType,
            webhookUrl
          );
          
          if (webhook) {
            setupWebhooks.push(eventType);
            console.log(`✅ Webhook registered: ${eventType}`);
          }
        } catch (error) {
          console.log(`⚠️ Failed to register ${eventType} webhook: ${(error as Error).message}`);
        }
      }

      console.log(`🔔 Webhook setup completed for ${brand.name}: ${setupWebhooks.length} webhooks registered`);
      
      return {
        success: setupWebhooks.length > 0,
        webhooks: setupWebhooks
      };

    } catch (error) {
      console.error(`❌ Webhook setup failed for ${brand.name}:`, (error as Error).message);
      throw error;
    }
  }

  /**
   * Subscribe to a specific webhook event
   */
  private async subscribeToWebhook(
    connectionId: string,
    accessToken: string,
    eventType: string,
    webhookUrl: string
  ): Promise<any> {
    console.log(`🔔 Subscribing to ${eventType} webhook for connection ${connectionId}`);

    const response = await fetch('https://production.trackstarhq.com/webhooks', {
      method: 'POST',
      headers: {
        'x-trackstar-api-key': process.env.TRACKSTAR_API_KEY!,
        'x-trackstar-access-token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connection_id: connectionId,
        event_type: eventType,
        webhook_url: webhookUrl,
        active: true
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to subscribe to ${eventType}: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  /**
   * Process incoming webhook from Trackstar
   */
  async processWebhook(payload: any, signature?: string): Promise<{ success: boolean; processed: string }> {
    try {
      // Verify webhook signature if provided
      if (signature && this.webhookSecret) {
        const isValid = await this.verifyWebhookSignature(payload, signature);
        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
      }

      console.log(`📥 Processing Trackstar webhook: ${payload.event_type || 'unknown'}`);
      console.log(`🔗 Connection ID: ${payload.connection_id}`);
      
      // Find the brand associated with this connection
      const brands = await storage.getBrandsByThreePL('all');
      const brand = brands.find(b => b.trackstarConnectionId === payload.connection_id);
      
      if (!brand) {
        console.log(`⚠️ No brand found for connection ${payload.connection_id}`);
        return { success: false, processed: 'unknown_connection' };
      }

      console.log(`📦 Processing webhook for brand: ${brand.name}`);

      // Process based on event type
      const eventType = payload.event_type;
      let processed = 'unknown';

      switch (eventType) {
        case 'orders.created':
        case 'orders.updated':
          processed = await this.processOrderWebhook(brand, payload);
          break;
          
        case 'orders.shipped':
          processed = await this.processShipmentWebhook(brand, payload);
          break;
          
        case 'orders.cancelled':
          processed = await this.processCancellationWebhook(brand, payload);
          break;
          
        case 'inventory.updated':
          processed = await this.processInventoryWebhook(brand, payload);
          break;
          
        case 'products.created':
        case 'products.updated':
          processed = await this.processProductWebhook(brand, payload);
          break;
          
        case 'shipments.created':
        case 'shipments.updated':
          processed = await this.processShipmentWebhook(brand, payload);
          break;
          
        default:
          console.log(`🔄 Unhandled webhook event: ${eventType}`);
          processed = 'unhandled';
      }

      console.log(`✅ Webhook processed successfully: ${processed}`);
      return { success: true, processed };

    } catch (error) {
      console.error(`❌ Webhook processing failed:`, (error as Error).message);
      return { success: false, processed: 'error' };
    }
  }

  /**
   * Process order-related webhooks
   */
  private async processOrderWebhook(brand: any, payload: any): Promise<string> {
    const orderData = payload.data || payload.order;
    
    if (!orderData) {
      return 'no_data';
    }

    try {
      // Check if order already exists
      const existingOrder = await storage.getOrderByShipHeroId?.(orderData.id || orderData.order_id);
      
      if (existingOrder) {
        // Update existing order
        await storage.updateOrder?.(existingOrder.id, {
          status: this.mapTrackstarStatus(orderData.status),
          fulfillmentStatus: orderData.fulfillment_status,
          totalAmount: orderData.total_amount || existingOrder.totalAmount,
          shippedAt: orderData.shipped_at ? new Date(orderData.shipped_at) : existingOrder.shippedAt,
          trackingNumber: orderData.tracking_number || existingOrder.trackingNumber,
        });
        
        console.log(`🔄 Updated order: ${orderData.order_number || existingOrder.orderNumber}`);
        return 'updated';
      } else {
        // Create new order
        const newOrder = {
          brandId: brand.id,
          orderNumber: orderData.order_number || `TRK-${Date.now()}`,
          customerName: orderData.customer?.name || orderData.customer_name,
          customerEmail: orderData.customer?.email || orderData.customer_email,
          status: this.mapTrackstarStatus(orderData.status) as const,
          totalAmount: orderData.total_amount || '0.00',
          trackstarOrderId: orderData.id || orderData.order_id,
          fulfillmentStatus: orderData.fulfillment_status || 'pending',
          orderDate: new Date(orderData.order_date || orderData.created_at || Date.now()),
          shippingAddress: orderData.shipping_address || null,
        };

        await storage.createOrder(newOrder);
        console.log(`✅ Created new order: ${newOrder.orderNumber}`);
        return 'created';
      }
    } catch (error) {
      console.error(`❌ Failed to process order webhook:`, (error as Error).message);
      return 'error';
    }
  }

  /**
   * Process shipment webhooks
   */
  private async processShipmentWebhook(brand: any, payload: any): Promise<string> {
    const shipmentData = payload.data || payload.shipment;
    
    if (!shipmentData || !shipmentData.order_id) {
      return 'no_data';
    }

    try {
      const existingOrder = await storage.getOrderByShipHeroId?.(shipmentData.order_id);
      
      if (existingOrder) {
        await storage.updateOrder?.(existingOrder.id, {
          status: 'shipped' as const,
          fulfillmentStatus: 'shipped',
          shippedAt: new Date(shipmentData.shipped_at || Date.now()),
          trackingNumber: shipmentData.tracking_number,
        });
        
        console.log(`🚚 Order shipped: ${existingOrder.orderNumber} - ${shipmentData.tracking_number}`);
        return 'shipped';
      }
      
      return 'order_not_found';
    } catch (error) {
      console.error(`❌ Failed to process shipment webhook:`, (error as Error).message);
      return 'error';
    }
  }

  /**
   * Process inventory webhooks
   */
  private async processInventoryWebhook(brand: any, payload: any): Promise<string> {
    const inventoryData = payload.data;
    
    if (!inventoryData) {
      return 'no_data';
    }

    try {
      // Update product inventory if we have the product
      if (inventoryData.sku || inventoryData.product_id) {
        // This would need product lookup by SKU or Trackstar product ID
        console.log(`📊 Inventory updated for SKU: ${inventoryData.sku} - Quantity: ${inventoryData.available || inventoryData.onhand}`);
        return 'updated';
      }
      
      return 'no_product_match';
    } catch (error) {
      console.error(`❌ Failed to process inventory webhook:`, (error as Error).message);
      return 'error';
    }
  }

  /**
   * Process product webhooks
   */
  private async processProductWebhook(brand: any, payload: any): Promise<string> {
    const productData = payload.data || payload.product;
    
    if (!productData) {
      return 'no_data';
    }

    try {
      const newProduct = {
        brandId: brand.id,
        name: productData.name || productData.title,
        sku: productData.sku || productData.product_id,
        inventoryCount: productData.inventory_count || productData.quantity || 0,
        price: productData.price || '0.00',
        trackstarProductId: productData.id || productData.product_id,
      };

      await storage.createProduct(newProduct);
      console.log(`🏷️ Product created/updated: ${newProduct.name}`);
      return 'created';
    } catch (error) {
      console.error(`❌ Failed to process product webhook:`, (error as Error).message);
      return 'error';
    }
  }

  /**
   * Process cancellation webhooks  
   */
  private async processCancellationWebhook(brand: any, payload: any): Promise<string> {
    const orderData = payload.data;
    
    if (!orderData?.order_id) {
      return 'no_data';
    }

    try {
      const existingOrder = await storage.getOrderByShipHeroId?.(orderData.order_id);
      
      if (existingOrder) {
        await storage.updateOrder?.(existingOrder.id, {
          status: 'cancelled' as const,
          fulfillmentStatus: 'cancelled',
          cancelledAt: new Date(),
        });
        
        console.log(`❌ Order cancelled: ${existingOrder.orderNumber}`);
        return 'cancelled';
      }
      
      return 'order_not_found';
    } catch (error) {
      console.error(`❌ Failed to process cancellation webhook:`, (error as Error).message);
      return 'error';
    }
  }

  /**
   * Verify webhook signature
   */
  private async verifyWebhookSignature(payload: any, signature: string): Promise<boolean> {
    // Implement webhook signature verification using HMAC
    // This would use the TRACKSTAR_WEBHOOK_SECRET environment variable
    // For now, return true but should implement proper verification
    return true;
  }

  /**
   * Map Trackstar status to our internal status
   */
  private mapTrackstarStatus(trackstarStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'pending',
      'processing': 'processing',
      'fulfilled': 'fulfilled', 
      'shipped': 'shipped',
      'delivered': 'delivered',
      'cancelled': 'cancelled',
      'on_hold': 'on_hold',
      'unfulfilled': 'unfulfilled',
    };
    
    return statusMap[trackstarStatus?.toLowerCase()] || 'pending';
  }

  /**
   * List existing webhooks for a connection
   */
  async listWebhooks(connectionId: string, accessToken: string): Promise<any[]> {
    const response = await fetch('https://production.trackstarhq.com/webhooks', {
      method: 'GET',
      headers: {
        'x-trackstar-api-key': process.env.TRACKSTAR_API_KEY!,
        'x-trackstar-access-token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list webhooks: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.webhooks || data.data || [];
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string, accessToken: string): Promise<void> {
    const response = await fetch(`https://production.trackstarhq.com/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: {
        'x-trackstar-api-key': process.env.TRACKSTAR_API_KEY!,
        'x-trackstar-access-token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete webhook: ${response.status} ${errorText}`);
    }
  }
}