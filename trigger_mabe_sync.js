// Direct sync trigger for Mabē brand to test real data fetching
import fetch from 'node-fetch';

async function triggerMabeSync() {
  try {
    console.log('🔄 Triggering direct sync for Mabē brand...');
    
    // Get brand data
    const response = await fetch('http://localhost:5000/api/trackstar/sync/dce4813e-aeb7-41fe-bb00-a36e314288f3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.text();
    console.log('📡 Sync response:', result);
    
    // Check orders after sync
    const ordersResponse = await fetch('http://localhost:5000/api/orders');
    const orders = await ordersResponse.json();
    console.log(`📦 Orders in DB after sync: ${orders?.length || 0}`);
    
  } catch (error) {
    console.error('❌ Sync error:', error.message);
  }
}

triggerMabeSync();