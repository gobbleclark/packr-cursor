/**
 * Test cursor-based or alternative pagination methods to get ALL orders
 * Trackstar might use cursors, next_token, or date-based batching
 */

const { TrackstarService } = await import('./server/services/trackstar.ts');
const { storage } = await import('./server/storage.ts');

async function testCursorPagination() {
  console.log('🔍 Testing cursor-based and alternative pagination methods...');
  
  try {
    const trackstarService = new TrackstarService();
    const mabeBrand = await storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    
    // 1. First, get the standard response and analyze its structure for pagination hints
    console.log('\n📦 Analyzing response structure for pagination hints...');
    
    const response = await fetch(`${trackstarService.baseUrl}/wms/orders`, {
      method: 'GET',
      headers: {
        'x-trackstar-api-key': trackstarService.apiKey,
        'x-trackstar-access-token': mabeBrand.trackstarAccessToken,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Response failed: ${response.status}`);
    }
    
    const fullResponse = await response.json();
    console.log('\n📊 Full response structure:');
    Object.keys(fullResponse).forEach(key => {
      const value = fullResponse[key];
      if (Array.isArray(value)) {
        console.log(`  ${key}: Array[${value.length}]`);
      } else {
        console.log(`  ${key}: ${typeof value} = ${JSON.stringify(value)}`);
      }
    });
    
    // Check for pagination metadata
    const paginationHints = ['next', 'cursor', 'next_token', 'has_more', 'total', 'page_info', 'pagination'];
    const foundHints = paginationHints.filter(hint => fullResponse.hasOwnProperty(hint));
    
    if (foundHints.length > 0) {
      console.log(`\n🎯 Found pagination hints: ${foundHints.join(', ')}`);
      foundHints.forEach(hint => {
        console.log(`  ${hint}: ${JSON.stringify(fullResponse[hint])}`);
      });
    } else {
      console.log('\n❌ No obvious pagination metadata found');
    }
    
    // 2. Test cursor-based pagination if we find hints
    if (fullResponse.next || fullResponse.cursor || fullResponse.next_token) {
      console.log('\n🔄 Testing cursor-based pagination...');
      
      const cursorField = fullResponse.next || fullResponse.cursor || fullResponse.next_token;
      console.log(`Using cursor: ${cursorField}`);
      
      const cursorParams = [
        `cursor=${encodeURIComponent(cursorField)}`,
        `next=${encodeURIComponent(cursorField)}`, 
        `next_token=${encodeURIComponent(cursorField)}`,
        `after=${encodeURIComponent(cursorField)}`
      ];
      
      for (const param of cursorParams) {
        try {
          console.log(`\n🧪 Testing cursor parameter: ${param}`);
          
          const cursorResponse = await fetch(`${trackstarService.baseUrl}/wms/orders?${param}`, {
            method: 'GET',
            headers: {
              'x-trackstar-api-key': trackstarService.apiKey,
              'x-trackstar-access-token': mabeBrand.trackstarAccessToken,
              'Content-Type': 'application/json',
            },
          });
          
          if (cursorResponse.ok) {
            const cursorData = await cursorResponse.json();
            const count = cursorData.data?.length || cursorData.orders?.length || 0;
            console.log(`   ✅ ${param}: ${count} orders`);
            
            if (count > 0) {
              console.log(`   🎉 SUCCESS! Found additional orders with cursor pagination!`);
              // Show sample of new orders
              const orders = cursorData.data || cursorData.orders;
              console.log(`   Sample orders: ${orders.slice(0, 3).map(o => o.order_number).join(', ')}`);
            }
          } else {
            const errorText = await cursorResponse.text();
            console.log(`   ❌ ${param}: ${cursorResponse.status} - ${errorText.substring(0, 100)}`);
          }
          
        } catch (error) {
          console.log(`   ❌ ${param}: ${error.message}`);
        }
      }
    }
    
    // 3. Test date-based batching (if API limits by date)
    console.log('\n📅 Testing date-based pagination...');
    
    const orders = fullResponse.data || fullResponse.orders;
    if (orders && orders.length > 0) {
      // Get the earliest order date
      const sortedByDate = orders
        .filter(o => o.created_date)
        .sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime());
      
      if (sortedByDate.length > 0) {
        const earliestDate = sortedByDate[0].created_date;
        console.log(`Earliest order in current batch: ${earliestDate}`);
        
        // Try to get orders before this date
        const beforeDate = new Date(earliestDate);
        beforeDate.setDate(beforeDate.getDate() - 1); // One day before
        const beforeDateStr = beforeDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        const dateParams = [
          `created_before=${beforeDateStr}`,
          `before=${beforeDateStr}`,
          `until=${beforeDateStr}`,
          `end_date=${beforeDateStr}`,
          `to=${beforeDateStr}`
        ];
        
        for (const param of dateParams) {
          try {
            console.log(`\n🧪 Testing date parameter: ${param}`);
            
            const dateResponse = await fetch(`${trackstarService.baseUrl}/wms/orders?${param}`, {
              method: 'GET',
              headers: {
                'x-trackstar-api-key': trackstarService.apiKey,
                'x-trackstar-access-token': mabeBrand.trackstarAccessToken,
                'Content-Type': 'application/json',
              },
            });
            
            if (dateResponse.ok) {
              const dateData = await dateResponse.json();
              const count = dateData.data?.length || dateData.orders?.length || 0;
              console.log(`   ✅ ${param}: ${count} orders`);
              
              if (count > 0) {
                console.log(`   🎉 SUCCESS! Found ${count} orders before ${beforeDateStr}!`);
                
                // Check if these are different orders
                const newOrders = dateData.data || dateData.orders;
                const existingOrderIds = new Set(orders.map(o => o.id));
                const uniqueNewOrders = newOrders.filter(o => !existingOrderIds.has(o.id));
                
                console.log(`   📊 Unique new orders: ${uniqueNewOrders.length}`);
                
                if (uniqueNewOrders.length > 0) {
                  console.log('   🚨 FOUND MISSING ORDERS! We need date-based pagination!');
                  console.log(`   Sample: ${uniqueNewOrders.slice(0, 3).map(o => `${o.order_number} (${o.created_date})`).join(', ')}`);
                }
              }
            } else {
              const errorText = await dateResponse.text();
              console.log(`   ❌ ${param}: ${dateResponse.status} - ${errorText.substring(0, 100)}`);
            }
            
          } catch (error) {
            console.log(`   ❌ ${param}: ${error.message}`);
          }
        }
      }
    }
    
    // 4. Final recommendation
    console.log('\n🎯 PAGINATION SOLUTION:');
    
    if (foundHints.length > 0) {
      console.log('✅ Found pagination metadata in API response');
      console.log('📝 Implement cursor-based pagination using the found hints');
    } else {
      console.log('❌ No pagination metadata found in API response');
      console.log('🤔 This suggests either:');
      console.log('   1. 1,000 orders is truly the total (unlikely for a business)');
      console.log('   2. Trackstar uses a different pagination method'); 
      console.log('   3. We need to contact Trackstar support for pagination docs');
      console.log('   4. There might be date-based or ID-based cursor pagination');
      
      console.log('\n💡 NEXT STEPS:');
      console.log('1. Check Trackstar API documentation for pagination');
      console.log('2. Try ID-based pagination (using last order ID as cursor)');
      console.log('3. Contact Trackstar support if no documentation exists');
    }
    
  } catch (error) {
    console.error('❌ Cursor pagination test failed:', error);
  }
}

// Run the test
testCursorPagination().then(() => {
  console.log('\n🎉 Cursor pagination testing completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});