/**
 * Manual 30-day historical sync to capture order 650411765 from July 30, 2025
 */

import fetch from 'node-fetch';

async function triggerExtendedSync() {
  try {
    console.log('🎯 Triggering extended historical sync to capture July 30th orders...');
    
    // Calculate 30 days back to ensure we capture July 30th orders
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    console.log(`📅 Sync start date: ${thirtyDaysAgo.toISOString()}`);
    console.log(`📅 Current date: ${new Date().toISOString()}`);
    
    // This should capture all orders from ~July 5th to August 4th
    const response = await fetch('http://localhost:5000/api/orders/sync-historical', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        brandId: 'dce4813e-aeb7-41fe-bb00-a36e314288f3',
        days: 30
      })
    });
    
    const result = await response.text();
    console.log('📊 Sync response:', result);
    
    if (response.ok) {
      console.log('✅ Extended sync initiated successfully');
      console.log('⏳ Orders from July 30th should be captured in the next few minutes...');
    } else {
      console.log('❌ Sync failed:', result);
    }
    
  } catch (error) {
    console.error('❌ Error triggering sync:', error);
  }
}

triggerExtendedSync();