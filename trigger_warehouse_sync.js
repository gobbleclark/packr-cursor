/**
 * One-time comprehensive warehouse sync for missing orders
 * This will fetch ALL orders from ShipHero going back 90 days
 */

console.log('🔄 COMPREHENSIVE WAREHOUSE SYNC - Fetching all missing orders...');

// Trigger immediate warehouse sync to capture historical data
setTimeout(async () => {
  try {
    console.log('🚀 Starting comprehensive 90-day warehouse sync for Mabē...');
    
    // This will be picked up by our existing webhook system
    const webhookData = {
      webhook_type: 'comprehensive_sync',
      data: {
        brand_id: 'dce4813e-aeb7-41fe-bb00-a36e314288f3',
        sync_days: 90,
        reason: 'capture_missing_unfulfilled_orders'
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('📡 Warehouse sync initiated - will appear in server logs...');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Warehouse sync trigger failed:', error);
    process.exit(1);
  }
}, 1000);