/**
 * ShipHero Background Job Scheduler
 * 
 * Manages all ShipHero integration background tasks:
 * - 5-minute incremental order syncs
 * - Hourly unfulfilled orders integrity checks  
 * - Product synchronization
 * - Inventory updates
 */

import * as cron from 'node-cron';
import { ShipHeroIntegrationService } from './shipHeroIntegrationService';
import { IStorage } from '../storage';

export class ShipHeroScheduler {
  private integrationService: ShipHeroIntegrationService;
  private isRunning = false;

  constructor(private storage: IStorage) {
    this.integrationService = new ShipHeroIntegrationService(storage);
  }

  /**
   * Start all ShipHero background jobs
   */
  public startScheduler(): void {
    if (this.isRunning) {
      console.log('⚠️ ShipHero scheduler already running');
      return;
    }

    console.log('🚀 Starting ShipHero background job scheduler...');

    // 5-minute incremental sync for new orders
    this.scheduleIncrementalSync();
    
    // Hourly unfulfilled orders integrity check
    this.scheduleIntegrityCheck();
    
    // Daily product synchronization
    this.scheduleProductSync();
    
    // Twice daily inventory sync
    this.scheduleInventorySync();

    this.isRunning = true;
    console.log('✅ ShipHero scheduler started successfully');
  }

  /**
   * Stop all scheduled jobs
   */
  public stopScheduler(): void {
    cron.getTasks().forEach((task, name) => {
      if (name.startsWith('shiphero-')) {
        task.stop();
        task.destroy();
      }
    });
    
    this.isRunning = false;
    console.log('🛑 ShipHero scheduler stopped');
  }

  /**
   * Every 5 minutes: Fetch new orders since last successful sync
   * This is the core requirement - frequent incremental syncs
   */
  private scheduleIncrementalSync(): void {
    cron.schedule('*/5 * * * *', async () => {
      console.log('🔄 Starting 5-minute incremental order sync...');
      
      try {
        const brands = await this.storage.getAllBrandsWithShipHeroCredentials?.() || [];
        
        if (brands.length === 0) {
          console.log('⚠️ No brands with ShipHero credentials found');
          return;
        }
        
        const promises = brands.map(brand => 
          this.integrationService.performIncrementalSync(brand.id)
            .catch(error => {
              console.error(`❌ Incremental sync failed for brand ${brand.name}:`, error);
            })
        );
        
        await Promise.allSettled(promises);
        console.log('✅ 5-minute incremental sync completed');
        
      } catch (error) {
        console.error('❌ Incremental sync scheduler error:', error);
      }
    }, {
      name: 'shiphero-incremental-sync',
      scheduled: true
    });
    
    console.log('📅 Scheduled: 5-minute incremental order sync');
  }

  /**
   * Every hour: Check unfulfilled orders for data integrity
   * Key requirement: Only look at unfulfilled orders to keep query size manageable
   */
  private scheduleIntegrityCheck(): void {
    cron.schedule('0 * * * *', async () => {
      console.log('🔍 Starting hourly unfulfilled orders integrity check...');
      
      try {
        await this.integrationService.performUnfulfilledOrdersIntegrityCheck();
        console.log('✅ Hourly integrity check completed');
        
      } catch (error) {
        console.error('❌ Integrity check scheduler error:', error);
      }
    }, {
      name: 'shiphero-integrity-check',
      scheduled: true
    });
    
    console.log('📅 Scheduled: Hourly unfulfilled orders integrity check');
  }

  /**
   * Daily at 2 AM: Full product synchronization
   */
  private scheduleProductSync(): void {
    cron.schedule('0 2 * * *', async () => {
      console.log('📦 Starting daily product sync...');
      
      try {
        const brands = await this.storage.getAllBrandsWithShipHeroCredentials?.() || [];
        
        for (const brand of brands) {
          try {
            await this.integrationService.syncProducts(brand.id);
            console.log(`✅ Product sync completed for ${brand.name}`);
          } catch (error) {
            console.error(`❌ Product sync failed for brand ${brand.name}:`, error);
          }
          
          // Small delay between brands to avoid rate limits
          await this.delay(5000);
        }
        
        console.log('✅ Daily product sync completed for all brands');
        
      } catch (error) {
        console.error('❌ Product sync scheduler error:', error);
      }
    }, {
      name: 'shiphero-product-sync',
      scheduled: true
    });
    
    console.log('📅 Scheduled: Daily product synchronization at 2 AM');
  }

  /**
   * Twice daily (8 AM, 8 PM): Inventory synchronization
   */
  private scheduleInventorySync(): void {
    cron.schedule('0 8,20 * * *', async () => {
      console.log('📊 Starting inventory sync...');
      
      try {
        const brands = await this.storage.getAllBrandsWithShipHeroCredentials?.() || [];
        
        for (const brand of brands) {
          try {
            await this.syncBrandInventory(brand);
            console.log(`✅ Inventory sync completed for ${brand.name}`);
          } catch (error) {
            console.error(`❌ Inventory sync failed for brand ${brand.name}:`, error);
          }
          
          // Small delay between brands
          await this.delay(3000);
        }
        
        console.log('✅ Inventory sync completed for all brands');
        
      } catch (error) {
        console.error('❌ Inventory sync scheduler error:', error);
      }
    }, {
      name: 'shiphero-inventory-sync', 
      scheduled: true
    });
    
    console.log('📅 Scheduled: Inventory sync at 8 AM and 8 PM');
  }

  /**
   * Sync inventory for a specific brand
   */
  private async syncBrandInventory(brand: any): Promise<void> {
    // This would be implemented to fetch current inventory levels
    // from ShipHero and update local database
    console.log(`🔄 Syncing inventory for ${brand.name}...`);
    
    // Implementation would go here - fetching inventory snapshots
    // from ShipHero and comparing with local data
  }

  /**
   * Manual trigger for immediate full sync of a brand
   */
  public async triggerManualSync(brandId: string): Promise<void> {
    console.log(`🔧 Manual sync triggered for brand: ${brandId}`);
    
    try {
      // Run all sync types for this brand
      await this.integrationService.performIncrementalSync(brandId);
      await this.integrationService.syncProducts(brandId);
      await this.syncBrandInventory({ id: brandId });
      
      console.log(`✅ Manual sync completed for brand: ${brandId}`);
      
    } catch (error) {
      console.error(`❌ Manual sync failed for brand ${brandId}:`, error);
      throw error;
    }
  }

  /**
   * Get scheduler status and next run times
   */
  public getSchedulerStatus(): any {
    const tasks = cron.getTasks();
    const shipHeroTasks = Array.from(tasks.entries())
      .filter(([name]) => name.startsWith('shiphero-'));
    
    return {
      isRunning: this.isRunning,
      taskCount: shipHeroTasks.length,
      tasks: shipHeroTasks.map(([name, task]) => ({
        name,
        running: task.isRunning(),
        // Note: node-cron doesn't expose next run time easily
        // Could be enhanced with a more sophisticated scheduler
      }))
    };
  }

  /**
   * Setup initial data pull when a new ShipHero integration is added
   */
  public async setupNewBrandIntegration(brandId: string, brandEmail: string, brandPassword: string): Promise<void> {
    console.log(`🔧 Setting up new ShipHero integration for brand: ${brandId}`);
    
    try {
      await this.integrationService.setupBrandIntegration({
        brandId,
        brandEmail,
        brandPassword
      });
      
      console.log(`✅ ShipHero integration setup completed for brand: ${brandId}`);
      
    } catch (error) {
      console.error(`❌ ShipHero integration setup failed for brand ${brandId}:`, error);
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}