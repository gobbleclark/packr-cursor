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
      const credentials = { username: brand.shipHeroApiKey, password: brand.shipHeroPassword };
      const orders = await shipHeroApiFixed.getOrders(credentials, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      
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
      
      // Check for fulfillment updates using same credentials
      const shipments = await shipHeroApiFixed.getShipments(credentials, new Date(Date.now() - 1 * 60 * 60 * 1000));
      for (const shipment of shipments) {
        const orders = await this.storage.getOrdersByBrand(brand.id);
        const order = orders.find(o => o.shipHeroOrderId === shipment.order_id);
        
        if (order) {
          await this.storage.updateOrderStatus(order.id, shipment.status);
          // Update tracking number if provided
          // await this.storage.updateOrderTracking(order.id, update.tracking_number);
        }
      }
      
    } catch (error) {
      console.error(`Failed to sync orders for brand ${brand.id}:`, error);
    }
  }
}
