import { CronJob } from 'cron';
import { prisma } from '@packr/database';
import { trackstarIntegrationService } from '../integrations/trackstar/service';
import { logger } from '../utils/logger';

export class PeriodicSyncService {
  private incrementalSyncJob: CronJob;
  private nightlyReconciliationJob: CronJob;

  constructor() {
    // Run incremental sync every 5 minutes
    this.incrementalSyncJob = new CronJob('*/5 * * * *', async () => {
      await this.runIncrementalSync();
    }, null, false, 'America/New_York');

    // Run nightly reconciliation at 2 AM every day
    this.nightlyReconciliationJob = new CronJob('0 2 * * *', async () => {
      await this.runNightlyReconciliation();
    }, null, false, 'America/New_York');
  }

  start() {
    this.incrementalSyncJob.start();
    this.nightlyReconciliationJob.start();
    logger.info('Periodic sync service started - running every 5 minutes');
    logger.info('Nightly reconciliation service started - running daily at 2 AM');
  }

  stop() {
    this.incrementalSyncJob.stop();
    this.nightlyReconciliationJob.stop();
    logger.info('Periodic sync service stopped');
    logger.info('Nightly reconciliation service stopped');
  }

  private async runIncrementalSync() {
    try {
      logger.info('Starting periodic incremental sync...');

      // Get all active Trackstar integrations
      const integrations = await prisma.brandIntegration.findMany({
        where: {
          provider: 'TRACKSTAR',
          status: 'ACTIVE',
        },
        include: {
          brand: true,
        },
      });

      logger.info(`Found ${integrations.length} active Trackstar integrations`);

      for (const integration of integrations) {
        try {
          // Check if it's been more than 5 minutes since last sync
          const lastSync = integration.lastSyncedAt;
          const now = new Date();
          const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

          if (!lastSync || lastSync < fiveMinutesAgo) {
            logger.info(`Running incremental sync for brand ${integration.brand.name} (${integration.brandId})`);

            // Queue incremental sync jobs for all functions
            const functions = ['get_orders', 'get_products', 'get_inventory', 'get_shipments'];
            
            for (const func of functions) {
              await trackstarIntegrationService['syncQueue'].add('incremental-sync', {
                brandId: integration.brandId,
                accessToken: integration.accessToken,
                function: func,
                type: 'incremental'
              }, {
                attempts: 3,
                backoff: {
                  type: 'exponential',
                  delay: 2000,
                },
                delay: 1000, // 1 second delay between jobs to avoid overwhelming the API
              });
            }

            // Update last synced timestamp
            await prisma.brandIntegration.update({
              where: { id: integration.id },
              data: { lastSyncedAt: now }
            });

            logger.info(`Incremental sync queued for brand ${integration.brand.name}`);
          } else {
            logger.debug(`Skipping sync for brand ${integration.brand.name} - last sync was ${Math.round((now.getTime() - lastSync.getTime()) / 1000 / 60)} minutes ago`);
          }
        } catch (error) {
          logger.error(`Error during incremental sync for brand ${integration.brand.name}:`, error);
          
          // Mark integration as having an error
          await prisma.brandIntegration.update({
            where: { id: integration.id },
            data: { status: 'ERROR' }
          });
        }
      }

      logger.info('Periodic incremental sync completed');
    } catch (error) {
      logger.error('Error in periodic sync service:', error);
    }
  }

  // Method to manually trigger sync for a specific brand
  async triggerManualSync(brandId: string) {
    try {
      const integration = await prisma.brandIntegration.findUnique({
        where: {
          brandId_provider: {
            brandId,
            provider: 'TRACKSTAR',
          },
        },
      });

      if (!integration) {
        throw new Error('Trackstar integration not found for this brand');
      }

      if (integration.status !== 'ACTIVE') {
        throw new Error('Integration is not active');
      }

      // Queue manual sync jobs
      const functions = ['get_orders', 'get_products', 'get_inventory', 'get_shipments'];
      
      for (const func of functions) {
        await trackstarIntegrationService['syncQueue'].add('manual-sync', {
          brandId: integration.brandId,
          accessToken: integration.accessToken,
          function: func,
          type: 'manual'
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        });
      }

      logger.info(`Manual sync triggered for brand ${brandId}`);
    } catch (error) {
      logger.error(`Error triggering manual sync for brand ${brandId}:`, error);
      throw error;
    }
  }

  private async runNightlyReconciliation() {
    try {
      logger.info('Starting nightly reconciliation sync...');
      
      // Call the Trackstar service to handle the reconciliation
      await trackstarIntegrationService.processNightlyReconciliation();
      
      logger.info('Completed nightly reconciliation sync');
    } catch (error) {
      logger.error('Error in nightly reconciliation sync:', error);
    }
  }
}

export const periodicSyncService = new PeriodicSyncService();
