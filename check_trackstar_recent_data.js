/**
 * Check if there are multiple connections or if we're missing more recent data
 * This will help understand why Trackstar dashboard shows data we don't have
 */

const { TrackstarService } = await import('./server/services/trackstar.ts');
const { storage } = await import('./server/storage.ts');

async function checkRecentData() {
  console.log('🔍 Checking for recent Trackstar data...');
  
  try {
    const trackstarService = new TrackstarService();
    const mabeBrand = await storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    
    if (!mabeBrand?.trackstarAccessToken || !mabeBrand?.trackstarConnectionId) {
      console.error('❌ No Trackstar connection found');
      return;
    }
    
    console.log(`✅ Checking connection: ${mabeBrand.trackstarConnectionId}`);
    
    // Check different endpoints to see if we can find more recent data
    const endpoints = [
      { name: 'Orders', method: 'getOrdersWithToken' },
      { name: 'Products', method: 'getProductsWithToken' },
      { name: 'Inventory', method: 'getInventoryWithToken' },
      { name: 'Warehouses', method: 'getWarehousesWithToken' }
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`\n📊 Testing ${endpoint.name} endpoint...`);
        const data = await trackstarService[endpoint.method](
          mabeBrand.trackstarConnectionId,
          mabeBrand.trackstarAccessToken
        );
        
        console.log(`✅ ${endpoint.name}: ${data.length} records`);
        
        if (endpoint.name === 'Orders' && data.length > 0) {
          // Check for the most recent orders
          const recentOrders = data
            .map(order => ({
              id: order.id || order.order_id || order.order_number,
              date: order.created_at || order.order_date || order.date,
              status: order.status || order.fulfillment_status || 'unknown'
            }))
            .filter(order => order.date)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 10);
            
          console.log('\n📅 Most recent 10 orders:');
          recentOrders.forEach((order, index) => {
            console.log(`${index + 1}. ${order.id} - ${order.date} - ${order.status}`);
          });
        }
        
      } catch (error) {
        console.log(`❌ ${endpoint.name} failed: ${error.message}`);
      }
    }
    
    // Also check what orders we have in our database for comparison
    console.log('\n📊 Database comparison:');
    const dbOrders = await storage.getOrders(mabeBrand.id, { limit: 10, orderBy: 'order_date', orderDirection: 'desc' });
    console.log(`Database has ${dbOrders.length} recent orders:`);
    dbOrders.forEach((order, index) => {
      console.log(`${index + 1}. ${order.id} - ${order.orderDate} - ${order.fulfillmentStatus}`);
    });
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

// Run the check
checkRecentData().then(() => {
  console.log('\n🎉 Recent data check completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});