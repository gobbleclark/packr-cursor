import { storage } from '../storage';
import { db } from '../db';
import { orders, products, shipments } from '@shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';

interface ShipHeroConfig {
  username: string;
  password: string;
  userId?: string;
  baseUrl: string;
  rateLimit: {
    requestsPerMinute: number;
    burstCapacity: number;
  };
}

interface SyncResult {
  orders: { created: number; updated: number };
  products: { created: number; updated: number };
  shipments: { created: number; updated: number };
  warehouses: { created: number; updated: number };
  inventory: { updated: number };
  errors: string[];
}

class RateLimiter {
  private requests: Date[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(requestsPerMinute: number = 60) {
    this.maxRequests = requestsPerMinute;
    this.windowMs = 60 * 1000; // 1 minute
  }

  async canMakeRequest(): Promise<boolean> {
    const now = new Date();
    // Remove requests older than window
    this.requests = this.requests.filter(
      req => now.getTime() - req.getTime() < this.windowMs
    );
    
    return this.requests.length < this.maxRequests;
  }

  async waitForAvailability(): Promise<void> {
    while (!(await this.canMakeRequest())) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    this.requests.push(new Date());
  }
}

export class ShipHeroSyncService {
  private rateLimiter: RateLimiter;
  private config: ShipHeroConfig;

  constructor(brandConfig: any) {
    this.config = {
      username: brandConfig.shipHeroApiKey,
      password: brandConfig.shipHeroPassword,
      userId: brandConfig.shipHeroUserId,
      baseUrl: 'https://public-api.shiphero.com/v1',
      rateLimit: {
        requestsPerMinute: 50, // Conservative limit
        burstCapacity: 10
      }
    };
    this.rateLimiter = new RateLimiter(this.config.rateLimit.requestsPerMinute);
  }

  private async makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    await this.rateLimiter.waitForAvailability();
    
    const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
    
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`ShipHero API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async syncAllData(brandId: string, lastSyncTime?: Date): Promise<SyncResult> {
    const result: SyncResult = {
      orders: { created: 0, updated: 0 },
      products: { created: 0, updated: 0 },
      shipments: { created: 0, updated: 0 },
      warehouses: { created: 0, updated: 0 },
      inventory: { updated: 0 },
      errors: []
    };

    try {
      // Get last sync time or default to 24 hours ago
      const since = lastSyncTime || new Date(Date.now() - 24 * 60 * 60 * 1000);
      const sinceIso = since.toISOString();

      console.log(`Starting comprehensive sync for brand ${brandId} since ${sinceIso}`);

      // Sync orders (most critical)
      await this.syncOrders(brandId, sinceIso, result);
      
      // Sync shipments
      await this.syncShipments(brandId, sinceIso, result);
      
      // Sync products and inventory
      await this.syncProducts(brandId, sinceIso, result);
      
      // Sync warehouses
      await this.syncWarehouses(brandId, result);
      
      // Update inventory levels
      await this.syncInventoryLevels(brandId, result);

      console.log(`Sync completed for brand ${brandId}:`, result);
      return result;

    } catch (error) {
      console.error(`Sync failed for brand ${brandId}:`, error);
      result.errors.push(`Sync failed: ${error.message}`);
      return result;
    }
  }

  private async syncOrders(brandId: string, since: string, result: SyncResult): Promise<void> {
    try {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.makeAuthenticatedRequest(
          `/orders?created_from=${since}&page=${page}&per_page=100`
        );

        if (!response.data || response.data.length === 0) {
          hasMore = false;
          break;
        }

        for (const orderData of response.data) {
          await this.processOrder(brandId, orderData, result);
        }

        hasMore = response.data.length === 100;
        page++;
        
        // Add small delay between pages to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      result.errors.push(`Order sync failed: ${error.message}`);
    }
  }

  private async processOrder(brandId: string, orderData: any, result: SyncResult): Promise<void> {
    try {
      // DUPLICATE PREVENTION: Check if order already exists using ShipHero's unique order ID
      const existingOrder = await storage.getOrderByShipHeroId(orderData.id.toString());
      
      const orderPayload = {
        orderNumber: orderData.order_number,
        brandId,
        customerName: `${orderData.shipping_address?.first_name || ''} ${orderData.shipping_address?.last_name || ''}`.trim(),
        customerEmail: orderData.email,
        shippingAddress: orderData.shipping_address,
        billingAddress: orderData.billing_address,
        status: this.mapOrderStatus(orderData.fulfillment_status),
        totalAmount: parseFloat(orderData.subtotal || '0'),
        shippingMethod: orderData.shipping_method?.name,
        trackingNumber: orderData.tracking_number,
        shipHeroOrderId: orderData.id.toString(), // Ensure string format for consistency
        orderItems: orderData.line_items || [],
        createdAt: new Date(orderData.created_at),
        updatedAt: new Date(orderData.updated_at || orderData.created_at)
      };

      if (existingOrder) {
        // Update existing order only if data has changed
        const needsUpdate = this.hasOrderChanged(existingOrder, orderPayload);
        if (needsUpdate) {
          await storage.updateOrder(existingOrder.id, orderPayload);
          result.orders.updated++;
        } else {
          // Track duplicates skipped for reporting
          if (!result.orders.duplicatesSkipped) result.orders.duplicatesSkipped = 0;
          result.orders.duplicatesSkipped++;
        }
      } else {
        // Create new order  
        await storage.createOrder(orderPayload);
        result.orders.created++;
      }
    } catch (error) {
      result.errors.push(`Failed to process order ${orderData.order_number}: ${error.message}`);
    }
  }

  private hasOrderChanged(existingOrder: any, newOrderData: any): boolean {
    // Compare key fields to determine if update is needed
    return (
      existingOrder.status !== newOrderData.status ||
      existingOrder.trackingNumber !== newOrderData.trackingNumber ||
      existingOrder.totalAmount !== newOrderData.totalAmount ||
      new Date(existingOrder.updatedAt).getTime() < new Date(newOrderData.updatedAt).getTime()
    );
  }

  private async syncShipments(brandId: string, since: string, result: SyncResult): Promise<void> {
    try {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.makeAuthenticatedRequest(
          `/shipments?created_from=${since}&page=${page}&per_page=100`
        );

        if (!response.data || response.data.length === 0) {
          hasMore = false;
          break;
        }

        for (const shipmentData of response.data) {
          await this.processShipment(brandId, shipmentData, result);
        }

        hasMore = response.data.length === 100;
        page++;
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      result.errors.push(`Shipment sync failed: ${error.message}`);
    }
  }

  private async processShipment(brandId: string, shipmentData: any, result: SyncResult): Promise<void> {
    try {
      // Find the corresponding order
      const order = await storage.getOrderByShipHeroId(shipmentData.order_id);
      if (!order) {
        result.errors.push(`Order not found for shipment ${shipmentData.id}`);
        return;
      }

      const existingShipment = await storage.getShipmentByShipHeroId(shipmentData.id);
      
      const shipmentPayload = {
        orderId: order.id,
        brandId,
        shipHeroShipmentId: shipmentData.id,
        trackingNumber: shipmentData.tracking_number,
        carrier: shipmentData.carrier,
        service: shipmentData.service,
        status: this.mapShipmentStatus(shipmentData.status),
        shippedAt: shipmentData.shipped_date ? new Date(shipmentData.shipped_date) : null,
        estimatedDelivery: shipmentData.estimated_delivery_date ? new Date(shipmentData.estimated_delivery_date) : null,
        actualDelivery: shipmentData.delivered_date ? new Date(shipmentData.delivered_date) : null,
        createdAt: new Date(shipmentData.created_at),
        updatedAt: new Date(shipmentData.updated_at || shipmentData.created_at)
      };

      if (existingShipment) {
        await storage.updateShipment(existingShipment.id, shipmentPayload);
        result.shipments.updated++;
      } else {
        await storage.createShipment(shipmentPayload);
        result.shipments.created++;
      }

      // Update order status based on shipment
      if (shipmentData.status === 'shipped' && order.status !== 'shipped') {
        await storage.updateOrder(order.id, { 
          status: 'shipped',
          trackingNumber: shipmentData.tracking_number 
        });
      }
    } catch (error) {
      result.errors.push(`Failed to process shipment ${shipmentData.id}: ${error.message}`);
    }
  }

  private async syncProducts(brandId: string, since: string, result: SyncResult): Promise<void> {
    try {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.makeAuthenticatedRequest(
          `/products?updated_from=${since}&page=${page}&per_page=100`
        );

        if (!response.data || response.data.length === 0) {
          hasMore = false;
          break;
        }

        for (const productData of response.data) {
          await this.processProduct(brandId, productData, result);
        }

        hasMore = response.data.length === 100;
        page++;
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      result.errors.push(`Product sync failed: ${error.message}`);
    }
  }

  private async processProduct(brandId: string, productData: any, result: SyncResult): Promise<void> {
    try {
      const existingProduct = await storage.getProductByShipHeroId(productData.id);
      
      const productPayload = {
        sku: productData.sku,
        name: productData.name,
        description: productData.description,
        brandId,
        price: parseFloat(productData.price || '0'),
        weight: parseFloat(productData.weight || '0'),
        dimensions: {
          length: parseFloat(productData.dimensions?.length || '0'),
          width: parseFloat(productData.dimensions?.width || '0'),
          height: parseFloat(productData.dimensions?.height || '0')
        },
        shipHeroProductId: productData.id,
        barcode: productData.barcode,
        hsCode: productData.hs_code,
        countryOfOrigin: productData.country_of_origin,
        createdAt: new Date(productData.created_at),
        updatedAt: new Date(productData.updated_at || productData.created_at)
      };

      if (existingProduct) {
        await storage.updateProduct(existingProduct.id, productPayload);
        result.products.updated++;
      } else {
        await storage.createProduct(productPayload);
        result.products.created++;
      }
    } catch (error) {
      result.errors.push(`Failed to process product ${productData.sku}: ${error.message}`);
    }
  }

  private async syncWarehouses(brandId: string, result: SyncResult): Promise<void> {
    try {
      const response = await this.makeAuthenticatedRequest('/warehouses');
      
      if (response.data) {
        for (const warehouseData of response.data) {
          await this.processWarehouse(brandId, warehouseData, result);
        }
      }
    } catch (error) {
      result.errors.push(`Warehouse sync failed: ${error.message}`);
    }
  }

  private async processWarehouse(brandId: string, warehouseData: any, result: SyncResult): Promise<void> {
    try {
      const existingWarehouse = await storage.getWarehouseByShipHeroId(warehouseData.id);
      
      const warehousePayload = {
        name: warehouseData.identifier,
        address: warehouseData.address,
        brandId,
        shipHeroWarehouseId: warehouseData.id,
        isActive: warehouseData.status === 'active',
        createdAt: new Date(warehouseData.created_at || Date.now()),
        updatedAt: new Date(warehouseData.updated_at || Date.now())
      };

      if (existingWarehouse) {
        await storage.updateWarehouse(existingWarehouse.id, warehousePayload);
      } else {
        await storage.createWarehouse(warehousePayload);
        result.warehouses.created++;
      }
    } catch (error) {
      result.errors.push(`Failed to process warehouse ${warehouseData.identifier}: ${error.message}`);
    }
  }

  private async syncInventoryLevels(brandId: string, result: SyncResult): Promise<void> {
    try {
      // Get all products for this brand
      const products = await storage.getProductsByBrand(brandId);
      
      for (const product of products) {
        if (product.shipHeroProductId) {
          await this.syncProductInventory(product, result);
          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    } catch (error) {
      result.errors.push(`Inventory sync failed: ${error.message}`);
    }
  }

  private async syncProductInventory(product: any, result: SyncResult): Promise<void> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `/products/${product.shipHeroProductId}/inventory`
      );
      
      if (response.data) {
        let totalQuantity = 0;
        for (const inventory of response.data) {
          totalQuantity += parseInt(inventory.available_quantity || '0');
        }
        
        await storage.updateProductInventory(product.id, {
          quantity: totalQuantity,
          reservedQuantity: response.data.reduce((sum: number, inv: any) => 
            sum + parseInt(inv.reserved_quantity || '0'), 0),
          lastSyncAt: new Date()
        });
        
        result.inventory.updated++;
      }
    } catch (error) {
      result.errors.push(`Failed to sync inventory for ${product.sku}: ${error.message}`);
    }
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

  private mapShipmentStatus(shipHeroStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'pending',
      'processing': 'processing',
      'shipped': 'shipped', 
      'in_transit': 'in_transit',
      'delivered': 'delivered',
      'exception': 'exception',
      'returned': 'returned'
    };
    
    return statusMap[shipHeroStatus] || 'pending';
  }
}

export default ShipHeroSyncService;