import cron from 'node-cron';
import { IStorage } from '../storage';
import { shipHeroApiFixed } from './shipHeroApiFixed';

export class BackgroundJobService {
  constructor(
    private storage: IStorage
  ) {}

  startOrderSync() {
    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      console.log('Starting order sync job...');
      try {
        await this.syncAllBrandOrders();
      } catch (error) {
        console.error('Order sync failed:', error);
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

  private async syncAllBrandOrders() {
    console.log('Syncing orders for all brands with API credentials...');
    
    try {
      // For now, sync for Mabē brand specifically (in production would iterate through all brands)
      const brandId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
      const brand = await this.storage.getBrand(brandId);
      
      if (brand && brand.shipHeroApiKey) {
        console.log(`🔄 Syncing orders for brand: ${brand.name}`);
        await this.syncBrandOrders(brand);
      } else {
        console.log('⚠️  No brands with ShipHero API credentials found for order sync');
      }
    } catch (error) {
      console.error('❌ Failed to sync brand orders:', error);
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

  private async syncBrandOrders(brand: any) {
    try {
      const credentials = { username: brand.shipHeroApiKey, password: brand.shipHeroPassword };
      console.log(`📦 Fetching orders for brand ${brand.name} from last 7 days...`);
      
      const orders = await shipHeroApiFixed.getOrders(credentials, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      console.log(`📊 Found ${orders.length} orders from ShipHero for ${brand.name}`);
      
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
        } catch (error) {
          console.error(`❌ Failed to process order ${shOrder.order_number}:`, error);
        }
      }
      
      console.log(`✅ Order sync complete for ${brand.name}: ${newOrdersCount} new orders, ${updatedOrdersCount} updated orders`);
    } catch (error) {
      console.error(`❌ Failed to sync orders for brand ${brand.name}:`, error);
    }
  }
}
