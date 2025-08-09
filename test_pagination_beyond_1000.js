/**
 * Test if there are actually more orders beyond the 1,000 we're getting
 * This will help us understand if pagination is needed and possible
 */

const { TrackstarService } = await import('./server/services/trackstar.ts');
const { storage } = await import('./server/storage.ts');

async function testPaginationNeeds() {
  console.log('🔍 Testing if we need pagination to get all orders...');
  
  try {
    const trackstarService = new TrackstarService();
    const mabeBrand = await storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    
    // 1. Get the standard response 
    console.log('\n📦 Getting standard orders response...');
    const standardOrders = await trackstarService.getOrdersWithToken(
      mabeBrand.trackstarConnectionId,
      mabeBrand.trackstarAccessToken
    );
    
    console.log(`Standard response: ${standardOrders.length} orders`);
    
    // 2. Test various approaches to get more data
    console.log('\n🔍 Testing different approaches to get more orders...');
    
    const testApproaches = [
      { 
        name: 'With limit=2000', 
        url: `${trackstarService.baseUrl}/wms/orders?limit=2000` 
      },
      { 
        name: 'With limit=5000', 
        url: `${trackstarService.baseUrl}/wms/orders?limit=5000` 
      },
      { 
        name: 'With limit=10000', 
        url: `${trackstarService.baseUrl}/wms/orders?limit=10000` 
      },
      { 
        name: 'With page=2', 
        url: `${trackstarService.baseUrl}/wms/orders?page=2` 
      },
      { 
        name: 'With offset=1000', 
        url: `${trackstarService.baseUrl}/wms/orders?offset=1000` 
      },
      { 
        name: 'With skip=1000', 
        url: `${trackstarService.baseUrl}/wms/orders?skip=1000` 
      },
      { 
        name: 'With start=1000', 
        url: `${trackstarService.baseUrl}/wms/orders?start=1000` 
      }
    ];
    
    for (const approach of testApproaches) {
      try {
        console.log(`\n🧪 Testing: ${approach.name}`);
        
        const response = await fetch(approach.url, {
          method: 'GET',
          headers: {
            'x-trackstar-api-key': trackstarService.apiKey,
            'x-trackstar-access-token': mabeBrand.trackstarAccessToken,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          const count = data.data?.length || data.orders?.length || 0;
          console.log(`   ✅ ${approach.name}: ${count} orders`);
          
          if (count > standardOrders.length) {
            console.log(`   🎉 SUCCESS! Found ${count - standardOrders.length} additional orders!`);
          } else if (count === 0 && approach.name.includes('page=2')) {
            console.log(`   ✅ Page 2 is empty - confirms we have all orders`);
          } else if (count === standardOrders.length) {
            console.log(`   ➡️ Same count as standard response`);
          }
        } else {
          const errorText = await response.text();
          console.log(`   ❌ ${approach.name}: ${response.status} - ${errorText.substring(0, 100)}`);
        }
        
      } catch (error) {
        console.log(`   ❌ ${approach.name}: ${error.message}`);
      }
    }
    
    // 3. Check if we can get recent orders using other methods
    console.log('\n🔍 Testing alternative endpoints for recent orders...');
    
    const alternativeEndpoints = [
      `/wms/orders/recent`,
      `/wms/orders/latest`, 
      `/wms/orders/new`,
      `/wms/orders/updated`,
      `/wms/activity`,
      `/wms/events`
    ];
    
    for (const endpoint of alternativeEndpoints) {
      try {
        const url = `${trackstarService.baseUrl}${endpoint}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'x-trackstar-api-key': trackstarService.apiKey,
            'x-trackstar-access-token': mabeBrand.trackstarAccessToken,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          const count = data.data?.length || data.length || 0;
          console.log(`   ✅ ${endpoint}: ${count} records`);
        } else if (response.status !== 404) {
          console.log(`   ⚠️ ${endpoint}: ${response.status}`);
        }
      } catch (error) {
        // Ignore connection errors for exploratory testing
      }
    }
    
    // 4. Final analysis
    console.log('\n🎯 PAGINATION ANALYSIS:');
    
    if (standardOrders.length === 1000) {
      console.log('⚠️ We have exactly 1,000 orders - this might be a pagination limit!');
      console.log('📊 This is a common API pattern where 1,000 is the max per page');
      console.log('🔍 We need to implement proper pagination to get all orders');
      console.log('📈 There could be thousands more orders beyond the first 1,000');
      
      // Check the date range of our 1000 orders
      const sortedByDate = standardOrders
        .filter(o => o.created_date)
        .sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime());
      
      if (sortedByDate.length > 0) {
        const earliest = sortedByDate[0];
        const latest = sortedByDate[sortedByDate.length - 1];
        
        console.log(`\n📅 Date range of our 1,000 orders:`);
        console.log(`   Earliest: ${earliest.created_date} (${earliest.order_number})`);
        console.log(`   Latest: ${latest.created_date} (${latest.order_number})`);
        
        const earliestDate = new Date(earliest.created_date);
        const latestDate = new Date(latest.created_date);
        const daysDiff = (latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24);
        
        console.log(`   Time span: ${daysDiff.toFixed(0)} days`);
        
        if (daysDiff > 30) {
          console.log('💡 Large time span suggests these might be ALL the orders');
        } else {
          console.log('🚨 Short time span suggests there might be many more orders!');
        }
      }
    } else {
      console.log(`✅ We have ${standardOrders.length} orders - not hitting the 1,000 limit`);
      console.log('📊 This suggests we have all available orders');
    }
    
  } catch (error) {
    console.error('❌ Pagination test failed:', error);
  }
}

// Run the test
testPaginationNeeds().then(() => {
  console.log('\n🎉 Pagination testing completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});