/**
 * Direct shipment sync for Mabē to get accurate shipped order count
 * Uses the new getShipments API method we just added
 */

const { shipHeroApiFixed } = require('./server/services/shipHeroApiFixed');

async function getMabeShipments() {
  console.log('🚢 Fetching Mabē shipments for last 30 days...');
  
  try {
    const credentials = {
      username: 'gavin+mabe@boxioship.com',
      password: process.env.MABE_SHIPHERO_PASSWORD || 'packr2024!'
    };
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    
    console.log(`📅 Date range: ${thirtyDaysAgo.toISOString()} to ${now.toISOString()}`);
    
    const shipments = await shipHeroApiFixed.getShipments(credentials, thirtyDaysAgo, now);
    
    console.log('\n📊 SHIPMENT RESULTS:');
    console.log(`Total shipments found: ${shipments.length}`);
    
    // Group by date for analysis
    const shipmentsByDate = {};
    
    shipments.forEach(shipment => {
      const shippedDate = new Date(shipment.shipped_date || shipment.created_at);
      const dateKey = shippedDate.toISOString().split('T')[0];
      
      if (!shipmentsByDate[dateKey]) {
        shipmentsByDate[dateKey] = 0;
      }
      shipmentsByDate[dateKey]++;
    });
    
    console.log('\n📦 Daily shipment breakdown:');
    Object.keys(shipmentsByDate)
      .sort()
      .reverse()
      .slice(0, 10)
      .forEach(date => {
        console.log(`${date}: ${shipmentsByDate[date]} shipments`);
      });
    
    // Get unique orders
    const uniqueOrders = new Set(shipments.map(s => s.order_number).filter(Boolean));
    console.log(`\n🎯 ANSWER: ${uniqueOrders.size} unique orders shipped in last 30 days`);
    console.log(`📦 Total shipment records: ${shipments.length}`);
    
    return {
      totalShipments: shipments.length,
      uniqueOrdersShipped: uniqueOrders.size,
      dailyBreakdown: shipmentsByDate
    };
    
  } catch (error) {
    console.error('❌ Failed to fetch shipments:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  getMabeShipments()
    .then(results => {
      console.log('\n✅ Shipment sync completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Sync failed:', error);
      process.exit(1);
    });
}

module.exports = { getMabeShipments };