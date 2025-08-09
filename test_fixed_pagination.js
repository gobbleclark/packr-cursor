/**
 * Test the fixed pagination implementation using page_token parameter
 * This should get ALL orders, not just the first 1,000
 */

const { TrackstarService } = await import('./server/services/trackstar.ts');
const { storage } = await import('./server/storage.ts');

async function testFixedPagination() {
  console.log('🔍 Testing fixed pagination with page_token parameter...');
  
  try {
    const trackstarService = new TrackstarService();
    const mabeBrand = await storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    
    // Get all orders using the fixed pagination
    console.log('\n📦 Getting ALL orders with fixed pagination...');
    const allOrders = await trackstarService.getAllOrdersWithTokenFixed(
      mabeBrand.trackstarConnectionId,
      mabeBrand.trackstarAccessToken
    );
    
    console.log(`\n🎉 RESULT: Retrieved ${allOrders.length} total orders`);
    
    if (allOrders.length > 1000) {
      console.log(`✅ SUCCESS! Found ${allOrders.length - 1000} additional orders beyond the first 1,000!`);
      
      // Show date range of all orders
      const sortedByDate = allOrders
        .filter(o => o.created_date)
        .sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime());
      
      if (sortedByDate.length > 0) {
        const earliest = sortedByDate[0];
        const latest = sortedByDate[sortedByDate.length - 1];
        
        console.log(`\n📅 Complete date range:`);
        console.log(`   Earliest: ${earliest.created_date} (${earliest.order_number})`);
        console.log(`   Latest: ${latest.created_date} (${latest.order_number})`);
        
        // Check for recent orders
        const july2025OrLater = allOrders.filter(o => {
          const date = new Date(o.created_date);
          return date >= new Date('2025-07-01');
        });
        
        console.log(`\n🚨 Orders from July 2025 onwards: ${july2025OrLater.length}`);
        
        if (july2025OrLater.length > 0) {
          console.log('🎉 FOUND THE MISSING ORDERS!');
          july2025OrLater.slice(0, 5).forEach(order => {
            console.log(`   - ${order.order_number}: ${order.created_date} (${order.status})`);
          });
        }
      }
      
    } else if (allOrders.length === 1000) {
      console.log(`⚠️ Still getting exactly 1,000 orders - pagination might still be broken`);
    } else {
      console.log(`📊 Got ${allOrders.length} orders - this might be all available orders`);
    }
    
    // Compare with database
    console.log(`\n💾 Checking database sync...`);
    const dbOrders = await storage.getOrdersByBrand(mabeBrand.id);
    console.log(`Database has: ${dbOrders.length} orders`);
    
    if (allOrders.length > dbOrders.length) {
      console.log(`🚨 Found ${allOrders.length - dbOrders.length} orders not in database!`);
      console.log('📝 These need to be synced to the database');
    } else {
      console.log(`✅ Database is up to date`);
    }
    
  } catch (error) {
    console.error('❌ Fixed pagination test failed:', error);
  }
}

// Run the test
testFixedPagination().then(() => {
  console.log('\n🎉 Fixed pagination test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});