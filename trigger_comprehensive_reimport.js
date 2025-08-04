/**
 * Trigger comprehensive reimport to capture order 650411765 from July 30, 2025
 * This script directly calls our sync service to ensure we get historical data
 */

const fs = require('fs');
const path = require('path');

// Simple HTTP request function using Node.js built-ins
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlParts = new URL(url);
    const protocol = urlParts.protocol === 'https:' ? require('https') : require('http');
    
    const requestOptions = {
      hostname: urlParts.hostname,
      port: urlParts.port || (urlParts.protocol === 'https:' ? 443 : 80),
      path: urlParts.pathname + urlParts.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function triggerComprehensiveSync() {
  try {
    console.log('🎯 Triggering comprehensive historical reimport...');
    console.log('📅 Target: Capture order 650411765 from July 30, 2025');
    
    // First, let's trigger a manual historical sync for the past 10 days
    const syncPayload = JSON.stringify({
      brandId: 'dce4813e-aeb7-41fe-bb00-a36e314288f3',
      days: 10,
      forceFullSync: true
    });

    console.log('🔄 Sending sync request for 10 days of historical data...');
    
    const result = await makeRequest('http://localhost:5000/api/orders/sync-historical', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: syncPayload
    });

    console.log(`📊 Sync response status: ${result.statusCode}`);
    console.log(`📊 Sync response: ${result.data}`);

    if (result.statusCode === 200) {
      console.log('✅ Historical sync initiated');
      console.log('⏳ Orders from July 30th should be imported shortly...');
      
      // Wait a bit then check for the order
      console.log('⏳ Waiting 30 seconds for sync to process...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      console.log('🔍 Checking if order 650411765 is now in database...');
      
    } else {
      console.log('❌ Sync request failed');
    }

  } catch (error) {
    console.error('❌ Error triggering comprehensive sync:', error);
  }
}

// Also check the current sync status
async function checkSyncStatus() {
  try {
    console.log('📊 Checking current sync status...');
    
    const result = await makeRequest('http://localhost:5000/api/sync/status');
    console.log(`📊 Status response: ${result.data}`);
    
  } catch (error) {
    console.error('❌ Error checking sync status:', error);
  }
}

async function main() {
  await checkSyncStatus();
  await triggerComprehensiveSync();
}

main();