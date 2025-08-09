/**
 * Test the correct ways to use next_token for pagination in Trackstar API
 * Based on token structure, try headers, POST body, and different endpoints
 */

const { TrackstarService } = await import('./server/services/trackstar.ts');
const { storage } = await import('./server/storage.ts');

async function testCorrectPagination() {
  console.log('🔍 Testing correct pagination methods with next_token...');
  
  try {
    const trackstarService = new TrackstarService();
    const mabeBrand = await storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    
    const nextToken = "eyJpZCI6ICJUM0prWlhJNk5qSTVOelk1TWpnNCIsICJjb25uZWN0aW9uX2lkIjogImUyMmU2YmM2MzhiZjRkNWY5MGQ0OWYxZWI3M2M2OWMzIn0=";
    
    // 1. Test sending token in headers
    console.log('\n🧪 Testing next_token in headers...');
    
    const headerMethods = [
      { name: 'x-next-token', value: nextToken },
      { name: 'x-trackstar-next-token', value: nextToken },
      { name: 'x-cursor', value: nextToken },
      { name: 'next-token', value: nextToken },
      { name: 'cursor', value: nextToken }
    ];
    
    for (const method of headerMethods) {
      try {
        console.log(`\n🔍 Testing header: ${method.name}`);
        
        const response = await fetch(`${trackstarService.baseUrl}/wms/orders`, {
          method: 'GET',
          headers: {
            'x-trackstar-api-key': trackstarService.apiKey,
            'x-trackstar-access-token': mabeBrand.trackstarAccessToken,
            'Content-Type': 'application/json',
            [method.name]: method.value,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          const count = data.data?.length || 0;
          const hasNextToken = !!data.next_token;
          
          console.log(`   ✅ ${method.name}: ${count} orders, next_token: ${hasNextToken}`);
          
          if (count > 0) {
            // Check if these are different orders
            const firstOrderId = data.data[0]?.id;
            console.log(`   📋 First order ID: ${firstOrderId}`);
            
            if (firstOrderId && firstOrderId !== 'T3JkZXI6NTAxNjcxMTg2') { // Not the first order from our original batch
              console.log(`   🎉 SUCCESS! Found different orders using header method!`);
            }
          }
        } else {
          console.log(`   ❌ ${method.name}: ${response.status}`);
        }
        
      } catch (error) {
        console.log(`   ❌ ${method.name}: ${error.message}`);
      }
    }
    
    // 2. Test POST request with token in body
    console.log('\n🧪 Testing POST with next_token in body...');
    
    const bodyMethods = [
      { next_token: nextToken },
      { cursor: nextToken },
      { pagination_token: nextToken },
      { token: nextToken }
    ];
    
    for (const body of bodyMethods) {
      try {
        const bodyKey = Object.keys(body)[0];
        console.log(`\n🔍 Testing POST body: ${bodyKey}`);
        
        const response = await fetch(`${trackstarService.baseUrl}/wms/orders`, {
          method: 'POST',
          headers: {
            'x-trackstar-api-key': trackstarService.apiKey,
            'x-trackstar-access-token': mabeBrand.trackstarAccessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        
        if (response.ok) {
          const data = await response.json();
          const count = data.data?.length || 0;
          console.log(`   ✅ POST ${bodyKey}: ${count} orders`);
          
          if (count > 0) {
            console.log(`   🎉 SUCCESS! POST method worked!`);
          }
        } else {
          const errorText = await response.text();
          console.log(`   ❌ POST ${bodyKey}: ${response.status} - ${errorText.substring(0, 50)}`);
        }
        
      } catch (error) {
        console.log(`   ❌ POST ${bodyKey}: ${error.message}`);
      }
    }
    
    // 3. Test different pagination endpoints
    console.log('\n🧪 Testing alternative pagination endpoints...');
    
    const paginationEndpoints = [
      `/wms/orders/paginated`,
      `/wms/orders/next`,
      `/wms/orders/continue`,
      `/wms/orders/more`,
      `/paginated/orders`
    ];
    
    for (const endpoint of paginationEndpoints) {
      try {
        console.log(`\n🔍 Testing endpoint: ${endpoint}`);
        
        // Try GET with token in headers
        const response = await fetch(`${trackstarService.baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'x-trackstar-api-key': trackstarService.apiKey,
            'x-trackstar-access-token': mabeBrand.trackstarAccessToken,
            'x-next-token': nextToken,
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
    
    // 4. Test GraphQL-style query (some APIs use this for pagination)
    console.log('\n🧪 Testing GraphQL-style pagination...');
    
    try {
      const graphqlQuery = {
        query: `query GetOrders($cursor: String) { 
          orders(after: $cursor) { 
            data { id order_number } 
            pageInfo { hasNextPage endCursor }
          } 
        }`,
        variables: { cursor: nextToken }
      };
      
      const response = await fetch(`${trackstarService.baseUrl}/graphql`, {
        method: 'POST',
        headers: {
          'x-trackstar-api-key': trackstarService.apiKey,
          'x-trackstar-access-token': mabeBrand.trackstarAccessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(graphqlQuery),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('   ✅ GraphQL endpoint available');
        console.log(`   Response: ${JSON.stringify(data).substring(0, 100)}...`);
      } else {
        console.log(`   ❌ GraphQL: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`   ❌ GraphQL: ${error.message}`);
    }
    
    // 5. Final recommendations
    console.log('\n🎯 PAGINATION IMPLEMENTATION PLAN:');
    console.log('Since Trackstar provides next_token but rejects it in query params:');
    console.log('1. Contact Trackstar support for correct pagination usage');
    console.log('2. The API is likely incomplete or has undocumented pagination');
    console.log('3. We may need to use their SDK or different endpoints');
    console.log('4. Current 1,000 order limit may be intentional for performance');
    
    console.log('\n🚨 CRITICAL FINDING:');
    console.log('The next_token exists but cannot be used - this is a Trackstar API issue');
    console.log('We should implement proper pagination once we find the correct method');
    
  } catch (error) {
    console.error('❌ Pagination testing failed:', error);
  }
}

// Run the test
testCorrectPagination().then(() => {
  console.log('\n🎉 Correct pagination testing completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});