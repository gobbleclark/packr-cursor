/**
 * Check if there are other connections in the Trackstar account that might have more recent orders
 * Maybe Mabē has multiple connections or switched to a new one
 */

const { TrackstarService } = await import('./server/services/trackstar.ts');

async function checkAllConnections() {
  console.log('🔍 Checking all connections in Trackstar account for recent orders...');
  
  try {
    const trackstarService = new TrackstarService();
    
    // Get all connections 
    const connections = await trackstarService.getConnections();
    console.log(`📋 Found ${connections.length} connections in account`);
    
    for (let i = 0; i < connections.length; i++) {
      const connection = connections[i];
      console.log(`\n--- Connection ${i + 1} ---`);
      console.log(`ID: ${connection.connection_id}`);
      console.log(`Integration: ${connection.integration_name}`);
      console.log(`Created: ${connection.created_at}`);
      console.log(`Last Used: ${connection.last_used}`);
      console.log(`Times Used: ${connection.times_used}`);
      
      // Check if this connection has recent sync activity
      if (connection.sync_schedules) {
        console.log('Recent sync activity:');
        connection.sync_schedules
          .filter(s => s.function_name === 'get_orders')
          .forEach(schedule => {
            console.log(`  - Orders: last sync ${schedule.latest_sync}`);
          });
      }
      
      // Only test connections that seem active (used recently)
      const lastUsed = new Date(connection.last_used);
      const now = new Date();
      const hoursAgo = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60);
      
      if (hoursAgo < 24) { // Only test connections used in last 24 hours
        console.log(`🔍 Testing connection (last used ${hoursAgo.toFixed(1)} hours ago)...`);
        
        try {
          // We can't easily test without an access token, but let's see what endpoints are available
          console.log(`Available endpoints: ${connection.available_endpoints?.slice(0, 5).join(', ')}...`);
          
          // Check if this is the same connection we're already using
          const mabeBrand = await (await import('./server/storage.ts')).storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
          
          if (connection.connection_id === mabeBrand.trackstarConnectionId) {
            console.log('✅ This is the connection we are currently using for Mabē');
          } else {
            console.log('❓ This is a DIFFERENT connection - not the one we use for Mabē');
            console.log(`   Our Mabē connection: ${mabeBrand.trackstarConnectionId}`);
            console.log(`   This connection: ${connection.connection_id}`);
          }
          
        } catch (error) {
          console.log(`❌ Failed to test connection: ${error.message}`);
        }
      } else {
        console.log(`⏭️ Skipping old connection (last used ${hoursAgo.toFixed(1)} hours ago)`);
      }
    }
    
    // Summary and recommendation
    console.log(`\n📊 Connection Summary:`);
    const activeConnections = connections.filter(c => {
      const lastUsed = new Date(c.last_used);
      const now = new Date();
      const hoursAgo = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60);
      return hoursAgo < 24;
    });
    
    console.log(`Active connections (last 24h): ${activeConnections.length}`);
    console.log(`Total connections: ${connections.length}`);
    
    if (connections.length > 1) {
      console.log(`\n⚠️ Multiple connections found! This could explain the missing data.`);
      console.log(`   Mabē might have switched to a newer connection with more recent orders.`);
    } else if (connections.length === 1) {
      console.log(`\n✅ Only one connection found - this is the one we're using.`);
      console.log(`   The data discrepancy must be elsewhere.`);
    }
    
  } catch (error) {
    console.error('❌ Connection check failed:', error);
  }
}

// Run the check
checkAllConnections().then(() => {
  console.log('\n🎉 Connection check completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});