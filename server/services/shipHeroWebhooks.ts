import { storage } from '../storage';
import ShipHeroSyncService from './shipHeroSync';

/**
 * ShipHero Webhook Handler
 * Processes real-time webhooks for immediate data synchronization
 */

interface WebhookEvent {
  id: string;
  event: string;
  data: any;
  created_at: string;
}

export class ShipHeroWebhookService {
  
  // All available ShipHero webhook events
  static readonly WEBHOOK_EVENTS = {
    // Order events
    ORDER_CREATED: 'order.created',
    ORDER_UPDATED: 'order.updated',
    ORDER_CANCELED: 'order.canceled',
    ORDER_ALLOCATED: 'order.allocated',
    ORDER_PACKED: 'order.packed',
    ORDER_SHIPPED: 'order.shipped',
    ORDER_DELIVERED: 'order.delivered',
    
    // Shipment events
    SHIPMENT_CREATED: 'shipment.created',
    SHIPMENT_UPDATED: 'shipment.updated',
    SHIPMENT_SHIPPED: 'shipment.shipped',
    SHIPMENT_DELIVERED: 'shipment.delivered',
    SHIPMENT_EXCEPTION: 'shipment.exception',
    SHIPMENT_RETURNED: 'shipment.returned',
    
    // Inventory events
    INVENTORY_UPDATED: 'inventory.updated',
    INVENTORY_ALLOCATED: 'inventory.allocated',
    INVENTORY_DEALLOCATED: 'inventory.deallocated',
    INVENTORY_RESERVED: 'inventory.reserved',
    INVENTORY_UNRESERVED: 'inventory.unreserved',
    INVENTORY_RECEIVED: 'inventory.received',
    INVENTORY_ADJUSTED: 'inventory.adjusted',
    
    // Product events
    PRODUCT_CREATED: 'product.created',
    PRODUCT_UPDATED: 'product.updated',
    PRODUCT_DELETED: 'product.deleted',
    
    // Returns events
    RETURN_CREATED: 'return.created',
    RETURN_UPDATED: 'return.updated',
    RETURN_PROCESSED: 'return.processed'
  };

  async processWebhook(brandId: string, webhookEvent: WebhookEvent): Promise<void> {
    const brand = await storage.getBrand(brandId);
    if (!brand || !brand.shipHeroApiKey) {
      console.error(`Brand ${brandId} not found or missing credentials`);
      return;
    }

    console.log(`Processing webhook: ${webhookEvent.event} for brand ${brand.name}`);

    try {
      switch (webhookEvent.event) {
        // Order webhooks - highest priority
        case this.WEBHOOK_EVENTS.ORDER_CREATED:
        case this.WEBHOOK_EVENTS.ORDER_UPDATED:
          await this.handleOrderWebhook(brand, webhookEvent);
          break;

        case this.WEBHOOK_EVENTS.ORDER_SHIPPED:
        case this.WEBHOOK_EVENTS.ORDER_DELIVERED:
          await this.handleOrderStatusWebhook(brand, webhookEvent);
          break;

        // Shipment webhooks - critical for tracking
        case this.WEBHOOK_EVENTS.SHIPMENT_CREATED:
        case this.WEBHOOK_EVENTS.SHIPMENT_UPDATED:
        case this.WEBHOOK_EVENTS.SHIPMENT_SHIPPED:
        case this.WEBHOOK_EVENTS.SHIPMENT_DELIVERED:
        case this.WEBHOOK_EVENTS.SHIPMENT_EXCEPTION:
          await this.handleShipmentWebhook(brand, webhookEvent);
          break;

        // Inventory webhooks - real-time stock updates
        case this.WEBHOOK_EVENTS.INVENTORY_UPDATED:
        case this.WEBHOOK_EVENTS.INVENTORY_ALLOCATED:
        case this.WEBHOOK_EVENTS.INVENTORY_DEALLOCATED:
        case this.WEBHOOK_EVENTS.INVENTORY_RECEIVED:
        case this.WEBHOOK_EVENTS.INVENTORY_ADJUSTED:
          await this.handleInventoryWebhook(brand, webhookEvent);
          break;

        // Product webhooks
        case this.WEBHOOK_EVENTS.PRODUCT_CREATED:
        case this.WEBHOOK_EVENTS.PRODUCT_UPDATED:
          await this.handleProductWebhook(brand, webhookEvent);
          break;

        default:
          console.log(`Unhandled webhook event: ${webhookEvent.event}`);
      }

      // Log successful webhook processing
      console.log(`✅ Successfully processed ${webhookEvent.event} for brand ${brand.name}`);

    } catch (error) {
      console.error(`❌ Failed to process webhook ${webhookEvent.event} for brand ${brand.name}:`, error);
      
      // Store failed webhook for retry
      await this.logFailedWebhook(brandId, webhookEvent, error.message);
    }
  }

  private async handleOrderWebhook(brand: any, webhookEvent: WebhookEvent): Promise<void> {
    const orderData = webhookEvent.data;
    
    // Check if order already exists
    const existingOrder = await storage.getOrderByShipHeroId(orderData.id);
    
    const orderPayload = {
      orderNumber: orderData.order_number,
      brandId: brand.id,
      customerName: `${orderData.shipping_address?.first_name || ''} ${orderData.shipping_address?.last_name || ''}`.trim(),
      customerEmail: orderData.email,
      shippingAddress: orderData.shipping_address,
      billingAddress: orderData.billing_address,
      status: this.mapOrderStatus(orderData.fulfillment_status),
      totalAmount: parseFloat(orderData.subtotal || '0'),
      shippingMethod: orderData.shipping_method?.name,
      trackingNumber: orderData.tracking_number,
      shipHeroOrderId: orderData.id,
      orderItems: orderData.line_items || [],
      lastSyncAt: new Date(),
      createdAt: new Date(orderData.created_at),
      updatedAt: new Date()
    };

    if (existingOrder) {
      await storage.updateOrder(existingOrder.id, orderPayload);
      console.log(`📦 Updated order ${orderData.order_number} via webhook`);
    } else {
      await storage.createOrder(orderPayload);
      console.log(`📦 Created order ${orderData.order_number} via webhook`);
    }
  }

  private async handleOrderStatusWebhook(brand: any, webhookEvent: WebhookEvent): Promise<void> {
    const orderData = webhookEvent.data;
    const existingOrder = await storage.getOrderByShipHeroId(orderData.id);
    
    if (existingOrder) {
      await storage.updateOrder(existingOrder.id, {
        status: webhookEvent.event.includes('shipped') ? 'shipped' : 'delivered',
        trackingNumber: orderData.tracking_number,
        updatedAt: new Date(),
        lastSyncAt: new Date()
      });
      
      console.log(`📦 Updated order ${orderData.order_number} status to ${webhookEvent.event}`);
    }
  }

  private async handleShipmentWebhook(brand: any, webhookEvent: WebhookEvent): Promise<void> {
    const shipmentData = webhookEvent.data;
    
    // Find the corresponding order
    const order = await storage.getOrderByShipHeroId(shipmentData.order_id);
    if (!order) {
      console.error(`Order not found for shipment ${shipmentData.id}`);
      return;
    }

    const existingShipment = await storage.getShipmentByShipHeroId(shipmentData.id);
    
    const shipmentPayload = {
      orderId: order.id,
      brandId: brand.id,
      shipHeroShipmentId: shipmentData.id,
      trackingNumber: shipmentData.tracking_number,
      carrier: shipmentData.carrier,
      service: shipmentData.service,
      status: this.mapShipmentStatus(webhookEvent.event),
      shippedAt: shipmentData.shipped_date ? new Date(shipmentData.shipped_date) : null,
      estimatedDelivery: shipmentData.estimated_delivery_date ? new Date(shipmentData.estimated_delivery_date) : null,
      actualDelivery: shipmentData.delivered_date ? new Date(shipmentData.delivered_date) : null,
      createdAt: new Date(shipmentData.created_at || Date.now()),
      updatedAt: new Date()
    };

    if (existingShipment) {
      await storage.updateShipment(existingShipment.id, shipmentPayload);
      console.log(`🚚 Updated shipment ${shipmentData.id} via webhook`);
    } else {
      await storage.createShipment(shipmentPayload);
      console.log(`🚚 Created shipment ${shipmentData.id} via webhook`);
    }

    // Update order tracking if shipment is shipped
    if (webhookEvent.event === this.WEBHOOK_EVENTS.SHIPMENT_SHIPPED) {
      await storage.updateOrder(order.id, {
        status: 'shipped',
        trackingNumber: shipmentData.tracking_number,
        updatedAt: new Date()
      });
    }
  }

  private async handleInventoryWebhook(brand: any, webhookEvent: WebhookEvent): Promise<void> {
    const inventoryData = webhookEvent.data;
    
    // Find product by SKU
    const products = await storage.getProductsByBrand(brand.id);
    const product = products.find(p => p.sku === inventoryData.sku);
    
    if (!product) {
      console.error(`Product not found for SKU ${inventoryData.sku}`);
      return;
    }

    // Update inventory levels immediately
    await storage.updateProductInventory(product.id, {
      quantity: inventoryData.available_quantity || 0,
      reservedQuantity: inventoryData.allocated_quantity || 0,
      lastSyncAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`📊 Updated inventory for ${inventoryData.sku}: ${inventoryData.available_quantity} available`);
  }

  private async handleProductWebhook(brand: any, webhookEvent: WebhookEvent): Promise<void> {
    const productData = webhookEvent.data;
    
    const existingProduct = await storage.getProductByShipHeroId(productData.id);
    
    const productPayload = {
      sku: productData.sku,
      name: productData.name,
      description: productData.description,
      brandId: brand.id,
      price: parseFloat(productData.price || '0'),
      weight: parseFloat(productData.weight || '0'),
      dimensions: productData.dimensions,
      shipHeroProductId: productData.id,
      barcode: productData.barcode,
      hsCode: productData.hs_code,
      countryOfOrigin: productData.country_of_origin,
      lastSyncAt: new Date(),
      createdAt: new Date(productData.created_at || Date.now()),
      updatedAt: new Date()
    };

    if (existingProduct) {
      await storage.updateProduct(existingProduct.id, productPayload);
      console.log(`📦 Updated product ${productData.sku} via webhook`);
    } else {
      await storage.createProduct(productPayload);
      console.log(`📦 Created product ${productData.sku} via webhook`);
    }
  }

  private async logFailedWebhook(brandId: string, webhookEvent: WebhookEvent, error: string): Promise<void> {
    // Store failed webhook for retry later
    console.error(`Failed webhook logged for brand ${brandId}:`, {
      event: webhookEvent.event,
      id: webhookEvent.id,
      error
    });
  }

  private mapOrderStatus(shipHeroStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'pending',
      'submitted': 'processing',
      'processing': 'processing',
      'shipped': 'shipped',
      'delivered': 'delivered',
      'cancelled': 'cancelled',
      'exception': 'pending'
    };
    return statusMap[shipHeroStatus] || 'pending';
  }

  private mapShipmentStatus(eventType: string): string {
    if (eventType.includes('shipped')) return 'shipped';
    if (eventType.includes('delivered')) return 'delivered';
    if (eventType.includes('exception')) return 'exception';
    if (eventType.includes('returned')) return 'returned';
    return 'pending';
  }

  // Setup webhook URLs for a brand
  async setupWebhooksForBrand(brandId: string): Promise<string[]> {
    const brand = await storage.getBrand(brandId);
    if (!brand || !brand.shipHeroApiKey) {
      throw new Error('Brand not found or missing credentials');
    }

    const webhookUrl = `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}/api/webhooks/shiphero/${brandId}`;
    
    // List of all webhooks to register
    const webhooksToRegister = [
      // Critical order events
      this.WEBHOOK_EVENTS.ORDER_CREATED,
      this.WEBHOOK_EVENTS.ORDER_UPDATED,
      this.WEBHOOK_EVENTS.ORDER_SHIPPED,
      this.WEBHOOK_EVENTS.ORDER_DELIVERED,
      
      // Shipment tracking events
      this.WEBHOOK_EVENTS.SHIPMENT_CREATED,
      this.WEBHOOK_EVENTS.SHIPMENT_UPDATED,
      this.WEBHOOK_EVENTS.SHIPMENT_SHIPPED,
      this.WEBHOOK_EVENTS.SHIPMENT_DELIVERED,
      this.WEBHOOK_EVENTS.SHIPMENT_EXCEPTION,
      
      // Real-time inventory updates
      this.WEBHOOK_EVENTS.INVENTORY_UPDATED,
      this.WEBHOOK_EVENTS.INVENTORY_ALLOCATED,
      this.WEBHOOK_EVENTS.INVENTORY_DEALLOCATED,
      this.WEBHOOK_EVENTS.INVENTORY_RECEIVED,
      this.WEBHOOK_EVENTS.INVENTORY_ADJUSTED,
      
      // Product changes
      this.WEBHOOK_EVENTS.PRODUCT_CREATED,
      this.WEBHOOK_EVENTS.PRODUCT_UPDATED
    ];

    console.log(`Setting up ${webhooksToRegister.length} webhooks for brand ${brand.name}`);
    console.log(`Webhook URL: ${webhookUrl}`);

    // In production, you would make API calls to ShipHero to register these webhooks
    // For now, return the list of webhooks that should be registered
    return webhooksToRegister;
  }
}

export const shipHeroWebhookService = new ShipHeroWebhookService();
export default ShipHeroWebhookService;