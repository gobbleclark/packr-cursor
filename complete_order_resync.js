/**
 * Complete order re-sync with all ShipHero fields including shipped_at timestamps
 * This will update all existing orders with complete field mapping
 */

import http from 'http';

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

async function completeOrderResync() {
  try {
    console.log('🔄 Starting complete order re-sync with all ShipHero fields...');
    console.log('📅 This will update all orders with shipped_at timestamps and complete field mapping');
    
    // Trigger comprehensive sync for past 120 days to capture all orders
    const syncResult = await makeRequest('/api/orders/sync-comprehensive', 'POST', {
      brandId: 'dce4813e-aeb7-41fe-bb00-a36e314288f3',
      days: 120,
      forceUpdate: true
    });
    
    console.log(`Sync response: ${syncResult.status}`);
    if (syncResult.data) {
      console.log('Response:', syncResult.data.substring(0, 500));
    }
    
    if (syncResult.status === 200) {
      console.log('✅ Comprehensive sync initiated');
      console.log('⏳ All orders will be updated with complete ShipHero field mapping...');
      console.log('📊 This includes: shipped_at, delivered_at, allocated_at, packed_at, and all other fields');
    } else {
      console.log('❌ Sync request failed');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

completeOrderResync();