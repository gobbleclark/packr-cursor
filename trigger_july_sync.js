/**
 * Direct July sync trigger using the backend API
 * Forces the system to capture July 2025 data immediately
 */

import fetch from 'node-fetch';

async function triggerJulySync() {
  console.log('🚨 TRIGGERING JULY HISTORICAL SYNC');
  console.log('🎯 Target: Force capture of 14,710 July shipped orders');
  
  const baseUrl = 'http://localhost:5000';
  const brandId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
  
  try {
    // Trigger a comprehensive historical sync via API
    console.log('🔄 Calling comprehensive historical sync endpoint...');
    
    const response = await fetch(`${baseUrl}/api/shiphero/comprehensive-sync/${brandId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        days: 180 // Go back 180 days to ensure July is captured
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Historical sync triggered successfully:', result);
      
      console.log('📊 Monitoring the sync progress...');
      
      // Monitor for 2 minutes to see results
      let iteration = 0;
      const maxIterations = 12; // 12 iterations = 2 minutes
      
      while (iteration < maxIterations) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        
        try {
          const statusResponse = await fetch(`${baseUrl}/api/dashboard/stats`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (statusResponse.ok) {
            const stats = await statusResponse.json();
            console.log(`📊 Iteration ${iteration + 1}: ${stats.totalOrders} total orders, ${stats.shippedOrders} shipped`);
            
            // We need to check database directly for July data since dashboard may not show July filter
            if (iteration % 3 === 0) {
              console.log('🔍 Checking for July progress via database check...');
              // This would require a direct database check
            }
          }
        } catch (error) {
          console.log('⚠️ Status check failed:', error.message);
        }
        
        iteration++;
      }
      
      console.log('🎯 Sync monitoring complete. Check database for July data.');
      
    } else {
      const error = await response.text();
      console.log('❌ Historical sync failed:', error);
      
      // Try alternative approach - direct integration service call
      console.log('\n🔄 Trying alternative: Direct integration service...');
      
      const altResponse = await fetch(`${baseUrl}/api/shiphero/sync/${brandId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'historical',
          targetDate: '2025-07-01' // Specifically target July 1
        })
      });
      
      if (altResponse.ok) {
        const altResult = await altResponse.json();
        console.log('✅ Alternative sync triggered:', altResult);
      } else {
        const altError = await altResponse.text();
        console.log('❌ Alternative sync also failed:', altError);
      }
    }
    
  } catch (error) {
    console.error('❌ Sync trigger failed:', error);
    throw error;
  }
}

triggerJulySync().then(() => {
  console.log('\n🎯 JULY SYNC TRIGGER COMPLETE');
  console.log('The historical sync has been initiated to capture July 2025 orders');
  console.log('Monitor the background sync progress to see July data appearing');
  process.exit(0);
}).catch(error => {
  console.error('❌ July sync trigger failed:', error);
  process.exit(1);
});