import { storage } from '../storage.js';
import { TrackstarService } from './trackstar.js';

export class TrackstarSyncService {
  private trackstarService: TrackstarService;

  constructor() {
    this.trackstarService = new TrackstarService();
  }

  /**
   * Sync all data for brands with Trackstar integration
   */
  async syncAllTrackstarBrands(): Promise<void> {
    console.log('🔄 Starting Trackstar sync for all connected brands...');
    
    try {
      // Get all brands from all 3PLs
      const all3PLs = await storage.getThreePLs();
      let brands: any[] = [];
      
      for (const threePL of all3PLs) {
        const brandsFor3PL = await storage.getBrandsByThreePL(threePL.id);
        brands = brands.concat(brandsFor3PL);
      }
      
      console.log(`🔍 Total brands found: ${brands.length}`);
      brands.forEach(brand => {
        console.log(`   - ${brand.name}: hasToken=${!!brand.trackstarAccessToken}, hasConnection=${!!brand.trackstarConnectionId}`);
      });
      const trackstarBrands = brands.filter(brand => brand.trackstarAccessToken && brand.trackstarConnectionId);
      
      console.log(`📊 Found ${trackstarBrands.length} brands with Trackstar integration`);
      
      for (const brand of trackstarBrands) {
        try {
          await this.syncBrandData(brand.id);
        } catch (error) {
          console.error(`❌ Failed to sync brand ${brand.name}:`, (error as Error).message);
        }
      }
      
      console.log('✅ Trackstar sync completed for all brands');
    } catch (error) {
      console.error('❌ Trackstar sync failed:', (error as Error).message);
    }
  }

  /**
   * Sync data for a specific brand
   */
  async syncBrandData(brandId: string): Promise<void> {
    const brand = await storage.getBrand(brandId);
    if (!brand || !brand.trackstarAccessToken || !brand.trackstarConnectionId) {
      throw new Error(`Brand not found or missing Trackstar connection: ${brandId}`);
    }

    console.log(`🔄 Syncing Trackstar data for brand: ${brand.name}`);
    console.log(`🔗 Using connection: ${brand.trackstarConnectionId} (${brand.trackstarIntegrationName})`);

    try {
      // Use the brand's access token to fetch real data
      await this.syncRealTrackstarData(brand);
      
      console.log(`✅ Successfully synced data for ${brand.name}`);
    } catch (error) {
      console.error(`❌ Sync failed for ${brand.name}:`, (error as Error).message);
      throw error;
    }
  }

  /**
   * Get real data from Trackstar and sync to database
   */
  private async syncRealTrackstarData(brand: any): Promise<void> {
    console.log(`🔄 Syncing real Trackstar data for ${brand.name}...`);
    
    try {
      // Use the brand's connection to get real orders
      const orders = await this.trackstarService.getOrdersWithToken(
        brand.trackstarConnectionId, 
        brand.trackstarAccessToken
      );
      
      console.log(`📦 Retrieved ${orders.length} orders from Trackstar`);
      
      if (orders.length > 0) {
        console.log(`🔄 Processing ${orders.length} real orders from Trackstar...`);
        await this.processAndStoreOrders(brand, orders);
        console.log(`✅ Real data sync completed for ${brand.name}`);
      } else {
        console.log(`📝 No orders found - this is normal for new connections`);
      }

      // Also sync products if available
      try {
        const products = await this.trackstarService.getProductsWithToken(
          brand.trackstarConnectionId,
          brand.trackstarAccessToken
        );
        
        console.log(`🏷️ Retrieved ${products.length} products from Trackstar`);
        if (products.length > 0) {
          await this.processAndStoreProducts(brand, products);
        }
      } catch (error) {
        console.log(`⚠️ Could not fetch products: ${(error as Error).message}`);
      }

    } catch (error) {
      console.error(`❌ Failed to sync real data: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Process and store orders from Trackstar
   */
  private async processAndStoreOrders(brand: any, orders: any[]): Promise<void> {
    console.log(`📦 Processing ${orders.length} orders for ${brand.name}...`);
    
    for (const trackstarOrder of orders) {
      try {
        // Convert Trackstar order format to our database format using actual API structure
        const orderData = {
          brandId: brand.id,
          orderNumber: trackstarOrder.order_number || trackstarOrder.reference_id || `TRK-${Date.now()}`,
          customerName: trackstarOrder.ship_to_address?.full_name || 'Unknown Customer',
          customerEmail: trackstarOrder.ship_to_address?.email_address || null,
          status: this.mapTrackstarStatus(trackstarOrder.status),
          totalAmount: trackstarOrder.total_price?.toString() || '0.00',
          trackstarOrderId: trackstarOrder.id,
          fulfillmentStatus: trackstarOrder.status || 'pending',
          orderDate: new Date(trackstarOrder.created_date || Date.now()),
          shippingAddress: trackstarOrder.ship_to_address || null,
          // Additional Trackstar-specific fields
          warehouseId: trackstarOrder.warehouse_id,
          warehouseName: trackstarOrder.warehouse?.name || null,
          shippingMethod: trackstarOrder.shipping_method,
          totalTax: trackstarOrder.total_tax,
          totalShipping: trackstarOrder.total_shipping,
          totalDiscounts: trackstarOrder.total_discount,
          orderItems: trackstarOrder.line_items || [],
          trackingNumber: trackstarOrder.shipments?.[0]?.packages?.[0]?.tracking_number || null,
        };

        await storage.createOrder(orderData);
        console.log(`✅ Created order: ${orderData.orderNumber}`);
      } catch (error) {
        console.error(`❌ Failed to process order:`, (error as Error).message);
      }
    }
  }

  /**
   * Process and store products from Trackstar
   */
  private async processAndStoreProducts(brand: any, products: any[]): Promise<void> {
    console.log(`🏷️ Processing ${products.length} products for ${brand.name}...`);
    
    for (const trackstarProduct of products) {
      try {
        const productData = {
          brandId: brand.id,
          name: trackstarProduct.name || trackstarProduct.title,
          sku: trackstarProduct.sku || trackstarProduct.product_id,
          inventoryCount: trackstarProduct.inventory_count || trackstarProduct.quantity || 0,
          price: trackstarProduct.price || '0.00',
          trackstarProductId: trackstarProduct.id || trackstarProduct.product_id,
        };

        await storage.createProduct(productData);
        console.log(`✅ Created product: ${productData.name}`);
      } catch (error) {
        console.error(`❌ Failed to process product:`, (error as Error).message);
      }
    }
  }

  /**
   * Map Trackstar order status to our internal status
   */
  private mapTrackstarStatus(trackstarStatus: string): 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'fulfilled' | 'allocated' | 'on_hold' | 'unfulfilled' | 'partially_fulfilled' {
    const statusMap: { [key: string]: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'fulfilled' | 'allocated' | 'on_hold' | 'unfulfilled' | 'partially_fulfilled' } = {
      'pending': 'pending',
      'processing': 'processing', 
      'fulfilled': 'fulfilled',
      'shipped': 'shipped',
      'delivered': 'delivered',
      'cancelled': 'cancelled',
      'on_hold': 'on_hold',
      'unfulfilled': 'unfulfilled',
      'allocated': 'allocated',
      'partially_fulfilled': 'partially_fulfilled'
    };
    
    return statusMap[trackstarStatus?.toLowerCase()] || 'pending';
  }

  /**
   * Create sample data for testing
   */
  private async createSampleData(brand: any): Promise<void> {
    console.log(`📦 Simulating Trackstar sync for ${brand.name}...`);
    
    // Simulate creating sample orders
    const sampleOrders = [
      {
        orderNumber: `TRK-${Date.now()}-001`,
        brandId: brand.id,
        customerName: 'John Smith',
        customerEmail: 'john@example.com',
        status: 'pending' as const,
        totalAmount: '49.99',
        trackstarOrderId: `trackstar_${Date.now()}_1`,
        fulfillmentStatus: 'awaiting_fulfillment',
        warehouseName: 'Main Warehouse',
        orderDate: new Date(),
        shippingAddress: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zip: '12345',
          country: 'US'
        }
      },
      {
        orderNumber: `TRK-${Date.now()}-002`,
        brandId: brand.id,
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
        status: 'fulfilled',
        totalAmount: '79.99',
        trackstarOrderId: `trackstar_${Date.now()}_2`,
        fulfillmentStatus: 'shipped',
        warehouseName: 'Main Warehouse',
        orderDate: new Date(Date.now() - 86400000), // Yesterday
        shippedAt: new Date(),
        trackingNumber: 'TRK123456789',
        shippingAddress: {
          street: '456 Oak Ave',
          city: 'Somewhere',
          state: 'NY',
          zip: '67890',
          country: 'US'
        }
      }
    ];

    // Create the sample orders
    for (const orderData of sampleOrders) {
      try {
        await storage.createOrder(orderData);
        console.log(`📦 Created sample order: ${orderData.orderNumber}`);
      } catch (error) {
        console.log(`⚠️ Order ${orderData.orderNumber} might already exist, skipping...`);
      }
    }

    // Simulate creating sample products
    const sampleProducts = [
      {
        sku: 'MABE-TEE-001',
        name: 'Mabē Premium T-Shirt',
        description: 'High-quality cotton t-shirt with Mabē branding',
        brandId: brand.id,
        price: '29.99',
        inventoryCount: 150,
        trackstarProductId: `trackstar_product_${Date.now()}_1`,
        weight: '0.5',
        dimensions: { length: 12, width: 8, height: 1 },
        lowStockThreshold: 20
      },
      {
        sku: 'MABE-HAT-001',
        name: 'Mabē Baseball Cap',
        description: 'Stylish baseball cap with embroidered Mabē logo',
        brandId: brand.id,
        price: '24.99',
        inventoryCount: 75,
        trackstarProductId: `trackstar_product_${Date.now()}_2`,
        weight: '0.3',
        dimensions: { length: 10, width: 10, height: 4 },
        lowStockThreshold: 10
      }
    ];

    // Create the sample products
    for (const productData of sampleProducts) {
      try {
        await storage.createProduct(productData);
        console.log(`🏷️ Created sample product: ${productData.sku}`);
      } catch (error) {
        console.log(`⚠️ Product ${productData.sku} might already exist, skipping...`);
      }
    }

    console.log(`✅ Trackstar simulation completed for ${brand.name}`);
  }

  /**
   * Start periodic sync for Trackstar brands
   */
  startPeriodicSync(): void {
    console.log('⏰ Starting Trackstar periodic sync (every 5 minutes)...');
    
    // Initial sync
    this.syncAllTrackstarBrands();
    
    // Set up periodic sync every 5 minutes
    setInterval(() => {
      this.syncAllTrackstarBrands();
    }, 5 * 60 * 1000); // 5 minutes
  }
}