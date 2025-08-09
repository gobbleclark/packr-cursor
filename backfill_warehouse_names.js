/**
 * Backfill warehouse names for existing orders using Trackstar API
 */

const { TrackstarService } = await import('./server/services/trackstar.ts');
const { storage } = await import('./server/storage.ts');

async function backfillWarehouseNames() {
  console.log('🏭 Backfilling warehouse names for Mabē orders...');
  
  try {
    const trackstarService = new TrackstarService();
    const mabeBrand = await storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    
    // Get warehouse info from Trackstar
    const warehouses = await trackstarService.getWarehousesWithToken(
      mabeBrand.trackstarConnectionId,
      mabeBrand.trackstarAccessToken
    );
    
    console.log(`\n📋 Found ${warehouses.length} warehouses:`);
    const warehouseMap = new Map();
    
    warehouses.forEach(warehouse => {
      warehouseMap.set(warehouse.id, warehouse.name);
      console.log(`   ${warehouse.id} -> ${warehouse.name}`);
    });
    
    // Get all orders without warehouse names
    const ordersNeedingNames = await storage.getOrdersWithoutWarehouseNames(mabeBrand.id);
    console.log(`\n📦 Found ${ordersNeedingNames.length} orders needing warehouse names`);
    
    let updated = 0;
    
    for (const order of ordersNeedingNames) {
      if (order.warehouseId) {
        const warehouseName = warehouseMap.get(order.warehouseId);
        
        if (warehouseName) {
          await storage.updateOrderWarehouseName(order.id, warehouseName);
          updated++;
          
          if (updated % 100 === 0) {
            console.log(`✅ Updated ${updated} orders...`);
          }
        }
      }
    }
    
    console.log(`\n🎉 Successfully updated ${updated} orders with warehouse names!`);
    
    // Show summary
    const summary = await storage.getWarehouseUsageSummary(mabeBrand.id);
    console.log(`\n📊 Warehouse usage summary:`);
    summary.forEach(({ warehouse_name, warehouse_id, order_count }) => {
      console.log(`   ${warehouse_name || 'Unknown'} (${warehouse_id}): ${order_count} orders`);
    });
    
  } catch (error) {
    console.error('❌ Failed to backfill warehouse names:', error);
  }
}

// Run the backfill
backfillWarehouseNames().then(() => {
  console.log('\n✅ Warehouse name backfill completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});