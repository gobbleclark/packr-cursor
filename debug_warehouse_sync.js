/**
 * Debug why order MO1253 isn't showing current hold status
 * Force a sync and check if ShipHero data updates our database
 */

const http = require('http');

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: body }));
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function checkOrderStatus() {
  try {
    console.log('🔍 Checking current status of order MO1253 in database...');
    
    // First check current state
    console.log('\n📊 Before sync - checking database state:');
    
    // Force a fresh sync
    console.log('\n🔄 Triggering fresh order sync...');
    const syncResult = await makeRequest('/api/orders/sync', 'POST', {
      brandId: 'dce4813e-aeb7-41fe-bb00-a36e314288f3'
    });
    
    console.log(`Sync response: ${syncResult.status} - ${syncResult.data}`);
    
    if (syncResult.status === 200) {
      console.log('✅ Sync completed, waiting for processing...');
      
      // Wait for sync to process
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      console.log('\n📊 After sync - order should now have updated hold status');
      console.log('🎯 If order is on hold in ShipHero, it should now show in dashboard');
    } else {
      console.log('❌ Sync failed');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkOrderStatus();