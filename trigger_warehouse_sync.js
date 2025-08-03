// Import the Real API Sync Service and trigger warehouse inventory sync
const { RealApiSyncService } = require('./server/services/realApiSync.ts');

async function triggerWarehouseSync() {
  try {
    console.log('=== TRIGGERING WAREHOUSE INVENTORY SYNC ===');
    
    const syncService = new RealApiSyncService();
    const brandId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
    
    console.log('Starting sync for Mabē brand...');
    const result = await syncService.syncBrandData(brandId);
    
    console.log('Sync completed with results:');
    console.log('Success:', result.success);
    console.log('Orders synced:', result.orders);
    console.log('Products synced:', result.products);
    console.log('Shipments synced:', result.shipments);
    console.log('Errors:', result.errors);
    
    if (result.success) {
      console.log('✅ Warehouse inventory sync successful!');
    } else {
      console.log('❌ Sync had errors:', result.errors);
    }
    
  } catch (error) {
    console.error('Failed to trigger sync:', error);
  }
}

triggerWarehouseSync();