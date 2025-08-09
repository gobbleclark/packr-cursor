/**
 * Get the most recent data from Trackstar and compare with what we have
 * Focus on identifying exactly what data type Trackstar shows as "recent"
 */

const { TrackstarService } = await import('./server/services/trackstar.ts');
const { storage } = await import('./server/storage.ts');

async function checkRecentData() {
  console.log('🔍 Checking what "recent data" Trackstar has that we might be missing...');
  
  try {
    const trackstarService = new TrackstarService();
    const mabeBrand = await storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    
    // 1. Check orders with focus on recent updates vs creation
    console.log('\n📦 ORDERS - Analyzing by different date fields:');
    const orders = await trackstarService.getOrdersWithToken(
      mabeBrand.trackstarConnectionId,
      mabeBrand.trackstarAccessToken
    );
    
    // Group by different date criteria
    const byCreatedDate = orders
      .filter(o => o.created_date)
      .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())
      .slice(0, 5);
      
    const byUpdatedDate = orders
      .filter(o => o.updated_date)
      .sort((a, b) => new Date(b.updated_date).getTime() - new Date(a.updated_date).getTime())
      .slice(0, 5);
    
    console.log('Most recent by CREATED_DATE (new orders):');
    byCreatedDate.forEach((order, i) => {
      console.log(`  ${i+1}. ${order.order_number} - Created: ${order.created_date} - Status: ${order.status}`);
    });
    
    console.log('\nMost recent by UPDATED_DATE (order activity):');
    byUpdatedDate.forEach((order, i) => {
      console.log(`  ${i+1}. ${order.order_number} - Updated: ${order.updated_date} - Status: ${order.status}`);
    });
    
    // Count orders with recent updates vs recent creation
    const july2025OrLater = new Date('2025-07-01');
    const recentlyCreated = orders.filter(o => new Date(o.created_date) >= july2025OrLater).length;
    const recentlyUpdated = orders.filter(o => new Date(o.updated_date) >= july2025OrLater).length;
    
    console.log(`\nJuly 2025+ Summary:`);
    console.log(`  New orders created: ${recentlyCreated}`);
    console.log(`  Orders with updates: ${recentlyUpdated}`);
    
    // 2. Check shipments data
    console.log('\n📦 SHIPMENTS - Checking for recent shipping activity:');
    try {
      const shipments = await trackstarService.getShipmentsWithToken(
        mabeBrand.trackstarConnectionId,
        mabeBrand.trackstarAccessToken
      );
      
      console.log(`Total shipments: ${shipments.length}`);
      
      if (shipments.length > 0) {
        const recentShipments = shipments
          .filter(s => s.shipped_date || s.created_date)
          .sort((a, b) => {
            const aDate = new Date(s.shipped_date || s.created_date);
            const bDate = new Date(s.shipped_date || s.created_date);
            return bDate.getTime() - aDate.getTime();
          })
          .slice(0, 5);
          
        console.log('Most recent shipments:');
        recentShipments.forEach((shipment, i) => {
          const date = shipment.shipped_date || shipment.created_date;
          console.log(`  ${i+1}. Order ${shipment.order_number} - Shipped: ${date}`);
        });
        
        // Check for July+ shipments
        const recentShipmentCount = shipments.filter(s => {
          const date = new Date(s.shipped_date || s.created_date);
          return date >= july2025OrLater;
        }).length;
        
        console.log(`July 2025+ shipments: ${recentShipmentCount}`);
      }
      
    } catch (shipmentError) {
      console.log(`❌ Shipments not available: ${shipmentError.message}`);
    }
    
    // 3. Check inventory updates
    console.log('\n📦 INVENTORY - Checking for recent inventory changes:');
    try {
      const products = await trackstarService.getProductsWithToken(
        mabeBrand.trackstarConnectionId,
        mabeBrand.trackstarAccessToken
      );
      
      console.log(`Total products: ${products.length}`);
      
      // Check if products have update dates
      const productsWithUpdates = products.filter(p => p.updated_date || p.last_updated);
      if (productsWithUpdates.length > 0) {
        const recentProducts = productsWithUpdates
          .sort((a, b) => {
            const aDate = new Date(a.updated_date || a.last_updated);
            const bDate = new Date(b.updated_date || b.last_updated);
            return bDate.getTime() - aDate.getTime();
          })
          .slice(0, 5);
          
        console.log('Recently updated products:');
        recentProducts.forEach((product, i) => {
          const date = product.updated_date || product.last_updated;
          console.log(`  ${i+1}. ${product.name} (${product.sku}) - Updated: ${date}`);
        });
      }
      
    } catch (inventoryError) {
      console.log(`❌ Inventory updates not available: ${inventoryError.message}`);
    }
    
    // 4. Summary and hypothesis
    console.log('\n🎯 ANALYSIS:');
    console.log('If Trackstar dashboard shows "recent activity" that we dont have:');
    
    if (recentlyCreated === 0 && recentlyUpdated > 0) {
      console.log('✅ HYPOTHESIS CONFIRMED: No new orders since June 15');
      console.log(`   However, ${recentlyUpdated} orders have been UPDATED since July 2025`);
      console.log('   Trackstar dashboard likely shows "recent activity" not "new orders"');
      console.log('   The "data we dont have" is probably order status updates, not new orders');
    }
    
    if (recentlyCreated > 0) {
      console.log('🚨 FOUND NEW ORDERS: There ARE orders created after June 15!');
      console.log('   This would mean there is a sync issue we need to investigate');
    }
    
  } catch (error) {
    console.error('❌ Recent data check failed:', error);
  }
}

// Run the check
checkRecentData().then(() => {
  console.log('\n🎉 Recent data check completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});