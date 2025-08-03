import cron from 'node-cron';
import { storage } from '../storage';
import { RealApiSyncService } from './realApiSync';

class SyncScheduler {
  private activeJobs: Map<string, cron.ScheduledTask> = new Map();
  
  start() {
    console.log('🚀 Starting consolidated sync scheduler with shipHeroApiFixed service');
    
    // High frequency sync for orders and shipments - every 5 minutes
    const highFreqJob = cron.schedule('*/5 * * * *', async () => {
      console.log('Starting high-frequency sync (orders & shipments)...');
      await this.performHighFrequencySync();
    });

    // Medium frequency sync for products and inventory - every 30 minutes
    const medFreqJob = cron.schedule('*/30 * * * *', async () => {
      console.log('Starting medium-frequency sync (products & inventory)...');
      await this.performMediumFrequencySync();
    });

    // Low frequency sync for warehouses - every 2 hours
    const lowFreqJob = cron.schedule('0 */2 * * *', async () => {
      console.log('Starting low-frequency sync (warehouses)...');
      await this.performLowFrequencySync();
    });

    this.activeJobs.set('high-frequency', highFreqJob);
    this.activeJobs.set('medium-frequency', medFreqJob);
    this.activeJobs.set('low-frequency', lowFreqJob);
  }

  private async performHighFrequencySync() {
    const brands = await this.getActiveBrands();
    
    for (const brand of brands) {
      if (this.hasShipHeroCredentials(brand)) {
        try {
          console.log(`High-frequency sync for brand ${brand.name}`);
          
          const syncService = new RealApiSyncService();
          const result = await syncService.syncBrandData(brand.id);
          
          await this.updateSyncStatus(brand.id, 'orders', {
            lastSyncAt: new Date(),
            lastSyncStatus: result.success ? 'success' : 'error',
            recordsProcessed: result.orders + result.products + result.shipments,
            errorCount: result.errors.length,
            errorDetails: result.errors.length > 0 ? { errors: result.errors } : null,
            nextScheduledSync: new Date(Date.now() + 5 * 60 * 1000)
          });

          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`High-frequency sync failed for brand ${brand.name}:`, error);
          await this.updateSyncStatus(brand.id, 'orders', {
            lastSyncAt: new Date(),
            lastSyncStatus: 'error',
            recordsProcessed: 0,
            errorCount: 1,
            errorDetails: { errors: [error.message] },
            nextScheduledSync: new Date(Date.now() + 15 * 60 * 1000)
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
          console.log(`Medium-frequency sync for brand ${brand.name}`);
          
          const syncService = new RealApiSyncService();
          const result = await syncService.syncBrandData(brand.id);
          
          await this.updateSyncStatus(brand.id, 'products', {
            lastSyncAt: new Date(),
            lastSyncStatus: result.success ? 'success' : 'error',
            recordsProcessed: result.orders + result.products + result.shipments,
            errorCount: result.errors.length,
            errorDetails: result.errors.length > 0 ? { errors: result.errors } : null,
            nextScheduledSync: new Date(Date.now() + 30 * 60 * 1000)
          });

          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (error) {
          console.error(`Medium-frequency sync failed for brand ${brand.name}:`, error);
        }
      }
    }
  }

  private async performLowFrequencySync() {
    const brands = await this.getActiveBrands();
    
    for (const brand of brands) {
      if (this.hasShipHeroCredentials(brand)) {
        try {
          console.log(`Low-frequency sync for brand ${brand.name}`);
          
          const syncService = new RealApiSyncService();
          const result = await syncService.syncBrandData(brand.id);
          
          await this.updateSyncStatus(brand.id, 'warehouses', {
            lastSyncAt: new Date(),
            lastSyncStatus: result.success ? 'success' : 'error',
            recordsProcessed: result.orders + result.products + result.shipments,
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

  private async getActiveBrands(): Promise<any[]> {
    try {
      return await storage.getBrandsWithShipHeroCredentials();
    } catch (error) {
      console.error('Failed to get active brands:', error);
      return [];
    }
  }

  private hasShipHeroCredentials(brand: any): boolean {
    return !!(brand.shipHeroApiKey && brand.shipHeroPassword);
  }

  private async updateSyncStatus(brandId: string, syncType: string, status: any) {
    try {
      await storage.updateSyncStatus(brandId, syncType, status);
    } catch (error) {
      console.error(`Failed to update sync status for brand ${brandId}:`, error);
    }
  }

  stop() {
    this.activeJobs.forEach((job, name) => {
      job.destroy();
      console.log(`Stopped sync job: ${name}`);
    });
    this.activeJobs.clear();
  }
}

export const syncScheduler = new SyncScheduler();
export default syncScheduler;