#!/usr/bin/env node

// Manual script to trigger a comprehensive 365-day sync using direct API calls

import http from 'http';

async function triggerComprehensiveSync() {
  try {
    console.log('🚀 Triggering comprehensive 365-day order sync...');
    
    const postData = JSON.stringify({
      brandId: 'dce4813e-aeb7-41fe-bb00-a36e314288f3',
      days: 365
    });

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/orders/sync-historical',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('✅ Sync completed:', response);
        } catch (e) {
          console.log('📄 Response:', data.substring(0, 200));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error);
    });

    req.write(postData);
    req.end();
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  }
}

// Run the script
triggerComprehensiveSync();