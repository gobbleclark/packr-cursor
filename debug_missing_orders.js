/**
 * Debug script to find what orders Trackstar has that we don't have in our database
 * This will help identify if there are new orders we're not syncing
 */

const { TrackstarService } = await import('./server/services/trackstar.ts');
const { storage } = await import('./server/storage.ts');

async function debugMissingOrders() {
  console.log('🔍 Checking for orders in Trackstar that we might be missing...');
  
  try {
    const trackstarService = new TrackstarService();
    const mabeBrand = await storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    
    // Get all orders from Trackstar
    console.log('📦 Fetching all orders from Trackstar...');
    const trackstarOrders = await trackstarService.getOrdersWithToken(
      mabeBrand.trackstarConnectionId,
      mabeBrand.trackstarAccessToken
    );
    
    // Get all orders from our database for this brand
    console.log('💾 Fetching all orders from our database...');
    const dbOrders = await storage.getOrdersByBrand(mabeBrand.id);
    
    console.log(`\n📊 Data comparison:`);
    console.log(`   Trackstar orders: ${trackstarOrders.length}`);
    console.log(`   Database orders: ${dbOrders.length}`);
    
    // Create sets of order identifiers from our database
    const dbOrderNumbers = new Set(dbOrders.map(o => o.orderNumber));
    const dbTrackstarIds = new Set(dbOrders.map(o => o.trackstarOrderId).filter(id => id));
    
    console.log(`\n🔍 Checking for orders in Trackstar that aren't in our database...`);
    
    const missingOrders = [];
    
    for (const trackstarOrder of trackstarOrders) {
      const orderNumber = trackstarOrder.order_number || trackstarOrder.reference_id;
      const trackstarId = trackstarOrder.id;
      
      // Check if this order is missing from our database
      const missingByNumber = !dbOrderNumbers.has(orderNumber);
      const missingById = !dbTrackstarIds.has(trackstarId);
      
      if (missingByNumber && missingById) {
        missingOrders.push({
          trackstarId,
          orderNumber,
          created_date: trackstarOrder.created_date,
          updated_date: trackstarOrder.updated_date,
          status: trackstarOrder.status,
          total: trackstarOrder.total_price
        });
      }
    }
    
    console.log(`\n📋 Found ${missingOrders.length} orders in Trackstar not in our database:`);
    
    if (missingOrders.length > 0) {
      // Sort by creation date to see the newest ones first
      missingOrders
        .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())
        .slice(0, 10)
        .forEach((order, index) => {
          console.log(`${index + 1}. Order ${order.orderNumber}`);
          console.log(`   Created: ${order.created_date}`);
          console.log(`   Updated: ${order.updated_date}`);
          console.log(`   Status: ${order.status}`);
          console.log(`   Total: $${order.total}`);
          console.log(`   Trackstar ID: ${order.trackstarId}`);
          console.log('---');
        });
      
      // Check date ranges of missing orders
      const missingDates = missingOrders
        .map(o => new Date(o.created_date))
        .filter(d => !isNaN(d.getTime()));
      
      if (missingDates.length > 0) {
        const earliest = new Date(Math.min(...missingDates));
        const latest = new Date(Math.max(...missingDates));
        
        console.log(`\n📅 Missing orders date range:`);
        console.log(`   Earliest: ${earliest.toISOString()}`);
        console.log(`   Latest: ${latest.toISOString()}`);
        
        // Check if any are from July/August 2025
        const recentMissing = missingOrders.filter(o => {
          const date = new Date(o.created_date);
          return date.getFullYear() === 2025 && (date.getMonth() >= 6); // July = 6, Aug = 7
        });
        
        console.log(`   Orders from July 2025 onwards: ${recentMissing.length}`);
      }
      
    } else {
      console.log('✅ All Trackstar orders are already in our database');
    }
    
    // Also check the reverse - orders in our DB not in Trackstar
    console.log(`\n🔍 Checking for orders in our database not in Trackstar...`);
    
    const trackstarOrderNumbers = new Set(trackstarOrders.map(o => o.order_number || o.reference_id));
    const trackstarIds = new Set(trackstarOrders.map(o => o.id));
    
    const orphanOrders = dbOrders.filter(dbOrder => {
      const notInTrackstarByNumber = !trackstarOrderNumbers.has(dbOrder.orderNumber);
      const notInTrackstarById = !trackstarIds.has(dbOrder.trackstarOrderId);
      return notInTrackstarByNumber && notInTrackstarById;
    });
    
    console.log(`📋 Found ${orphanOrders.length} orders in database not in Trackstar`);
    
    if (orphanOrders.length > 0) {
      orphanOrders.slice(0, 5).forEach(order => {
        console.log(`   - ${order.orderNumber} (${order.orderDate})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    console.error(error.stack);
  }
}

// Run the debug
debugMissingOrders().then(() => {
  console.log('\n🎉 Missing orders debug completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});