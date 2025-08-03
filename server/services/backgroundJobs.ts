import cron from 'node-cron';
import { IStorage } from '../storage';
import { shipHeroApiFixed } from './shipHeroApiFixed';

export class BackgroundJobService {
  constructor(
    private storage: IStorage
  ) {}

  startOrderSync() {
    // Incremental sync every 2 minutes - only new orders since last successful sync
    cron.schedule('*/2 * * * *', async () => {
      console.log('Starting incremental order sync...');
      try {
        await this.syncAllBrandOrdersIncremental();
      } catch (error) {
        console.error('Incremental order sync failed:', error);
      }
    });

    // Integrity check every hour - look back 24 hours to catch missed orders
    cron.schedule('0 * * * *', async () => {
      console.log('Starting order integrity check (24 hours)...');
      try {
        await this.syncAllBrandOrdersIntegrityCheck();
      } catch (error) {
        console.error('Order integrity check failed:', error);
      }
    });
  }

  startInventorySync() {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
      console.log('Starting inventory sync job...');
      try {
        await this.syncAllBrandInventory();
      } catch (error) {
        console.error('Inventory sync failed:', error);
      }
    });
  }

  // Incremental sync - only new orders since last successful sync
  private async syncAllBrandOrdersIncremental() {
    console.log('Syncing new orders for all brands with API credentials...');
    
    try {
      const brandId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
      const brand = await this.storage.getBrand(brandId);
      
      if (brand && brand.shipHeroApiKey) {
        console.log(`🔄 Incremental sync for brand: ${brand.name}`);
        await this.syncBrandOrdersIncremental(brand);
      } else {
        console.log('⚠️  No brands with ShipHero API credentials found for incremental sync');
      }
    } catch (error) {
      console.error('❌ Failed incremental order sync:', error);
    }
  }

  // Integrity check - look back 24 hours to catch any missed orders
  private async syncAllBrandOrdersIntegrityCheck() {
    console.log('Running order integrity check for all brands...');
    
    try {
      const brandId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
      const brand = await this.storage.getBrand(brandId);
      
      if (brand && brand.shipHeroApiKey) {
        console.log(`🔍 24-hour integrity check for brand: ${brand.name}`);
        await this.syncBrandOrdersIntegrityCheck(brand);
      } else {
        console.log('⚠️  No brands with ShipHero API credentials found for integrity check');
      }
    } catch (error) {
      console.error('❌ Failed order integrity check:', error);
    }
  }

  private async syncAllBrandInventory() {
    console.log('Syncing inventory for all brands with API credentials...');
    
    try {
      // For now, sync for Mabē brand specifically (in production would iterate through all brands)
      const brandId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
      const brand = await this.storage.getBrand(brandId);
      
      if (brand && brand.shipHeroApiKey && brand.shipHeroPassword) {
        console.log(`🏭 Syncing warehouse inventory for brand: ${brand.name}`);
        const credentials = { username: brand.shipHeroApiKey, password: brand.shipHeroPassword };
        await shipHeroApiFixed.syncWarehouseInventory(credentials, this.storage);
      } else {
        console.log('⚠️  No brands with ShipHero API credentials found for inventory sync');
      }
    } catch (error) {
      console.error('❌ Failed to sync brand inventory:', error);
    }
  }

  // Incremental sync - only orders since last successful sync
  private async syncBrandOrdersIncremental(brand: any) {
    try {
      const credentials = { username: brand.shipHeroApiKey, password: brand.shipHeroPassword };
      
      // Get the last successful sync time for this brand
      const lastSyncTime = await this.getLastSuccessfulSyncTime(brand.id);
      const fromDate = lastSyncTime || new Date(Date.now() - 10 * 60 * 1000); // Default to 10 minutes ago if no previous sync
      
      console.log(`📦 Fetching new orders for ${brand.name} since ${fromDate.toISOString()}...`);
      
      const orders = await shipHeroApiFixed.getOrders(credentials, fromDate);
      console.log(`📊 Found ${orders.length} new orders from ShipHero for ${brand.name}`);
      
      const result = await this.processOrderBatch(brand, orders, 'incremental');
      
      // Update last successful sync time on success
      await this.updateLastSuccessfulSyncTime(brand.id);
      
      console.log(`✅ Incremental sync complete for ${brand.name}: ${result.newOrdersCount} new, ${result.updatedOrdersCount} updated`);
    } catch (error) {
      console.error(`❌ Failed incremental sync for brand ${brand.name}:`, error);
      throw error;
    }
  }

  // Integrity check - look back 24 hours to catch missed orders
  private async syncBrandOrdersIntegrityCheck(brand: any) {
    try {
      const credentials = { username: brand.shipHeroApiKey, password: brand.shipHeroPassword };
      const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      console.log(`🔍 Running 24-hour integrity check for ${brand.name} since ${fromDate.toISOString()}...`);
      
      const orders = await shipHeroApiFixed.getOrders(credentials, fromDate);
      console.log(`📊 Found ${orders.length} orders in 24-hour window for ${brand.name}`);
      
      const result = await this.processOrderBatch(brand, orders, 'integrity-check');
      
      console.log(`✅ Integrity check complete for ${brand.name}: ${result.newOrdersCount} new, ${result.updatedOrdersCount} updated`);
    } catch (error) {
      console.error(`❌ Failed integrity check for brand ${brand.name}:`, error);
      throw error;
    }
  }

  // Common order processing logic
  private async processOrderBatch(brand: any, orders: any[], syncType: string) {
    let newOrdersCount = 0;
    let updatedOrdersCount = 0;
    
    for (const shOrder of orders) {
      try {
        // Check if order already exists
        const existingOrders = await this.storage.getOrdersByBrand(brand.id);
        const existingOrder = existingOrders.find(o => o.shipHeroOrderId === shOrder.id);
        
        if (!existingOrder) {
          // Create new order with allocation tracking
          await this.storage.createOrder({
            orderNumber: shOrder.order_number,
            brandId: brand.id,
            customerName: shOrder.shipping_address?.first_name + ' ' + shOrder.shipping_address?.last_name,
            customerEmail: shOrder.email,
            shippingAddress: shOrder.shipping_address,
            status: (shOrder.fulfillment_status === 'shipped' || shOrder.fulfillment_status === 'delivered' || 
                     shOrder.fulfillment_status === 'cancelled' || shOrder.fulfillment_status === 'processing') 
                     ? shOrder.fulfillment_status : 'pending',
            totalAmount: shOrder.total_price?.toString() || '0',
            orderItems: shOrder.line_items,
            shipHeroOrderId: shOrder.id,
            backorderQuantity: (shOrder as any).total_backorder_quantity || 0,
            orderCreatedAt: shOrder.order_date ? new Date(shOrder.order_date) : new Date(),
            allocatedAt: (shOrder as any).allocated_date ? new Date((shOrder as any).allocated_date) : null,
            shippedAt: (shOrder as any).shipped_date ? new Date((shOrder as any).shipped_date) : null,
            lastSyncAt: new Date(),
          });
          newOrdersCount++;
        } else {
          // Update existing order with latest allocation info
          await this.storage.updateOrder?.(existingOrder.id, {
            status: (shOrder.fulfillment_status === 'shipped' || shOrder.fulfillment_status === 'delivered' || 
                     shOrder.fulfillment_status === 'cancelled' || shOrder.fulfillment_status === 'processing') 
                     ? shOrder.fulfillment_status : existingOrder.status,
            backorderQuantity: (shOrder as any).total_backorder_quantity || 0,
            allocatedAt: (shOrder as any).allocated_date ? new Date((shOrder as any).allocated_date) : existingOrder.allocatedAt,
            shippedAt: (shOrder as any).shipped_date ? new Date((shOrder as any).shipped_date) : existingOrder.shippedAt,
            lastSyncAt: new Date(),
          });
          updatedOrdersCount++;
        }
      } catch (orderError) {
        console.error(`❌ Failed to process order ${shOrder.id} in ${syncType}:`, orderError);
      }
    }
    
    return { newOrdersCount, updatedOrdersCount };
  }

  // Helper methods for tracking sync times
  private async getLastSuccessfulSyncTime(brandId: string): Promise<Date | null> {
    // Get the most recent successful sync time from orders table
    const orders = await this.storage.getOrdersByBrand(brandId);
    if (orders.length === 0) return null;
    
    const lastSyncTimes = orders
      .map(o => o.lastSyncAt)
      .filter(t => t !== null)
      .sort((a, b) => b!.getTime() - a!.getTime());
    
    return lastSyncTimes.length > 0 ? lastSyncTimes[0] : null;
  }

  private async updateLastSuccessfulSyncTime(brandId: string): Promise<void> {
    // This could be stored in a separate sync_status table, but for now we use the order sync timestamps
    // The most recent lastSyncAt on orders serves as our checkpoint
  }
}
