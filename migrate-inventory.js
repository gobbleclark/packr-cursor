const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateInventory() {
  try {
    console.log('Starting inventory migration...');

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

    console.log(`Found ${snapshots.length} inventory snapshots to process`);

    // Group by tenant/brand/sku and take the most recent
    const latestByKey = new Map();
    
    for (const snapshot of snapshots) {
      if (!snapshot.product || !snapshot.brand) {
        console.warn(`Skipping snapshot ${snapshot.id} - missing product or brand`);
        continue;
      }

      const key = `${snapshot.brand.threeplId}-${snapshot.brand.id}-${snapshot.product.sku}`;
      
      if (!latestByKey.has(key)) {
        latestByKey.set(key, snapshot);
      }
    }

    console.log(`Processing ${latestByKey.size} unique inventory items`);

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
            incoming: 0,
            committed: 0,
            unfulfillable: 0,
            unsellable: 0,
            sellable: snapshot.quantityFulfillable,
            awaiting: 0,
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
          console.log(`Migrated ${migrated} inventory items...`);
        }

      } catch (error) {
        console.error(`Failed to migrate inventory item for key ${key}:`, error.message);
        errors++;
      }
    }

    console.log(`Inventory migration completed: ${migrated} items migrated, ${errors} errors`);

  } catch (error) {
    console.error('Failed to migrate inventory snapshots:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateInventory();
