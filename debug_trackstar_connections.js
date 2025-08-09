/**
 * Debug script to check what connections and data Trackstar has available
 * This will help us understand why the dashboard shows different data than the API returns
 */

const { TrackstarService } = await import('./server/services/trackstar.ts');
const { storage } = await import('./server/storage.ts');

async function debugTrackstarConnections() {
  console.log('🔍 Debugging Trackstar connections and data availability...');
  
  try {
    const trackstarService = new TrackstarService();
    
    // 1. Get all connections from our Trackstar account
    console.log('\n📋 Fetching all connections from Trackstar account...');
    const connections = await trackstarService.getConnections();
    
    console.log(`\n✅ Connections response:`, JSON.stringify(connections, null, 2));
    
    if (Array.isArray(connections)) {
      console.log(`\n📋 Found ${connections.length} total connections:`);
      connections.forEach((conn, index) => {
      console.log(`${index + 1}. Connection ID: ${conn.id || conn.connection_id}`);
      console.log(`   Integration: ${conn.integration_name || conn.integration}`);
      console.log(`   Status: ${conn.status || 'unknown'}`);
      console.log(`   Created: ${conn.created_at || 'unknown'}`);
      console.log(`   Metadata:`, JSON.stringify(conn, null, 2));
        console.log('---');
      });
    } else {
      console.log('❌ Connections response is not an array:', typeof connections);
    }
    
    // 2. Get the Mabē brand and check its specific connection
    const mabeBrand = await storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    if (mabeBrand?.trackstarConnectionId) {
      console.log(`\n🔗 Mabē's connection ID: ${mabeBrand.trackstarConnectionId}`);
      
      const mabeConnection = connections.find(c => 
        (c.id || c.connection_id) === mabeBrand.trackstarConnectionId
      );
      
      if (mabeConnection) {
        console.log('✅ Found Mabē connection in account connections');
        console.log('Connection details:', JSON.stringify(mabeConnection, null, 2));
      } else {
        console.log('❌ Mabē connection NOT found in account connections');
        console.log('This could indicate a connection ID mismatch or expired connection');
      }
      
      // 3. Try to fetch orders directly from Mabē's connection
      console.log('\n📦 Attempting to fetch orders from Mabē connection...');
      try {
        const orders = await trackstarService.getOrdersWithToken(
          mabeBrand.trackstarConnectionId,
          mabeBrand.trackstarAccessToken
        );
        
        console.log(`✅ Successfully retrieved ${orders.length} orders`);
        
        if (orders.length > 0) {
          // Show latest orders
          const sortedOrders = orders
            .filter(o => o.created_at || o.order_date || o.date)
            .sort((a, b) => {
              const dateA = new Date(a.created_at || a.order_date || a.date);
              const dateB = new Date(b.created_at || b.order_date || b.date);
              return dateB.getTime() - dateA.getTime();
            });
            
          console.log('\n📊 Latest 5 orders from Trackstar:');
          sortedOrders.slice(0, 5).forEach((order, index) => {
            const date = order.created_at || order.order_date || order.date || 'unknown';
            const status = order.status || order.fulfillment_status || 'unknown';
            const id = order.id || order.order_id || order.order_number || 'unknown';
            console.log(`${index + 1}. Order ${id} - ${date} - ${status}`);
          });
          
          console.log('\n📊 Order date range analysis:');
          const dates = sortedOrders.map(o => new Date(o.created_at || o.order_date || o.date));
          const earliest = new Date(Math.min(...dates));
          const latest = new Date(Math.max(...dates));
          console.log(`   Earliest: ${earliest.toISOString()}`);
          console.log(`   Latest: ${latest.toISOString()}`);
        }
        
      } catch (orderError) {
        console.error('❌ Failed to fetch orders:', orderError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    console.error(error.stack);
  }
}

// Run the debug
debugTrackstarConnections().then(() => {
  console.log('\n🎉 Trackstar connection debug completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});