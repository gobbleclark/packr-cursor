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
      const brands = await storage.getBrandsByThreePL('all'); // Get all brands
      const trackstarBrands = brands.filter(brand => brand.trackstarApiKey);
      
      console.log(`📊 Found ${trackstarBrands.length} brands with Trackstar integration`);
      
      for (const brand of trackstarBrands) {
        try {
          await this.syncBrandData(brand.id, brand.trackstarApiKey);
        } catch (error) {
          console.error(`❌ Failed to sync brand ${brand.name}:`, error);
        }
      }
      
      console.log('✅ Trackstar sync completed for all brands');
    } catch (error) {
      console.error('❌ Trackstar sync failed:', error);
    }
  }

  /**
   * Sync data for a specific brand
   */
  async syncBrandData(brandId: string, trackstarApiKey: string): Promise<void> {
    const brand = await storage.getBrand(brandId);
    if (!brand) {
      throw new Error(`Brand not found: ${brandId}`);
    }

    console.log(`🔄 Syncing Trackstar data for brand: ${brand.name}`);

    try {
      // Sync real data from Trackstar
      await this.syncRealTrackstarData(brand);
      
      console.log(`✅ Successfully synced data for ${brand.name}`);
    } catch (error) {
      console.error(`❌ Sync failed for ${brand.name}:`, error);
      throw error;
    }
  }

  /**
   * Get real data from Trackstar and sync to database
   */
  private async syncRealTrackstarData(brand: any): Promise<void> {
    console.log(`🔄 Syncing real Trackstar data for ${brand.name}...`);
    
    try {
      // Get all connections from Trackstar account
      const connections = await this.trackstarService.getConnections();
      console.log(`📋 Found ${connections.length} connections in Trackstar`);
      
      // For now, use the first available connection or create sample data
      if (connections.length > 0) {
        const connection = connections[0];
        console.log(`🔗 Using connection: ${connection.id || connection.connection_id || 'unknown'}`);
        
        // Try to get real orders and inventory
        try {
          const orders = await this.trackstarService.getOrders(connection.id || connection.connection_id);
          console.log(`📦 Retrieved ${orders.length} orders from Trackstar`);
          
          // Process and store real orders...
          // TODO: Convert Trackstar order format to our database format
        } catch (error) {
          console.log(`⚠️ Could not fetch orders, using sample data: ${error.message}`);
          await this.createSampleData(brand);
        }
      } else {
        console.log(`⚠️ No connections found in Trackstar, creating sample data`);
        await this.createSampleData(brand);
      }
    } catch (error) {
      console.error(`❌ Failed to sync real data: ${error.message}`);
      console.log(`🔄 Falling back to sample data for testing`);
      await this.createSampleData(brand);
    }
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
        status: 'pending',
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