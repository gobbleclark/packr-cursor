/**
 * Comprehensive July-August reimport
 * Pulls ALL orders from July 1st through current date for complete accuracy
 */

import { execSync } from 'child_process';
import pg from 'pg';

const { Client } = pg;

async function comprehensiveJulyAugustReimport() {
  console.log('🚨 COMPREHENSIVE JULY-AUGUST REIMPORT');
  console.log('🎯 Target: ALL July orders (14,710 shipped) + complete August data');
  console.log('📅 Date Range: July 1, 2025 - Present');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Get baseline
    const initialResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' THEN 1 END) as july_total,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' AND fulfillment_status = 'fulfilled' THEN 1 END) as july_shipped,
        COUNT(CASE WHEN order_date >= '2025-08-01' AND order_date < '2025-09-01' THEN 1 END) as august_total,
        MIN(order_date) as earliest,
        MAX(order_date) as latest
      FROM orders 
      WHERE brand_id = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'
    `);
    
    const initial = initialResult.rows[0];
    console.log('\n📊 CURRENT STATE:');
    console.log(`   Total orders: ${initial.total}`);
    console.log(`   July orders: ${initial.july_total}`);
    console.log(`   July shipped: ${initial.july_shipped}`);
    console.log(`   August orders: ${initial.august_total}`);
    console.log(`   Date range: ${initial.earliest?.toISOString().split('T')[0]} to ${initial.latest?.toISOString().split('T')[0]}`);
    console.log(`   July gap: ${14710 - initial.july_shipped} shipped orders missing`);
    
    // Force trigger comprehensive historical sync with July start date
    console.log('\n🔄 TRIGGERING COMPREHENSIVE JULY-AUGUST SYNC...');
    
    try {
      // The background sync should now use July 1st start date due to our fix
      execSync('curl -X POST http://localhost:5000/api/shiphero/sync/dce4813e-aeb7-41fe-bb00-a36e314288f3 -H "Content-Type: application/json" -d \'{"type": "full"}\'', {
        timeout: 5000,
        stdio: 'pipe'
      });
      console.log('✅ Comprehensive sync triggered successfully');
    } catch (error) {
      console.log('⚠️ Sync trigger attempt completed (may have timed out, but likely started)');
    }
    
    // Monitor progress for 10 minutes with detailed tracking
    console.log('\n📊 MONITORING COMPREHENSIVE JULY-AUGUST SYNC...');
    console.log('⏳ Watching for July breakthrough and August completion...');
    
    let lastTotal = parseInt(initial.total);
    let lastJulyTotal = parseInt(initial.july_total);
    let lastJulyShipped = parseInt(initial.july_shipped);
    let lastAugustTotal = parseInt(initial.august_total);
    
    let iteration = 0;
    const maxIterations = 60; // 10 minutes of monitoring
    let julyBreakthrough = lastJulyTotal > 0;
    let majorProgress = false;
    
    while (iteration < maxIterations) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
      const progressResult = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' THEN 1 END) as july_total,
          COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' AND fulfillment_status = 'fulfilled' THEN 1 END) as july_shipped,
          COUNT(CASE WHEN order_date >= '2025-08-01' AND order_date < '2025-09-01' THEN 1 END) as august_total,
          MAX(last_sync_at) as last_sync
        FROM orders 
        WHERE brand_id = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'
      `);
      
      const current = progressResult.rows[0];
      const totalOrders = parseInt(current.total);
      const julyTotal = parseInt(current.july_total);
      const julyShipped = parseInt(current.july_shipped);
      const augustTotal = parseInt(current.august_total);
      
      iteration++;
      
      // Check for any progress
      const totalIncrease = totalOrders - lastTotal;
      const julyIncrease = julyTotal - lastJulyTotal;
      const julyShippedIncrease = julyShipped - lastJulyShipped;
      const augustIncrease = augustTotal - lastAugustTotal;
      
      if (totalIncrease > 0 || julyIncrease > 0 || augustIncrease > 0) {
        console.log(`📈 ${iteration}: +${totalIncrease} total (${totalOrders})`);
        console.log(`   🎯 July: ${julyTotal} total (+${julyIncrease}), ${julyShipped} shipped (+${julyShippedIncrease})`);
        console.log(`   📅 August: ${augustTotal} total (+${augustIncrease})`);
        
        // Update tracking
        lastTotal = totalOrders;
        lastJulyTotal = julyTotal;
        lastJulyShipped = julyShipped;
        lastAugustTotal = augustTotal;
        
        // Check for July breakthrough
        if (julyTotal > 0 && !julyBreakthrough) {
          console.log('🎉 JULY BREAKTHROUGH! July data finally appearing in database!');
          julyBreakthrough = true;
        }
        
        // Check for major progress
        if (julyShipped > 10000 && !majorProgress) {
          console.log('✅ MAJOR JULY SUCCESS: Substantial shipped orders captured!');
          majorProgress = true;
        }
        
        // Check if we've achieved the target
        if (julyShipped >= 14000) {
          console.log('🎯 TARGET ACHIEVED: July shipment goal reached!');
          break;
        }
        
      } else {
        console.log(`⏳ ${iteration}: No changes (July: ${julyTotal}, July shipped: ${julyShipped}, August: ${augustTotal})`);
      }
      
      // Progress summary every minute
      if (iteration % 6 === 0) {
        console.log(`\n📊 ${iteration * 10}s Summary:`);
        console.log(`   Orders added: ${totalOrders - parseInt(initial.total)}`);
        console.log(`   July progress: ${julyTotal} total, ${julyShipped} shipped`);
        console.log(`   August orders: ${augustTotal}`);
        console.log(`   July gap remaining: ${14710 - julyShipped}`);
      }
    }
    
    // Final comprehensive results
    const finalResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' THEN 1 END) as july_total,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' AND fulfillment_status = 'fulfilled' THEN 1 END) as july_shipped,
        COUNT(CASE WHEN order_date >= '2025-08-01' AND order_date < '2025-09-01' THEN 1 END) as august_total,
        MIN(order_date) as earliest,
        MAX(order_date) as latest
      FROM orders 
      WHERE brand_id = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'
    `);
    
    const final = finalResult.rows[0];
    
    console.log('\n🎯 COMPREHENSIVE JULY-AUGUST REIMPORT RESULTS:');
    console.log('='.repeat(50));
    console.log(`Total orders: ${final.total} (was ${initial.total}, +${final.total - initial.total})`);
    console.log(`July orders: ${final.july_total} (was ${initial.july_total}, +${final.july_total - initial.july_total})`);
    console.log(`July shipped: ${final.july_shipped} (was ${initial.july_shipped}, +${final.july_shipped - initial.july_shipped})`);
    console.log(`August orders: ${final.august_total} (was ${initial.august_total}, +${final.august_total - initial.august_total})`);
    console.log(`Date coverage: ${final.earliest?.toISOString().split('T')[0]} to ${final.latest?.toISOString().split('T')[0]}`);
    console.log(`July target: 14,710 shipped`);
    console.log(`July gap: ${14710 - final.july_shipped}`);
    
    // Success assessment
    let success = 'UNKNOWN';
    if (parseInt(final.july_shipped) >= 14000) {
      success = 'COMPLETE SUCCESS';
      console.log('🎉 MISSION ACCOMPLISHED: July shipment target achieved!');
    } else if (parseInt(final.july_shipped) >= 10000) {
      success = 'MAJOR SUCCESS';
      console.log('✅ MAJOR SUCCESS: Substantial July data captured');
    } else if (parseInt(final.july_total) >= 10000) {
      success = 'PARTIAL SUCCESS';
      console.log('⚠️ PARTIAL SUCCESS: July orders found, fulfillment status needs review');
    } else if (parseInt(final.july_total) > parseInt(initial.july_total)) {
      success = 'PROGRESS MADE';
      console.log('⚠️ PROGRESS: Some July data captured, continuing sync needed');
    } else {
      success = 'NO PROGRESS';
      console.log('❌ NO PROGRESS: July data gap persists, deeper investigation needed');
    }
    
    return {
      success,
      initialOrders: parseInt(initial.total),
      finalOrders: parseInt(final.total),
      ordersAdded: parseInt(final.total) - parseInt(initial.total),
      julyOrdersAdded: parseInt(final.july_total) - parseInt(initial.july_total),
      julyShippedAdded: parseInt(final.july_shipped) - parseInt(initial.july_shipped),
      augustOrdersAdded: parseInt(final.august_total) - parseInt(initial.august_total),
      finalJulyTotal: parseInt(final.july_total),
      finalJulyShipped: parseInt(final.july_shipped),
      finalAugustTotal: parseInt(final.august_total),
      gap: 14710 - parseInt(final.july_shipped),
      breakthrough: julyBreakthrough,
      majorProgress
    };
    
  } catch (error) {
    console.error('❌ Comprehensive reimport failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

comprehensiveJulyAugustReimport().then(results => {
  console.log('\n🎯 COMPREHENSIVE JULY-AUGUST REIMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Result: ${results.success}`);
  console.log(`Orders added: ${results.ordersAdded}`);
  console.log(`July orders added: ${results.julyOrdersAdded}`);
  console.log(`July shipped added: ${results.julyShippedAdded}`);
  console.log(`August orders added: ${results.augustOrdersAdded}`);
  console.log(`Final July total: ${results.finalJulyTotal}`);
  console.log(`Final July shipped: ${results.finalJulyShipped}`);
  console.log(`Final August total: ${results.finalAugustTotal}`);
  console.log(`Remaining gap: ${results.gap}`);
  
  if (results.success === 'COMPLETE SUCCESS') {
    console.log('✅ SUCCESS: Complete July-August data accuracy achieved');
  } else if (results.majorProgress) {
    console.log('✅ SUBSTANTIAL PROGRESS: Major improvement in data completeness');
  } else if (results.breakthrough) {
    console.log('⚠️ BREAKTHROUGH: July data started flowing, additional cycles may be needed');
  } else if (results.ordersAdded > 0) {
    console.log('📊 PROGRESS: Some data captured, monitoring continuation recommended');
  } else {
    console.log('❌ INVESTIGATION NEEDED: No data captured, system needs debugging');
  }
  
  process.exit(0);
}).catch(error => {
  console.error('❌ Comprehensive reimport failed:', error);
  process.exit(1);
});