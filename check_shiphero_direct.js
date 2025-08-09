/**
 * Check if there are recent orders directly in ShipHero that haven't synced to Trackstar yet
 * This will help us understand if the issue is ShipHero -> Trackstar sync lag
 */

const { TrackstarService } = await import('./server/services/trackstar.ts');
const { storage } = await import('./server/storage.ts');

async function checkShipHeroConnection() {
  console.log('🔍 Investigating ShipHero connection and potential sync lag...');
  
  try {
    const trackstarService = new TrackstarService();
    const mabeBrand = await storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    
    // Get the connection details
    const connections = await trackstarService.getConnections();
    const mabeConnection = connections[0]; // We know there's only 1
    
    console.log('\n🔗 Connection Analysis:');
    console.log(`Integration: ${mabeConnection.integration_name}`);
    console.log(`Created: ${mabeConnection.created_at}`);
    console.log(`Last Used: ${mabeConnection.last_used}`);
    console.log(`Times Used: ${mabeConnection.times_used}`);
    
    // Check sync schedules for order sync frequency
    console.log('\n⏰ Sync Schedule Analysis:');
    if (mabeConnection.sync_schedules) {
      mabeConnection.sync_schedules.forEach(schedule => {
        console.log(`Function: ${schedule.function_name}`);
        console.log(`  Last sync: ${schedule.latest_sync}`);
        console.log(`  Frequency: ${schedule.sync_frequency} seconds (${schedule.sync_frequency / 3600} hours)`);
        console.log(`  In progress: ${schedule.in_progress}`);
        
        // Check how long ago the last sync was
        if (schedule.latest_sync) {
          const lastSync = new Date(schedule.latest_sync);
          const now = new Date();
          const minutesAgo = (now.getTime() - lastSync.getTime()) / (1000 * 60);
          console.log(`  Last sync: ${minutesAgo.toFixed(1)} minutes ago`);
          
          if (schedule.function_name === 'get_orders' && minutesAgo > 60) {
            console.log(`  ⚠️ Orders haven't synced in over an hour!`);
          }
        }
        console.log('---');
      });
    }
    
    // Check for any errors in the connection
    console.log('\n❌ Error Analysis:');
    if (mabeConnection.errors && mabeConnection.errors.length > 0) {
      console.log(`Found ${mabeConnection.errors.length} connection errors:`);
      mabeConnection.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${JSON.stringify(error)}`);
      });
    } else {
      console.log('✅ No connection errors found');
    }
    
    // Try to trigger a manual sync to get fresh data
    console.log('\n🔄 Attempting to trigger manual sync...');
    try {
      await trackstarService.triggerSync(mabeConnection.connection_id, 'orders');
      console.log('✅ Manual sync triggered successfully');
      
      // Wait a moment then fetch orders again
      console.log('⏳ Waiting 10 seconds for sync to complete...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      console.log('📦 Fetching orders after manual sync...');
      const ordersAfterSync = await trackstarService.getOrdersWithToken(
        mabeBrand.trackstarConnectionId,
        mabeBrand.trackstarAccessToken
      );
      
      console.log(`📊 Orders after manual sync: ${ordersAfterSync.length}`);
      
      // Check if we got any new orders
      const latestAfterSync = ordersAfterSync
        .filter(o => o.created_date)
        .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())[0];
        
      console.log(`Latest order after sync: ${latestAfterSync?.created_date} (${latestAfterSync?.order_number})`);
      
    } catch (syncError) {
      console.log(`❌ Manual sync failed: ${syncError.message}`);
    }
    
    // Check if there are any webhook configurations
    console.log('\n📡 Webhook Analysis:');
    console.log(`Webhooks disabled: ${mabeConnection.webhooks_disabled}`);
    
    if (!mabeConnection.webhooks_disabled) {
      console.log('✅ Webhooks are enabled - real-time sync should be working');
      console.log('This suggests ShipHero should push new orders to Trackstar immediately');
    } else {
      console.log('⚠️ Webhooks are disabled - relying on periodic sync only');
    }
    
    // Final analysis
    console.log('\n🎯 Analysis Summary:');
    console.log('Based on the connection data:');
    
    const orderSync = mabeConnection.sync_schedules?.find(s => s.function_name === 'get_orders');
    if (orderSync) {
      const lastSync = new Date(orderSync.latest_sync);
      const syncFrequency = orderSync.sync_frequency;
      
      console.log(`- Orders sync every ${syncFrequency / 3600} hours`);
      console.log(`- Last synced: ${lastSync.toISOString()}`);
      console.log(`- Webhooks: ${mabeConnection.webhooks_disabled ? 'disabled' : 'enabled'}`);
      
      if (syncFrequency <= 3600 && !mabeConnection.webhooks_disabled) {
        console.log('✅ Configuration looks good for real-time data');
        console.log('If Trackstar dashboard shows newer data, it might be:');
        console.log('  1. Display bug in Trackstar dashboard');
        console.log('  2. Different data source in their dashboard');
        console.log('  3. ShipHero has orders not yet synced');
      }
    }
    
  } catch (error) {
    console.error('❌ ShipHero connection check failed:', error);
  }
}

// Run the check
checkShipHeroConnection().then(() => {
  console.log('\n🎉 ShipHero connection check completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});