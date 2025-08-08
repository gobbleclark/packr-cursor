/**
 * Monitor sync progress for July data capture
 */

import pg from 'pg';

const { Client } = pg;

async function monitorJulyProgress() {
  console.log('📊 MONITORING JULY SYNC PROGRESS');
  console.log('🎯 Target: 14,710 shipped July orders');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    let iteration = 0;
    const maxIterations = 30; // Monitor for 30 iterations (5 minutes)
    let lastTotalCount = 0;
    let foundJulyData = false;
    
    while (iteration < maxIterations) {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' THEN 1 END) as july_orders,
          COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' AND fulfillment_status = 'fulfilled' THEN 1 END) as july_shipped,
          MAX(last_sync_at) as last_sync,
          MIN(order_date) as earliest_order,
          MAX(order_date) as latest_order
        FROM orders 
        WHERE brand_id = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'
      `);
      
      const stats = result.rows[0];
      const currentTotal = parseInt(stats.total_orders);
      const julyOrders = parseInt(stats.july_orders);
      const julyShipped = parseInt(stats.july_shipped);
      
      iteration++;
      
      if (currentTotal > lastTotalCount) {
        const newOrders = currentTotal - lastTotalCount;
        console.log(`📈 Iteration ${iteration}: +${newOrders} orders (Total: ${currentTotal})`);
        console.log(`   🗓️  Date range: ${stats.earliest_order?.toISOString().split('T')[0]} to ${stats.latest_order?.toISOString().split('T')[0]}`);
        console.log(`   🎯  July: ${julyOrders} total, ${julyShipped} shipped`);
        
        lastTotalCount = currentTotal;
        
        if (julyOrders > 0 && !foundJulyData) {
          console.log('🎉 BREAKTHROUGH: July data found!');
          foundJulyData = true;
          
          if (julyShipped > 10000) {
            console.log('✅ SUCCESS: Substantial July shipments captured!');
            break;
          } else if (julyShipped > 5000) {
            console.log('✅ GOOD PROGRESS: Significant July shipments');
          } else if (julyShipped > 1000) {
            console.log('⚠️ PARTIAL: Some July shipments found');
          }
        }
        
      } else {
        console.log(`⏳ Iteration ${iteration}: No change (${currentTotal} total, ${julyOrders} July, ${julyShipped} shipped)`);
      }
      
      // Check if we've hit our target
      if (julyShipped >= 14700) {
        console.log('🎯 TARGET ACHIEVED: July shipments match ShipHero report!');
        break;
      }
      
      // Wait 10 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    // Final summary
    const finalResult = await client.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' THEN 1 END) as july_orders,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' AND fulfillment_status = 'fulfilled' THEN 1 END) as july_shipped
      FROM orders 
      WHERE brand_id = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'
    `);
    
    const final = finalResult.rows[0];
    
    console.log('\n🎯 MONITORING COMPLETE');
    console.log(`Total orders: ${final.total_orders}`);
    console.log(`July orders: ${final.july_orders}`);
    console.log(`July shipped: ${final.july_shipped}`);
    console.log(`Target: 14,710`);
    console.log(`Gap: ${14710 - parseInt(final.july_shipped)}`);
    
    if (parseInt(final.july_shipped) > 14000) {
      console.log('✅ MAJOR SUCCESS: Very close to target!');
    } else if (parseInt(final.july_shipped) > 10000) {
      console.log('✅ GOOD SUCCESS: Substantial July data captured');
    } else if (parseInt(final.july_orders) > 5000) {
      console.log('⚠️ PARTIAL SUCCESS: July data found but fulfillment needs review');
    } else if (parseInt(final.july_orders) > 0) {
      console.log('⚠️ MINIMAL SUCCESS: Some July data found');
    } else {
      console.log('❌ NO SUCCESS: July data gap still exists');
    }
    
    return {
      totalOrders: parseInt(final.total_orders),
      julyOrders: parseInt(final.july_orders),
      julyShipped: parseInt(final.july_shipped),
      foundData: foundJulyData
    };
    
  } catch (error) {
    console.error('❌ Monitoring failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

monitorJulyProgress().then(results => {
  console.log('\n📊 MONITORING SESSION COMPLETE');
  
  if (results.foundData) {
    console.log('✅ July data successfully captured during this session');
  } else {
    console.log('❌ No July data captured - system needs additional work');
  }
  
  process.exit(0);
}).catch(error => {
  console.error('❌ Monitor failed:', error);
  process.exit(1);
});