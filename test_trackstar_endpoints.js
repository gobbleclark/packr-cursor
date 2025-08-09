/**
 * Test different Trackstar endpoints to see if there are other sources of order data
 * This will check if orders endpoint vs other endpoints show different results
 */

const { TrackstarService } = await import('./server/services/trackstar.ts');
const { storage } = await import('./server/storage.ts');

async function testTrackstarEndpoints() {
  console.log('🔍 Testing different Trackstar endpoints for order data...');
  
  try {
    const trackstarService = new TrackstarService();
    const mabeBrand = await storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    
    // 1. Test the main orders endpoint (what we're already using)
    console.log('\n📦 Testing /wms/orders endpoint...');
    const orders = await trackstarService.getOrdersWithToken(
      mabeBrand.trackstarConnectionId,
      mabeBrand.trackstarAccessToken
    );
    console.log(`   Found: ${orders.length} orders`);
    
    if (orders.length > 0) {
      const latest = orders
        .filter(o => o.created_date)
        .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())[0];
      console.log(`   Latest by created_date: ${latest?.created_date} (${latest?.order_number})`);
    }
    
    // 2. Test if there's a different orders endpoint
    console.log('\n📦 Testing alternative endpoints...');
    
    const alternativeEndpoints = [
      { url: `${trackstarService.baseUrl}/orders`, name: 'Direct orders endpoint' },
      { url: `${trackstarService.baseUrl}/wms/orders?limit=2000`, name: 'Orders with higher limit' },
      { url: `${trackstarService.baseUrl}/wms/shipments`, name: 'Shipments endpoint' }
    ];
    
    for (const endpoint of alternativeEndpoints) {
      try {
        console.log(`\n🔍 Testing ${endpoint.name}...`);
        
        const response = await fetch(endpoint.url, {
          method: 'GET',
          headers: {
            'x-trackstar-api-key': trackstarService.apiKey,
            'x-trackstar-access-token': mabeBrand.trackstarAccessToken,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          const count = data.data?.length || data.orders?.length || data.length || 0;
          console.log(`   ✅ ${endpoint.name}: ${count} records`);
          
          // If we got different results, show sample data
          if (endpoint.name.includes('higher limit') && count !== orders.length) {
            console.log(`   🚨 Different count! Expected ${orders.length}, got ${count}`);
          }
        } else {
          const errorText = await response.text();
          console.log(`   ❌ ${endpoint.name}: ${response.status} - ${errorText}`);
        }
      } catch (error) {
        console.log(`   ❌ ${endpoint.name}: ${error.message}`);
      }
    }
    
    // 3. Check if there's a way to get orders by date range that works
    console.log('\n📅 Testing date range parameters...');
    
    const dateParams = [
      { param: 'created_after=2025-07-01', desc: 'created_after July 2025' },
      { param: 'updated_after=2025-07-01', desc: 'updated_after July 2025' },
      { param: 'from=2025-07-01', desc: 'from July 2025' },
      { param: 'since=2025-07-01', desc: 'since July 2025' }
    ];
    
    for (const dateParam of dateParams) {
      try {
        const url = `${trackstarService.baseUrl}/wms/orders?${dateParam.param}`;
        
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
          const count = data.data?.length || data.orders?.length || 0;
          console.log(`   ✅ ${dateParam.desc}: ${count} orders`);
        } else {
          const errorText = await response.text();
          console.log(`   ❌ ${dateParam.desc}: ${response.status} - ${errorText.substring(0, 100)}`);
        }
      } catch (error) {
        console.log(`   ❌ ${dateParam.desc}: ${error.message}`);
      }
    }
    
    // 4. Check if there are webhook or recent events endpoints
    console.log('\n📡 Testing event/webhook endpoints...');
    
    const eventEndpoints = [
      '/events',
      '/webhooks',
      '/recent',
      '/activity',
      '/updates'
    ];
    
    for (const eventPath of eventEndpoints) {
      try {
        const url = `${trackstarService.baseUrl}${eventPath}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'x-trackstar-api-key': trackstarService.apiKey,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`   ✅ ${eventPath}: Available (${JSON.stringify(data).substring(0, 50)}...)`);
        } else if (response.status !== 404) {
          console.log(`   ⚠️ ${eventPath}: ${response.status}`);
        }
      } catch (error) {
        // Ignore connection errors for exploratory testing
      }
    }
    
  } catch (error) {
    console.error('❌ Endpoint testing failed:', error);
  }
}

// Run the test
testTrackstarEndpoints().then(() => {
  console.log('\n🎉 Endpoint testing completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});