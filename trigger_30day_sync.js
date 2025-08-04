/**
 * Trigger 30-day historical sync for Mabē
 * Uses existing infrastructure to perform comprehensive sync
 */

const { performance } = require('perf_hooks');

async function trigger30DaySync() {
  console.log('🔄 Triggering 30-day historical sync for Mabē...');
  
  try {
    // Make API call to trigger the sync
    const response = await fetch('http://localhost:5000/api/orders/sync-historical', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        brandId: 'dce4813e-aeb7-41fe-bb00-a36e314288f3', // Mabē brand ID
        days: 30,
        force: true
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Sync API call failed:', error);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Historical sync triggered:', result);
    
  } catch (error) {
    console.error('❌ Failed to trigger historical sync:', error);
  }
}

trigger30DaySync();