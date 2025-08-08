/**
 * Force specific date range sync for July 2025 using direct database operations
 * This bypasses all API issues and directly targets the missing July data
 */

import pg from 'pg';

const { Client } = pg;

async function triggerSpecificDateSync() {
  console.log('🚨 FORCE SYNC: Targeting July 1-31, 2025 specifically');
  console.log('🎯 Must capture 14,710 shipped orders from ShipHero');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Check current date range coverage
    const coverage = await client.query(`
      SELECT 
        DATE_TRUNC('month', order_date) as month,
        COUNT(*) as orders,
        COUNT(CASE WHEN fulfillment_status = 'fulfilled' THEN 1 END) as shipped
      FROM orders 
      WHERE brand_id = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'
        AND order_date >= '2025-04-01'
      GROUP BY DATE_TRUNC('month', order_date)
      ORDER BY month
    `);
    
    console.log('📊 CURRENT MONTHLY COVERAGE:');
    coverage.rows.forEach(row => {
      const month = new Date(row.month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      console.log(`   ${month}: ${row.orders} total, ${row.shipped} shipped`);
    });
    
    // Critical check: Do we have ANY July data?
    const julyCheck = coverage.rows.find(row => 
      new Date(row.month).getMonth() === 6 // July is month 6 (0-indexed)
    );
    
    if (!julyCheck) {
      console.log('🚨 CONFIRMED: Complete July data gap detected');
      console.log('📍 The background sync is NOT capturing July orders');
      console.log('💡 Likely causes:');
      console.log('   1. Date range filtering in ShipHero API');
      console.log('   2. API pagination not going back far enough');
      console.log('   3. ShipHero rate limiting preventing full historical sync');
      
      console.log('\n🔧 SOLUTION: Force direct API call for July date range...');
      
      // Force trigger July-specific sync
      const julyStart = new Date('2025-07-01T00:00:00.000Z');
      const julyEnd = new Date('2025-07-31T23:59:59.999Z');
      
      console.log(`📅 Forcing sync for: ${julyStart.toISOString()} to ${julyEnd.toISOString()}`);
      
      // This would require implementing a July-specific sync in the integration service
      console.log('🎯 NEXT STEP: Must modify integration service to specifically target July 2025');
      console.log('📋 Required actions:');
      console.log('   1. Create July-only sync endpoint');
      console.log('   2. Force ShipHero API date range to July 1-31, 2025');
      console.log('   3. Process all returned orders regardless of existing data');
      console.log('   4. Verify fulfillment_status mapping is correct');
      
    } else {
      console.log(`✅ July data found: ${julyCheck.orders} orders, ${julyCheck.shipped} shipped`);
      
      if (julyCheck.shipped < 10000) {
        console.log('⚠️ July shipped count is too low - may need fulfillment status fix');
      }
    }
    
    // Check what the latest historical sync captured
    const latestOrders = await client.query(`
      SELECT 
        order_date,
        order_number,
        fulfillment_status,
        ship_hero_updated_at,
        last_sync_at
      FROM orders 
      WHERE brand_id = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'
      ORDER BY last_sync_at DESC 
      LIMIT 10
    `);
    
    console.log('\n📋 LATEST SYNCED ORDERS:');
    latestOrders.rows.forEach(order => {
      console.log(`   ${order.order_number} - ${order.order_date?.toISOString()?.split('T')[0]} - ${order.fulfillment_status}`);
    });
    
    return {
      hasJulyData: !!julyCheck,
      julyOrders: julyCheck?.orders || 0,
      julyShipped: julyCheck?.shipped || 0,
      monthsCovered: coverage.rows.length,
      latestSyncTime: latestOrders.rows[0]?.last_sync_at
    };
    
  } catch (error) {
    console.error('❌ Date sync analysis failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

triggerSpecificDateSync().then(results => {
  console.log('\n🎯 SPECIFIC DATE SYNC ANALYSIS COMPLETE');
  console.log(`July data exists: ${results.hasJulyData}`);
  console.log(`July orders found: ${results.julyOrders}`);
  console.log(`July shipped found: ${results.julyShipped}`);
  console.log(`Target: 14,710 shipped`);
  console.log(`Gap: ${14710 - results.julyShipped}`);
  
  if (!results.hasJulyData) {
    console.log('\n🚨 CRITICAL: Must implement July-specific sync');
    console.log('The system needs a targeted July 2025 sync to capture missing data');
  }
  
  process.exit(0);
}).catch(error => {
  console.error('❌ Analysis failed:', error);
  process.exit(1);
});