import cron from 'node-cron';
import { IStorage } from '../storage';
import { ShipHeroService } from './shiphero';

export class BackgroundJobService {
  constructor(
    private storage: IStorage,
    private shipHeroService: ShipHeroService
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
    // Get all brands with API credentials
    // In production, you'd query the database for brands with shipHeroApiKey
    console.log('Syncing orders for all brands with API credentials...');
    
    // Mock implementation - would iterate through brands and sync orders
    // const brands = await this.storage.getBrandsWithApiCredentials();
    // for (const brand of brands) {
    //   await this.syncBrandOrders(brand);
    // }
  }

  private async syncAllBrandInventory() {
    console.log('Syncing inventory for all brands with API credentials...');
    
    // Mock implementation - would iterate through brands and sync inventory
  }

  private async syncBrandOrders(brand: any) {
    try {
      const orders = await this.shipHeroService.getOrders(brand.shipHeroApiKey);
      
      for (const shOrder of orders) {
        // Check if order already exists
        const existingOrder = await this.storage.getOrdersByBrand(brand.id);
        const exists = existingOrder.some(o => o.shipHeroOrderId === shOrder.id);
        
        if (!exists) {
          // Create new order
          await this.storage.createOrder({
            orderNumber: shOrder.order_number,
            brandId: brand.id,
            customerName: shOrder.customer.name,
            customerEmail: shOrder.customer.email,
            shippingAddress: shOrder.shipping_address,
            status: shOrder.status,
            totalAmount: shOrder.total.toString(),
            orderItems: shOrder.line_items,
            shipHeroOrderId: shOrder.id,
          });
        }
      }
      
      // Check for fulfillment updates
      const fulfillmentUpdates = await this.shipHeroService.getFulfillmentUpdates(brand.shipHeroApiKey);
      for (const update of fulfillmentUpdates) {
        const orders = await this.storage.getOrdersByBrand(brand.id);
        const order = orders.find(o => o.shipHeroOrderId === update.order_id);
        
        if (order) {
          await this.storage.updateOrderStatus(order.id, update.status);
          // Update tracking number if provided
          // await this.storage.updateOrderTracking(order.id, update.tracking_number);
        }
      }
      
    } catch (error) {
      console.error(`Failed to sync orders for brand ${brand.id}:`, error);
    }
  }
}
