/**
 * Real-time monitoring of comprehensive July-August sync progress
 */

import pg from 'pg';
const { Client } = pg;

async function monitorSyncProgress() {
  console.log('📊 MONITORING COMPREHENSIVE JULY-AUGUST SYNC');
  console.log('⏳ Watching for July breakthrough...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    let iteration = 0;
    const maxIterations = 120; // 20 minutes of monitoring
    let lastTotal = 0;
    let julyFound = false;
    
    while (iteration < maxIterations) {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' THEN 1 END) as july_total,
          COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' AND fulfillment_status = 'fulfilled' THEN 1 END) as july_shipped,
          COUNT(CASE WHEN order_date >= '2025-08-01' THEN 1 END) as august_total,
          COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-07-09' THEN 1 END) as july_1_to_8,
          MAX(last_sync_at) as latest_sync
        FROM orders 
        WHERE brand_id = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'
      `);
      
      const current = result.rows[0];
      const totalOrders = parseInt(current.total);
      const julyTotal = parseInt(current.july_total);
      const julyShipped = parseInt(current.july_shipped);
      const augustTotal = parseInt(current.august_total);
      const july1to8 = parseInt(current.july_1_to_8);
      
      iteration++;
      const increase = totalOrders - lastTotal;
      
      if (increase > 0) {
        console.log(`📈 ${iteration}: +${increase} orders (Total: ${totalOrders})`);
        console.log(`   July: ${julyTotal} total, ${julyShipped} shipped, ${july1to8} in July 1-8`);
        console.log(`   August: ${augustTotal}`);
        lastTotal = totalOrders;
        
        // Check for July breakthrough
        if (julyTotal > 0 && !julyFound) {
          console.log('🎉 JULY BREAKTHROUGH! July data appearing in database!');
          julyFound = true;
        }
        
        // Check for major progress
        if (julyShipped > 10000) {
          console.log('✅ MAJOR SUCCESS: Substantial July shipments captured!');
        } else if (julyShipped > 5000) {
          console.log('✅ GOOD PROGRESS: Significant July shipments');  
        }
        
        // Check if target achieved
        if (julyShipped >= 14000) {
          console.log('🎯 TARGET ACHIEVED: July shipment goal reached!');
          break;
        }
      } else {
        console.log(`⏳ ${iteration}: No database changes (API fetch ongoing...)`);
      }
      
      // Summary every 2 minutes
      if (iteration % 12 === 0) {
        console.log(`\n📊 ${iteration * 10}s Summary:`);
        console.log(`   Total orders: ${totalOrders}`);
        console.log(`   July orders: ${julyTotal} (${julyShipped} shipped)`);
        console.log(`   August orders: ${augustTotal}`);
        console.log(`   July 1-8 target: ${july1to8}`);
        console.log(`   Gap remaining: ${14710 - julyShipped}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    }
    
    // Final status
    const finalResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' THEN 1 END) as july_total,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' AND fulfillment_status = 'fulfilled' THEN 1 END) as july_shipped,
        COUNT(CASE WHEN order_date >= '2025-08-01' THEN 1 END) as august_total
      FROM orders 
      WHERE brand_id = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'
    `);
    
    const final = finalResult.rows[0];
    
    console.log('\n🎯 MONITORING SUMMARY:');
    console.log(`Total orders: ${final.total}`);
    console.log(`July orders: ${final.july_total} (${final.july_shipped} shipped)`);
    console.log(`August orders: ${final.august_total}`);
    console.log(`Target gap: ${14710 - final.july_shipped}`);
    
    if (parseInt(final.july_shipped) >= 14000) {
      console.log('🎉 SUCCESS: July shipment target achieved!');
    } else if (parseInt(final.july_total) > 0) {
      console.log('⚠️ PARTIAL: July data found, sync continuing...');
    } else {
      console.log('📊 ONGOING: API fetch phase continuing, July data pending...');
    }
    
  } catch (error) {
    console.error('❌ Monitoring failed:', error);
  } finally {
    await client.end();
  }
}

monitorSyncProgress().catch(console.error);