/**
 * Trigger comprehensive data reimport using the working API endpoints
 */

const https = require('https');

async function triggerReimport() {
  console.log('🚨 EMERGENCY COMPREHENSIVE REIMPORT FOR JULY DATA');
  console.log('🎯 Goal: Match ShipHero\'s 14,710 July shipped orders');
  
  const baseUrl = 'http://localhost:5000';
  
  try {
    console.log('\n📍 Step 1: Force complete historical sync going back 180 days to capture July...');
    
    const historicalUrl = `${baseUrl}/api/shiphero/comprehensive-sync/dce4813e-aeb7-41fe-bb00-a36e314288f3`;
    
    const response = await fetch(historicalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        days: 180,
        forceRefresh: true,
        includeJuly: true,
        target: 'july-missing-data'
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Comprehensive sync triggered:', result);
    } else {
      const error = await response.text();
      console.log('❌ Sync trigger failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Failed to trigger comprehensive sync:', error);
  }
}

triggerReimport();