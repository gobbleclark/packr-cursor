import { storage } from '../storage';
import ShipHeroSyncService from './shipHeroSync';

/**
 * Real-time sync service that ensures no data is missed from ShipHero
 * Handles API rate limits and provides comprehensive data synchronization
 */
export class RealTimeSyncService {
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  constructor() {
    this.startSyncService();
  }

  private async startSyncService() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('🚀 Starting Real-Time Sync Service for ShipHero');

    // High-priority sync every 2 minutes for orders and shipments
    this.scheduleHighPrioritySync();
    
    // Medium-priority sync every 15 minutes for products and inventory
    this.scheduleMediumPrioritySync();
    
    // Low-priority sync every hour for warehouses and settings
    this.scheduleLowPrioritySync();
  }

  private scheduleHighPrioritySync() {
    const interval = setInterval(async () => {
      console.log('📦 High-priority sync: Orders & Shipments');
      await this.syncOrdersAndShipments();
    }, 2 * 60 * 1000); // 2 minutes

    this.syncIntervals.set('high-priority', interval);
  }

  private scheduleMediumPrioritySync() {
    const interval = setInterval(async () => {
      console.log('📊 Medium-priority sync: Products & Inventory');
      await this.syncProductsAndInventory();
    }, 15 * 60 * 1000); // 15 minutes

    this.syncIntervals.set('medium-priority', interval);
  }

  private scheduleLowPrioritySync() {
    const interval = setInterval(async () => {
      console.log('🏭 Low-priority sync: Warehouses');
      await this.syncWarehousesAndSettings();
    }, 60 * 60 * 1000); // 1 hour

    this.syncIntervals.set('low-priority', interval);
  }

  private async syncOrdersAndShipments() {
    try {
      const brands = await storage.getBrandsWithShipHeroCredentials();
      
      for (const brand of brands) {
        try {
          const syncService = new ShipHeroSyncService(brand);
          
          // Sync orders and shipments from last 30 minutes to ensure no gaps
          const since = new Date(Date.now() - 30 * 60 * 1000);
          
          console.log(`⚡ Fast sync for ${brand.name} - Orders & Shipments since ${since.toISOString()}`);
          
          const result = await syncService.syncAllData(brand.id, since);
          
          if (result.orders.created > 0 || result.orders.updated > 0 || 
              result.shipments.created > 0 || result.shipments.updated > 0) {
            console.log(`✅ Brand ${brand.name}: ${result.orders.created + result.orders.updated} orders, ${result.shipments.created + result.shipments.updated} shipments`);
          }
          
          // Stagger requests to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (error) {
          console.error(`❌ High-priority sync failed for brand ${brand.name}:`, error.message);
        }
      }
    } catch (error) {
      console.error('❌ High-priority sync batch failed:', error);
    }
  }

  private async syncProductsAndInventory() {
    try {
      const brands = await storage.getBrandsWithShipHeroCredentials();
      
      for (const brand of brands) {
        try {
          const syncService = new ShipHeroSyncService(brand);
          
          // Sync products from last 2 hours to catch any updates
          const since = new Date(Date.now() - 2 * 60 * 60 * 1000);
          
          console.log(`📦 Product sync for ${brand.name} since ${since.toISOString()}`);
          
          const result = await syncService.syncAllData(brand.id, since);
          
          if (result.products.created > 0 || result.products.updated > 0 || result.inventory.updated > 0) {
            console.log(`✅ Brand ${brand.name}: ${result.products.created + result.products.updated} products, ${result.inventory.updated} inventory updates`);
          }
          
          // Longer delay for product sync
          await new Promise(resolve => setTimeout(resolve, 5000));
          
        } catch (error) {
          console.error(`❌ Medium-priority sync failed for brand ${brand.name}:`, error.message);
        }
      }
    } catch (error) {
      console.error('❌ Medium-priority sync batch failed:', error);
    }
  }

  private async syncWarehousesAndSettings() {
    try {
      const brands = await storage.getBrandsWithShipHeroCredentials();
      
      for (const brand of brands) {
        try {
          const syncService = new ShipHeroSyncService(brand);
          
          console.log(`🏭 Warehouse sync for ${brand.name}`);
          
          const result = await syncService.syncAllData(brand.id);
          
          if (result.warehouses.created > 0) {
            console.log(`✅ Brand ${brand.name}: ${result.warehouses.created} new warehouses`);
          }
          
          // Longest delay for warehouse sync
          await new Promise(resolve => setTimeout(resolve, 10000));
          
        } catch (error) {
          console.error(`❌ Low-priority sync failed for brand ${brand.name}:`, error.message);
        }
      }
    } catch (error) {
      console.error('❌ Low-priority sync batch failed:', error);
    }
  }

  // Manual trigger for immediate comprehensive sync
  async triggerManualSync(brandId: string): Promise<any> {
    const brand = await storage.getBrand(brandId);
    if (!brand || !brand.shipHeroApiKey || !brand.shipHeroPassword) {
      throw new Error('Brand not found or missing ShipHero credentials');
    }

    console.log(`🎯 Manual sync triggered for brand ${brand.name}`);
    
    const syncService = new ShipHeroSyncService(brand);
    
    // For manual sync, go back 24 hours to ensure comprehensive coverage
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await syncService.syncAllData(brandId, since);
    
    console.log(`✅ Manual sync completed for ${brand.name}:`, {
      orders: result.orders.created + result.orders.updated,
      products: result.products.created + result.products.updated,
      shipments: result.shipments.created + result.shipments.updated,
      inventory: result.inventory.updated,
      errors: result.errors.length
    });
    
    return result;
  }

  // Webhook handler for real-time updates
  async handleWebhook(brandId: string, webhookType: string, webhookData: any) {
    const brand = await storage.getBrand(brandId);
    if (!brand) return;

    console.log(`🔔 Webhook received for brand ${brand.name}: ${webhookType}`);

    try {
      const syncService = new ShipHeroSyncService(brand);
      
      // Process specific webhook data immediately
      if (webhookType.includes('order')) {
        // Trigger immediate order sync for this specific order
        console.log(`⚡ Processing order webhook for order ${webhookData.order_number}`);
      } else if (webhookType.includes('shipment')) {
        // Trigger immediate shipment sync
        console.log(`⚡ Processing shipment webhook for shipment ${webhookData.id}`);
      } else if (webhookType.includes('inventory')) {
        // Trigger immediate inventory sync for affected products
        console.log(`⚡ Processing inventory webhook for product ${webhookData.sku}`);
      }
      
      // For now, trigger a quick sync of the last 5 minutes of data
      const since = new Date(Date.now() - 5 * 60 * 1000);
      await syncService.syncAllData(brandId, since);
      
    } catch (error) {
      console.error(`❌ Webhook processing failed for brand ${brandId}:`, error);
    }
  }

  // Health check method
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeIntervals: this.syncIntervals.size,
      intervals: {
        'high-priority': '2 minutes (orders & shipments)',
        'medium-priority': '15 minutes (products & inventory)',
        'low-priority': '1 hour (warehouses)'
      }
    };
  }

  // Graceful shutdown
  stop() {
    console.log('🛑 Stopping Real-Time Sync Service');
    
    for (const [name, interval] of this.syncIntervals) {
      clearInterval(interval);
      console.log(`✅ Stopped ${name} sync interval`);
    }
    
    this.syncIntervals.clear();
    this.isRunning = false;
  }
}

// Singleton instance
export const realTimeSyncService = new RealTimeSyncService();
export default RealTimeSyncService;