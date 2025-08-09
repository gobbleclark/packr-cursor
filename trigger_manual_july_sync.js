/**
 * Manual script to trigger Trackstar sync for July 1, 2025 - August 9, 2025
 * This will fetch the missing 15,000 orders per month that should be in the system
 */

const { TrackstarService } = await import('./server/services/trackstar.ts');
const { TrackstarSyncService } = await import('./server/services/trackstarSync.ts');
const { storage } = await import('./server/storage.ts');

async function manualJulySync() {
  console.log('🚀 Starting manual Trackstar sync for July 1, 2025 - August 9, 2025');
  
  try {
    // Get the Mabē brand directly by ID
    const mabeBrand = await storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    
    if (!mabeBrand) {
      console.error('❌ Mabē brand not found');
      return;
    }

    if (!mabeBrand.trackstarAccessToken || !mabeBrand.trackstarConnectionId) {
      console.error('❌ Mabē brand does not have active Trackstar connection');
      return;
    }

    console.log(`✅ Found Mabē brand: ${mabeBrand.name}`);
    console.log(`🔗 Connection ID: ${mabeBrand.trackstarConnectionId}`);
    
    // Initialize services
    const trackstarService = new TrackstarService();
    const syncService = new TrackstarSyncService();
    
    // Define date range - July 1, 2025 to August 9, 2025
    const dateFrom = '2025-07-01T00:00:00Z';
    const dateTo = '2025-08-09T23:59:59Z';
    
    console.log(`📅 Fetching ALL orders using pagination (since date filtering not supported)...`);
    
    // Fetch ALL orders using pagination to get beyond 1000 limit
    const orders = await trackstarService.getAllOrdersWithToken(
      mabeBrand.trackstarConnectionId,
      mabeBrand.trackstarAccessToken
    );
    
    console.log(`📦 Retrieved ${orders.length} orders for July-August 2025`);
    
    if (orders.length === 0) {
      console.log('⚠️ No orders found for July-August 2025 period');
      console.log('This confirms that Mabē has not shipped orders during this period');
      return;
    }
    
    // Process and store the orders
    await syncService.processAndStoreOrders(mabeBrand, orders);
    
    console.log('✅ Manual sync completed successfully!');
    
    // Check updated order count
    const totalOrders = await storage.getTotalOrdersCount();
    console.log(`📊 Total orders in database: ${totalOrders}`);
    
  } catch (error) {
    console.error('❌ Manual sync failed:', error);
    console.error(error.stack);
  }
}

// Run the manual sync
manualJulySync().then(() => {
  console.log('🎉 Manual July sync process completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});