/**
 * Check what warehouses are being pulled for Mabē from Trackstar
 */

const { TrackstarService } = await import('./server/services/trackstar.ts');
const { storage } = await import('./server/storage.ts');

async function checkMabeWarehouses() {
  console.log('🏭 Checking warehouses for Mabē...');
  
  try {
    const trackstarService = new TrackstarService();
    const mabeBrand = await storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    
    console.log(`\n🔗 Mabē connection: ${mabeBrand.trackstarConnectionId}`);
    
    // Get warehouses for this connection
    console.log('\n📋 Getting warehouses from Trackstar...');
    const warehouses = await trackstarService.getWarehousesWithToken(
      mabeBrand.trackstarConnectionId,
      mabeBrand.trackstarAccessToken
    );
    
    console.log(`\n🏭 Found ${warehouses.length} warehouses:`);
    warehouses.forEach(warehouse => {
      console.log(`\n📦 Warehouse: ${warehouse.name || 'Unnamed'}`);
      console.log(`   ID: ${warehouse.id}`);
      console.log(`   Type: ${warehouse.type || 'Unknown'}`);
      console.log(`   Status: ${warehouse.status || 'Unknown'}`);
      console.log(`   Location: ${warehouse.location || 'Not specified'}`);
      if (warehouse.address) {
        console.log(`   Address: ${JSON.stringify(warehouse.address, null, 2)}`);
      }
    });
    
    // Check which warehouses are being used in orders
    console.log(`\n📊 Checking warehouse usage in orders...`);
    
    const recentOrders = await storage.getOrdersByBrand(mabeBrand.id, 100);
    const warehouseUsage = new Map();
    
    recentOrders.forEach(order => {
      const warehouseId = order.warehouseId;
      if (warehouseId) {
        warehouseUsage.set(warehouseId, (warehouseUsage.get(warehouseId) || 0) + 1);
      }
    });
    
    console.log(`\n📈 Warehouse usage in recent orders:`);
    warehouseUsage.forEach((count, warehouseId) => {
      const warehouse = warehouses.find(w => w.id === warehouseId);
      const name = warehouse?.name || 'Unknown Warehouse';
      console.log(`   ${name} (${warehouseId}): ${count} orders`);
    });
    
    // Get sample order to show warehouse details
    const sampleOrder = recentOrders.find(o => o.warehouseId);
    if (sampleOrder) {
      console.log(`\n📋 Sample order warehouse info:`);
      console.log(`   Order: ${sampleOrder.orderNumber}`);
      console.log(`   Warehouse ID: ${sampleOrder.warehouseId}`);
      console.log(`   Warehouse Name: ${sampleOrder.warehouseName || 'Not stored'}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to check warehouses:', error);
  }
}

// Run the check
checkMabeWarehouses().then(() => {
  console.log('\n✅ Warehouse check completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});