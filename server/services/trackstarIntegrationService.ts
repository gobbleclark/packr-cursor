/**
 * Trackstar Universal WMS API Integration Service
 * Replaces ShipHero with universal WMS connectivity via Trackstar
 */

import { IStorage } from '../storage';

interface TrackstarCredentials {
  apiKey: string;
  accessToken: string;
  connectionId: string;
}

interface TrackstarOrder {
  id: string;
  order_number: string;
  customer_name?: string;
  customer_email?: string;
  shipping_address?: any;
  status: string;
  total_amount: string;
  order_date: string;
  line_items: TrackstarLineItem[];
  tracking_number?: string;
  carrier?: string;
  shipped_at?: string;
  delivered_at?: string;
}

interface TrackstarLineItem {
  sku: string;
  product_name: string;
  quantity: number;
  unit_price: string;
  total_price: string;
}

interface TrackstarProduct {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price?: string;
  weight?: number;
  dimensions?: any;
  inventory_count?: number;
}

interface TrackstarInventory {
  sku: string;
  warehouse_name: string;
  on_hand: number;
  allocated: number;
  available: number;
  reserved: number;
}

export class TrackstarIntegrationService {
  private baseUrl = 'https://production.trackstarhq.com';
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Setup new brand with Trackstar integration
   */
  async setupBrandIntegration(brandId: string, credentials: TrackstarCredentials): Promise<void> {
    console.log(`🔗 Setting up Trackstar integration for brand: ${brandId}`);
    
    // Validate credentials
    await this.validateCredentials(credentials);
    
    // Store credentials securely
    await this.storage.updateBrand(brandId, {
      trackstarApiKey: credentials.apiKey,
      trackstarAccessToken: credentials.accessToken,
      trackstarConnectionId: credentials.connectionId,
      integrationStatus: 'connected'
    });
    
    // Initial data sync
    await this.performInitialSync(brandId, credentials);
    
    console.log(`✅ Trackstar integration setup complete for brand: ${brandId}`);
  }

  /**
   * Validate Trackstar API credentials
   */
  async validateCredentials(credentials: TrackstarCredentials): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/health`, {
        headers: {
          'x-trackstar-api-key': credentials.apiKey,
          'x-trackstar-access-token': credentials.accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Trackstar API validation failed: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('❌ Trackstar credential validation failed:', error);
      throw error;
    }
  }

  /**
   * Perform initial historical data sync
   */
  async performInitialSync(brandId: string, credentials: TrackstarCredentials): Promise<void> {
    console.log(`🔄 Starting initial Trackstar sync for brand: ${brandId}`);
    
    // Sync orders (last 30 days)
    await this.syncOrders(brandId, credentials, 30);
    
    // Sync products
    await this.syncProducts(brandId, credentials);
    
    // Sync inventory
    await this.syncInventory(brandId, credentials);
    
    console.log(`✅ Initial Trackstar sync complete for brand: ${brandId}`);
  }

  /**
   * Sync orders from Trackstar
   */
  async syncOrders(brandId: string, credentials: TrackstarCredentials, daysBack: number = 7): Promise<void> {
    console.log(`📦 Syncing orders from Trackstar (${daysBack} days)...`);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    
    try {
      const orders = await this.fetchTrackstarOrders(credentials, startDate);
      console.log(`📦 Retrieved ${orders.length} orders from Trackstar`);
      
      for (const order of orders) {
        await this.processTrackstarOrder(brandId, order);
      }
      
      console.log(`✅ Orders sync complete: processed ${orders.length} orders`);
    } catch (error) {
      console.error('❌ Orders sync failed:', error);
      throw error;
    }
  }

  /**
   * Fetch orders from Trackstar API
   */
  private async fetchTrackstarOrders(credentials: TrackstarCredentials, fromDate: Date): Promise<TrackstarOrder[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/orders`, {
      method: 'GET',
      headers: {
        'x-trackstar-api-key': credentials.apiKey,
        'x-trackstar-access-token': credentials.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        start_date: fromDate.toISOString(),
        limit: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`Trackstar orders API error: ${response.status}`);
    }

    const data = await response.json();
    return data.orders || [];
  }

  /**
   * Process individual Trackstar order
   */
  private async processTrackstarOrder(brandId: string, trackstarOrder: TrackstarOrder): Promise<void> {
    try {
      // Check if order already exists
      const existingOrder = await this.storage.getOrderByTrackstarId?.(trackstarOrder.id);
      
      if (existingOrder) {
        // Update existing order
        await this.updateExistingOrder(existingOrder, trackstarOrder);
        return;
      }

      // Create new order
      const orderData = {
        orderNumber: trackstarOrder.order_number,
        brandId,
        customerName: trackstarOrder.customer_name || null,
        customerEmail: trackstarOrder.customer_email || null,
        shippingAddress: trackstarOrder.shipping_address || {},
        status: this.mapTrackstarStatus(trackstarOrder.status) as any,
        totalAmount: trackstarOrder.total_amount || "0.00",
        
        // Trackstar specific fields
        trackstarOrderId: trackstarOrder.id,
        trackingNumber: trackstarOrder.tracking_number,
        carrier: trackstarOrder.carrier,
        
        // Timestamps
        orderDate: trackstarOrder.order_date ? new Date(trackstarOrder.order_date) : new Date(),
        shippedAt: trackstarOrder.shipped_at ? new Date(trackstarOrder.shipped_at) : null,
        deliveredAt: trackstarOrder.delivered_at ? new Date(trackstarOrder.delivered_at) : null,
        lastSyncAt: new Date(),
        
        // Quantities
        totalQuantity: trackstarOrder.line_items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
      };
      
      const createdOrder = await this.storage.createOrder(orderData);
      console.log(`➕ Created new Trackstar order: ${trackstarOrder.order_number}`);
      
      // Create order items
      if (trackstarOrder.line_items) {
        for (const item of trackstarOrder.line_items) {
          await this.storage.createOrderItem?.({
            orderId: createdOrder.id,
            trackstarLineItemId: item.sku, // Use SKU as identifier
            sku: item.sku,
            productName: item.product_name,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            totalPrice: item.total_price,
          });
        }
        console.log(`✅ Created ${trackstarOrder.line_items.length} line items`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to process order ${trackstarOrder.order_number}:`, error);
    }
  }

  /**
   * Sync products from Trackstar
   */
  async syncProducts(brandId: string, credentials: TrackstarCredentials): Promise<void> {
    console.log(`📦 Syncing products from Trackstar...`);
    
    try {
      const products = await this.fetchTrackstarProducts(credentials);
      console.log(`📦 Retrieved ${products.length} products from Trackstar`);
      
      for (const product of products) {
        await this.processTrackstarProduct(brandId, product);
      }
      
      console.log(`✅ Products sync complete: processed ${products.length} products`);
    } catch (error) {
      console.error('❌ Products sync failed:', error);
      throw error;
    }
  }

  /**
   * Fetch products from Trackstar API
   */
  private async fetchTrackstarProducts(credentials: TrackstarCredentials): Promise<TrackstarProduct[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/products`, {
      headers: {
        'x-trackstar-api-key': credentials.apiKey,
        'x-trackstar-access-token': credentials.accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Trackstar products API error: ${response.status}`);
    }

    const data = await response.json();
    return data.products || [];
  }

  /**
   * Process individual Trackstar product
   */
  private async processTrackstarProduct(brandId: string, trackstarProduct: TrackstarProduct): Promise<void> {
    try {
      const productData = {
        sku: trackstarProduct.sku,
        name: trackstarProduct.name,
        description: trackstarProduct.description,
        brandId,
        price: trackstarProduct.price || "0.00",
        weight: trackstarProduct.weight || 0,
        dimensions: trackstarProduct.dimensions || {},
        inventoryCount: trackstarProduct.inventory_count || 0,
        trackstarProductId: trackstarProduct.id,
        lastSyncAt: new Date(),
      };
      
      // Check if product exists
      const existingProduct = await this.storage.getProductBySku?.(trackstarProduct.sku, brandId);
      
      if (existingProduct) {
        await this.storage.updateProduct?.(existingProduct.id, productData);
        console.log(`🔄 Updated product: ${trackstarProduct.sku}`);
      } else {
        await this.storage.createProduct?.(productData);
        console.log(`➕ Created product: ${trackstarProduct.sku}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to process product ${trackstarProduct.sku}:`, error);
    }
  }

  /**
   * Sync inventory from Trackstar
   */
  async syncInventory(brandId: string, credentials: TrackstarCredentials): Promise<void> {
    console.log(`📦 Syncing inventory from Trackstar...`);
    
    try {
      const inventory = await this.fetchTrackstarInventory(credentials);
      console.log(`📦 Retrieved inventory for ${inventory.length} SKUs from Trackstar`);
      
      for (const item of inventory) {
        await this.processTrackstarInventory(brandId, item);
      }
      
      console.log(`✅ Inventory sync complete: processed ${inventory.length} items`);
    } catch (error) {
      console.error('❌ Inventory sync failed:', error);
      throw error;
    }
  }

  /**
   * Fetch inventory from Trackstar API
   */
  private async fetchTrackstarInventory(credentials: TrackstarCredentials): Promise<TrackstarInventory[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/inventory`, {
      headers: {
        'x-trackstar-api-key': credentials.apiKey,
        'x-trackstar-access-token': credentials.accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Trackstar inventory API error: ${response.status}`);
    }

    const data = await response.json();
    return data.inventory || [];
  }

  /**
   * Process individual inventory item
   */
  private async processTrackstarInventory(brandId: string, inventory: TrackstarInventory): Promise<void> {
    try {
      // Update product inventory count
      const product = await this.storage.getProductBySku?.(inventory.sku, brandId);
      if (product) {
        await this.storage.updateProduct?.(product.id, {
          inventoryCount: inventory.available,
          lastSyncAt: new Date()
        });
      }
      
      // Update warehouse-specific inventory if available
      await this.storage.upsertProductWarehouse?.({
        productSku: inventory.sku,
        warehouseName: inventory.warehouse_name,
        onHand: inventory.on_hand,
        allocated: inventory.allocated,
        available: inventory.available,
        reserved: inventory.reserved,
        lastSyncAt: new Date()
      });
      
    } catch (error) {
      console.error(`❌ Failed to process inventory for ${inventory.sku}:`, error);
    }
  }

  /**
   * Map Trackstar status to our internal status
   */
  private mapTrackstarStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'pending',
      'processing': 'processing',
      'fulfilled': 'fulfilled', 
      'shipped': 'shipped',
      'delivered': 'delivered',
      'cancelled': 'cancelled',
      'returned': 'returned'
    };
    
    return statusMap[status?.toLowerCase()] || 'pending';
  }

  /**
   * Update existing order with Trackstar data
   */
  private async updateExistingOrder(existingOrder: any, trackstarOrder: TrackstarOrder): Promise<void> {
    const updates = {
      status: this.mapTrackstarStatus(trackstarOrder.status) as any,
      trackingNumber: trackstarOrder.tracking_number,
      carrier: trackstarOrder.carrier,
      shippedAt: trackstarOrder.shipped_at ? new Date(trackstarOrder.shipped_at) : null,
      deliveredAt: trackstarOrder.delivered_at ? new Date(trackstarOrder.delivered_at) : null,
      lastSyncAt: new Date()
    };
    
    await this.storage.updateOrder(existingOrder.id, updates);
    console.log(`🔄 Updated Trackstar order: ${trackstarOrder.order_number}`);
  }

  /**
   * Incremental sync for new orders
   */
  async performIncrementalSync(brandId: string): Promise<void> {
    const brand = await this.storage.getBrand(brandId);
    if (!brand?.trackstarAccessToken) {
      throw new Error('Trackstar credentials not found for brand');
    }

    const credentials: TrackstarCredentials = {
      apiKey: brand.trackstarApiKey!,
      accessToken: brand.trackstarAccessToken!,
      connectionId: brand.trackstarConnectionId!
    };

    // Sync orders from last 24 hours
    await this.syncOrders(brandId, credentials, 1);
  }

  /**
   * Process webhook data from Trackstar
   */
  async processWebhook(webhookData: any): Promise<void> {
    console.log('📡 Processing Trackstar webhook:', webhookData.type);
    
    switch (webhookData.type) {
      case 'order.updated':
        await this.handleOrderUpdate(webhookData.data);
        break;
      case 'inventory.updated':
        await this.handleInventoryUpdate(webhookData.data);
        break;
      case 'shipment.created':
        await this.handleShipmentUpdate(webhookData.data);
        break;
      default:
        console.log(`⚠️ Unhandled webhook type: ${webhookData.type}`);
    }
  }

  /**
   * Handle order update webhook
   */
  private async handleOrderUpdate(orderData: any): Promise<void> {
    try {
      const existingOrder = await this.storage.getOrderByTrackstarId?.(orderData.id);
      if (existingOrder) {
        await this.updateExistingOrder(existingOrder, orderData);
      }
    } catch (error) {
      console.error('❌ Failed to handle order update webhook:', error);
    }
  }

  /**
   * Handle inventory update webhook
   */
  private async handleInventoryUpdate(inventoryData: any): Promise<void> {
    try {
      await this.processTrackstarInventory(inventoryData.brand_id, inventoryData);
    } catch (error) {
      console.error('❌ Failed to handle inventory update webhook:', error);
    }
  }

  /**
   * Handle shipment update webhook
   */
  private async handleShipmentUpdate(shipmentData: any): Promise<void> {
    try {
      const order = await this.storage.getOrderByTrackstarId?.(shipmentData.order_id);
      if (order) {
        await this.storage.updateOrder(order.id, {
          status: 'shipped' as any,
          trackingNumber: shipmentData.tracking_number,
          carrier: shipmentData.carrier,
          shippedAt: new Date(shipmentData.shipped_at),
          lastSyncAt: new Date()
        });
        console.log(`📦 Updated shipment for order: ${order.orderNumber}`);
      }
    } catch (error) {
      console.error('❌ Failed to handle shipment update webhook:', error);
    }
  }
}