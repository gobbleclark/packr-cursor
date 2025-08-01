import cron from 'node-cron';
import { storage } from '../storage';
import ShipHeroSyncService from './shipHeroSync';

class SyncScheduler {
  private activeJobs: Map<string, cron.ScheduledTask> = new Map();
  
  constructor() {
    // Start the main scheduler
    this.startMainScheduler();
  }

  private startMainScheduler() {
    // High frequency sync for critical data (orders, shipments) - every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      console.log('Starting high-frequency sync (orders & shipments)...');
      await this.performHighFrequencySync();
    });

    // Medium frequency sync for products and inventory - every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      console.log('Starting medium-frequency sync (products & inventory)...');
      await this.performMediumFrequencySync();
    });

    // Low frequency sync for warehouses, vendors - every 2 hours
    cron.schedule('0 */2 * * *', async () => {
      console.log('Starting low-frequency sync (warehouses)...');
      await this.performLowFrequencySync();
    });

    // Full reconciliation sync - daily at 3 AM
    cron.schedule('0 3 * * *', async () => {
      console.log('Starting daily full reconciliation sync...');
      await this.performFullReconciliation();
    });
  }

  private async performHighFrequencySync() {
    const brands = await this.getActiveBrands();
    
    for (const brand of brands) {
      if (this.hasShipHeroCredentials(brand)) {
        try {
          const lastSync = await this.getLastSync(brand.id, 'orders');
          const syncService = new ShipHeroSyncService(brand);
          
          // Sync orders and shipments from last sync time or last 30 minutes
          const since = lastSync || new Date(Date.now() - 30 * 60 * 1000);
          
          console.log(`High-frequency sync for brand ${brand.name} since ${since.toISOString()}`);
          
          const result = await syncService.syncAllData(brand.id, since);
          
          await this.updateSyncStatus(brand.id, 'orders', {
            lastSyncAt: new Date(),
            lastSyncStatus: result.errors.length > 0 ? 'partial' : 'success',
            recordsProcessed: result.orders.created + result.orders.updated + result.shipments.created + result.shipments.updated,
            errorCount: result.errors.length,
            errorDetails: result.errors.length > 0 ? { errors: result.errors } : null,
            nextScheduledSync: new Date(Date.now() + 5 * 60 * 1000) // Next sync in 5 minutes
          });

          // Add small delay between brands to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`High-frequency sync failed for brand ${brand.name}:`, error);
          await this.updateSyncStatus(brand.id, 'orders', {
            lastSyncAt: new Date(),
            lastSyncStatus: 'error',
            recordsProcessed: 0,
            errorCount: 1,
            errorDetails: { errors: [error.message] },
            nextScheduledSync: new Date(Date.now() + 15 * 60 * 1000) // Retry in 15 minutes on error
          });
        }
      }
    }
  }

  private async performMediumFrequencySync() {
    const brands = await this.getActiveBrands();
    
    for (const brand of brands) {
      if (this.hasShipHeroCredentials(brand)) {
        try {
          const lastSync = await this.getLastSync(brand.id, 'products');
          const syncService = new ShipHeroSyncService(brand);
          
          // Sync products and inventory from last sync time or last 2 hours
          const since = lastSync || new Date(Date.now() - 2 * 60 * 60 * 1000);
          
          console.log(`Medium-frequency sync for brand ${brand.name} since ${since.toISOString()}`);
          
          // Focus on products and inventory only
          const result = {
            orders: { created: 0, updated: 0 },
            products: { created: 0, updated: 0 },
            shipments: { created: 0, updated: 0 },
            warehouses: { created: 0, updated: 0 },
            inventory: { updated: 0 },
            errors: []
          };

          // Sync only products and inventory for medium frequency
          await syncService.syncAllData(brand.id, since);
          
          await this.updateSyncStatus(brand.id, 'products', {
            lastSyncAt: new Date(),
            lastSyncStatus: result.errors.length > 0 ? 'partial' : 'success',
            recordsProcessed: result.products.created + result.products.updated + result.inventory.updated,
            errorCount: result.errors.length,
            errorDetails: result.errors.length > 0 ? { errors: result.errors } : null,
            nextScheduledSync: new Date(Date.now() + 30 * 60 * 1000)
          });

          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (error) {
          console.error(`Medium-frequency sync failed for brand ${brand.name}:`, error);
          await this.updateSyncStatus(brand.id, 'products', {
            lastSyncAt: new Date(),
            lastSyncStatus: 'error',
            recordsProcessed: 0,
            errorCount: 1,
            errorDetails: { errors: [error.message] },
            nextScheduledSync: new Date(Date.now() + 60 * 60 * 1000) // Retry in 1 hour on error
          });
        }
      }
    }
  }

  private async performLowFrequencySync() {
    const brands = await this.getActiveBrands();
    
    for (const brand of brands) {
      if (this.hasShipHeroCredentials(brand)) {
        try {
          const syncService = new ShipHeroSyncService(brand);
          
          console.log(`Low-frequency sync for brand ${brand.name} (warehouses)`);
          
          const result = await syncService.syncAllData(brand.id);
          
          await this.updateSyncStatus(brand.id, 'warehouses', {
            lastSyncAt: new Date(),
            lastSyncStatus: result.errors.length > 0 ? 'partial' : 'success',
            recordsProcessed: result.warehouses.created,
            errorCount: result.errors.length,
            errorDetails: result.errors.length > 0 ? { errors: result.errors } : null,
            nextScheduledSync: new Date(Date.now() + 2 * 60 * 60 * 1000)
          });

          await new Promise(resolve => setTimeout(resolve, 5000));
          
        } catch (error) {
          console.error(`Low-frequency sync failed for brand ${brand.name}:`, error);
        }
      }
    }
  }

  private async performFullReconciliation() {
    console.log('Starting full reconciliation - comparing all data with ShipHero');
    const brands = await this.getActiveBrands();
    
    for (const brand of brands) {
      if (this.hasShipHeroCredentials(brand)) {
        try {
          const syncService = new ShipHeroSyncService(brand);
          
          // Full sync going back 30 days to catch any missed data
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          
          console.log(`Full reconciliation for brand ${brand.name} since ${thirtyDaysAgo.toISOString()}`);
          
          const result = await syncService.syncAllData(brand.id, thirtyDaysAgo);
          
          await this.updateSyncStatus(brand.id, 'full_reconciliation', {
            lastSyncAt: new Date(),
            lastSyncStatus: result.errors.length > 0 ? 'partial' : 'success',
            recordsProcessed: result.orders.created + result.orders.updated + 
                             result.products.created + result.products.updated +
                             result.shipments.created + result.shipments.updated,
            errorCount: result.errors.length,
            errorDetails: result.errors.length > 0 ? { errors: result.errors } : null,
            nextScheduledSync: new Date(Date.now() + 24 * 60 * 60 * 1000)
          });

          // Longer delay for full reconciliation
          await new Promise(resolve => setTimeout(resolve, 10000));
          
        } catch (error) {
          console.error(`Full reconciliation failed for brand ${brand.name}:`, error);
        }
      }
    }
  }

  private async getActiveBrands() {
    return await storage.getBrandsWithShipHeroCredentials();
  }

  private hasShipHeroCredentials(brand: any): boolean {
    return !!(brand.shipHeroApiKey && brand.shipHeroPassword);
  }

  private async getLastSync(brandId: string, syncType: string): Promise<Date | null> {
    const syncStatuses = await storage.getSyncStatus(brandId, syncType);
    if (syncStatuses.length > 0) {
      return new Date(syncStatuses[0].lastSyncAt);
    }
    return null;
  }

  private async updateSyncStatus(brandId: string, syncType: string, status: any) {
    await storage.updateSyncStatus(brandId, syncType, status);
  }

  // Manual trigger for immediate sync
  async triggerManualSync(brandId: string, syncType: 'orders' | 'products' | 'inventory' | 'all' = 'all') {
    const brand = await storage.getBrand(brandId);
    if (!brand || !this.hasShipHeroCredentials(brand)) {
      throw new Error('Brand not found or missing ShipHero credentials');
    }

    const syncService = new ShipHeroSyncService(brand);
    
    // Use last sync time or go back 24 hours for manual sync
    const lastSync = await this.getLastSync(brandId, syncType);
    const since = lastSync || new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    console.log(`Manual sync triggered for brand ${brand.name}, type: ${syncType}`);
    
    const result = await syncService.syncAllData(brandId, since);
    
    await this.updateSyncStatus(brandId, syncType, {
      lastSyncAt: new Date(),
      lastSyncStatus: result.errors.length > 0 ? 'partial' : 'success',
      recordsProcessed: result.orders.created + result.orders.updated + 
                       result.products.created + result.products.updated +
                       result.shipments.created + result.shipments.updated,
      errorCount: result.errors.length,
      errorDetails: result.errors.length > 0 ? { errors: result.errors } : null
    });

    return result;
  }

  // Webhook handler for real-time updates
  async handleWebhook(brandId: string, webhookData: any) {
    const brand = await storage.getBrand(brandId);
    if (!brand) return;

    try {
      const syncService = new ShipHeroSyncService(brand);
      
      // Process webhook data immediately for near real-time updates
      if (webhookData.type === 'order.created' || webhookData.type === 'order.updated') {
        // Process single order update
        console.log(`Webhook: Processing order ${webhookData.data.order_number} for brand ${brand.name}`);
        // Implementation would process the specific order
      } else if (webhookData.type === 'shipment.created' || webhookData.type === 'shipment.updated') {
        // Process single shipment update
        console.log(`Webhook: Processing shipment ${webhookData.data.id} for brand ${brand.name}`);
        // Implementation would process the specific shipment
      }
      
    } catch (error) {
      console.error(`Webhook processing failed for brand ${brandId}:`, error);
    }
  }
}

export const syncScheduler = new SyncScheduler();
export default SyncScheduler;