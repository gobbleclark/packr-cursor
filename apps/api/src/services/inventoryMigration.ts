import { prisma } from '../lib/database';
import { logger } from '../utils/logger';

/**
 * Service to migrate existing inventory_snapshots to the new inventory_items table
 * This is a one-time migration to populate the new inventory system
 */
export class InventoryMigrationService {
  
  /**
   * Migrate existing inventory snapshots to inventory_items
   * Groups by brand/sku and takes the most recent snapshot
   */
  async migrateInventorySnapshots(): Promise<void> {
    try {
      logger.info('Starting inventory migration from snapshots to items...');

      // Get all inventory snapshots with their related product and brand info
      const snapshots = await prisma.inventorySnapshot.findMany({
        include: {
          product: {
            select: {
              sku: true,
              name: true,
              brandId: true,
            },
          },
          brand: {
            select: {
              id: true,
              threeplId: true,
            },
          },
        },
        orderBy: {
          asOf: 'desc', // Most recent first
        },
      });

      logger.info(`Found ${snapshots.length} inventory snapshots to process`);

      // Group by tenant/brand/sku and take the most recent
      const latestByKey = new Map<string, typeof snapshots[0]>();
      
      for (const snapshot of snapshots) {
        if (!snapshot.product || !snapshot.brand) {
          logger.warn(`Skipping snapshot ${snapshot.id} - missing product or brand`);
          continue;
        }

        const key = `${snapshot.brand.threeplId}-${snapshot.brand.id}-${snapshot.product.sku}`;
        
        if (!latestByKey.has(key)) {
          latestByKey.set(key, snapshot);
        }
      }

      logger.info(`Processing ${latestByKey.size} unique inventory items`);

      let migrated = 0;
      let errors = 0;

      // Create inventory items from the latest snapshots
      for (const [key, snapshot] of latestByKey) {
        try {
          if (!snapshot.product || !snapshot.brand) continue;

          await prisma.inventoryItem.upsert({
            where: {
              tenantId_brandId_sku: {
                tenantId: snapshot.brand.threeplId,
                brandId: snapshot.brand.id,
                sku: snapshot.product.sku,
              },
            },
            create: {
              tenantId: snapshot.brand.threeplId,
              brandId: snapshot.brand.id,
              sku: snapshot.product.sku,
              productName: snapshot.product.name,
              onHand: snapshot.quantityOnHand,
              available: snapshot.quantityFulfillable,
              incoming: 0, // Not available in old snapshots
              committed: 0, // Not available in old snapshots
              unfulfillable: 0, // Not available in old snapshots
              unsellable: 0, // Not available in old snapshots
              sellable: snapshot.quantityFulfillable, // Use fulfillable as sellable
              awaiting: 0, // Not available in old snapshots
              warehouseId: snapshot.location,
              lastTrackstarUpdateAt: snapshot.asOf,
              rawData: snapshot.rawData,
            },
            update: {
              productName: snapshot.product.name,
              onHand: snapshot.quantityOnHand,
              available: snapshot.quantityFulfillable,
              sellable: snapshot.quantityFulfillable,
              warehouseId: snapshot.location,
              lastTrackstarUpdateAt: snapshot.asOf,
              rawData: snapshot.rawData,
            },
          });

          migrated++;
          
          if (migrated % 100 === 0) {
            logger.info(`Migrated ${migrated} inventory items...`);
          }

        } catch (error) {
          logger.error(`Failed to migrate inventory item for key ${key}:`, error);
          errors++;
        }
      }

      logger.info(`Inventory migration completed: ${migrated} items migrated, ${errors} errors`);

    } catch (error) {
      logger.error('Failed to migrate inventory snapshots:', error);
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{
    snapshotCount: number;
    itemCount: number;
    migrationNeeded: boolean;
  }> {
    const [snapshotCount, itemCount] = await Promise.all([
      prisma.inventorySnapshot.count(),
      prisma.inventoryItem.count(),
    ]);

    return {
      snapshotCount,
      itemCount,
      migrationNeeded: snapshotCount > 0 && itemCount === 0,
    };
  }
}

export const inventoryMigrationService = new InventoryMigrationService();
