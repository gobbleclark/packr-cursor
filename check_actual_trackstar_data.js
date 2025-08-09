/**
 * Check what fields we actually receive from Trackstar orders
 */

const { TrackstarService } = await import('./server/services/trackstar.ts');
const { storage } = await import('./server/storage.ts');

async function checkActualTrackstarData() {
  console.log('🔍 Checking actual Trackstar order data structure...');
  
  try {
    const trackstarService = new TrackstarService();
    const mabeBrand = await storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    
    // Get a few sample orders to see actual structure
    const orders = await trackstarService.getAllOrdersWithTokenFixed(
      mabeBrand.trackstarConnectionId,
      mabeBrand.trackstarAccessToken
    );
    
    if (orders.length > 0) {
      console.log('\n📦 SAMPLE TRACKSTAR ORDER STRUCTURE:');
      console.log('='.repeat(60));
      
      const sampleOrder = orders[0];
      console.log(JSON.stringify(sampleOrder, null, 2));
      
      console.log('\n🔍 AVAILABLE FIELDS IN ACTUAL DATA:');
      console.log('='.repeat(50));
      
      const allFields = new Set();
      
      // Check first 10 orders to get comprehensive field list
      orders.slice(0, 10).forEach(order => {
        Object.keys(order).forEach(key => allFields.add(key));
      });
      
      const sortedFields = Array.from(allFields).sort();
      sortedFields.forEach(field => {
        const sampleValue = sampleOrder[field];
        const type = typeof sampleValue;
        const preview = type === 'object' && sampleValue !== null 
          ? JSON.stringify(sampleValue).substring(0, 100) + '...'
          : String(sampleValue).substring(0, 50);
        console.log(`  📋 ${field} (${type}): ${preview}`);
      });
      
      console.log(`\n📊 Total unique fields found: ${sortedFields.length}`);
      
    } else {
      console.log('❌ No orders retrieved from Trackstar');
    }
    
  } catch (error) {
    console.error('❌ Failed to check Trackstar data:', error.message);
  }
}

// Run the check
checkActualTrackstarData().then(() => {
  console.log('\n✅ Trackstar data analysis completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});