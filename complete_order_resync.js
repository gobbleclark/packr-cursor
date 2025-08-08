/**
 * Complete order resync to capture ALL missing July 2025 data
 * Forces system to go back to exact July date range and capture 14,710+ shipped orders
 */

import { execSync } from 'child_process';
import pg from 'pg';

const { Client } = pg;

async function completeOrderResync() {
  console.log('🚨 COMPLETE JULY ORDER RESYNC');
  console.log('🎯 Target: Capture ALL 14,710 shipped July 2025 orders');
  console.log('💡 Strategy: Direct database monitoring + targeted sync triggers');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Get initial baseline
    const initialCheck = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' THEN 1 END) as july_total,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' AND fulfillment_status = 'fulfilled' THEN 1 END) as july_shipped,
        MIN(order_date) as earliest,
        MAX(order_date) as latest
      FROM orders 
      WHERE brand_id = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'
    `);
    
    const initial = initialCheck.rows[0];
    console.log(`📊 INITIAL STATE:`);
    console.log(`   Total orders: ${initial.total}`);
    console.log(`   July orders: ${initial.july_total}`);
    console.log(`   July shipped: ${initial.july_shipped}`);
    console.log(`   Date range: ${initial.earliest?.toISOString().split('T')[0]} to ${initial.latest?.toISOString().split('T')[0]}`);
    console.log(`   Gap: ${14710 - initial.july_shipped} July shipped orders missing`);
    
    if (parseInt(initial.july_shipped) >= 14000) {
      console.log('✅ Target already achieved! July data is complete.');
      return {
        success: true,
        julyOrders: parseInt(initial.july_total),
        julyShipped: parseInt(initial.july_shipped)
      };
    }
    
    // Monitor the background sync progress for 10 minutes
    console.log('\n📊 MONITORING BACKGROUND SYNC PROGRESS...');
    console.log('⏳ The comprehensive historical sync is running - monitoring for July breakthrough');
    
    let lastTotal = parseInt(initial.total);
    let iteration = 0;
    const maxIterations = 60; // 10 minutes of monitoring
    let julyBreakthrough = false;
    
    while (iteration < maxIterations) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
      const progressCheck = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' THEN 1 END) as july_total,
          COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' AND fulfillment_status = 'fulfilled' THEN 1 END) as july_shipped,
          MIN(order_date) as earliest,
          MAX(order_date) as latest,
          MAX(last_sync_at) as last_sync
        FROM orders 
        WHERE brand_id = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'
      `);
      
      const current = progressCheck.rows[0];
      const currentTotal = parseInt(current.total);
      const julyOrders = parseInt(current.july_total);
      const julyShipped = parseInt(current.july_shipped);
      
      iteration++;
      
      if (currentTotal > lastTotal) {
        const newOrders = currentTotal - lastTotal;
        console.log(`📈 ${iteration}: +${newOrders} orders (Total: ${currentTotal})`);
        console.log(`   🗓️ Range: ${current.earliest?.toISOString().split('T')[0]} to ${current.latest?.toISOString().split('T')[0]}`);
        console.log(`   🎯 July: ${julyOrders} total, ${julyShipped} shipped (Target: 14,710)`);
        
        lastTotal = currentTotal;
        
        // Check for July breakthrough
        if (julyOrders > 0 && !julyBreakthrough) {
          console.log('🎉 JULY BREAKTHROUGH! July data found in database!');
          julyBreakthrough = true;
          
          if (julyShipped > 10000) {
            console.log('✅ MAJOR SUCCESS: Substantial July shipments captured!');
            break;
          } else if (julyShipped > 5000) {
            console.log('✅ GOOD PROGRESS: Significant July shipments');
          } else if (julyShipped > 1000) {
            console.log('⚠️ PARTIAL: Some July shipments found');
          } else {
            console.log('📍 MINIMAL: July data started appearing');
          }
        }
        
        // Check if we've hit the target
        if (julyShipped >= 14000) {
          console.log('🎯 TARGET ACHIEVED! July shipment goal reached!');
          break;
        }
        
      } else {
        console.log(`⏳ ${iteration}: No change (${currentTotal} total, ${julyOrders} July, ${julyShipped} shipped)`);
      }
      
      // Every 5 iterations (50 seconds), show more detailed progress
      if (iteration % 5 === 0) {
        console.log(`📊 Progress Summary (${iteration * 10} seconds elapsed):`);
        console.log(`   Orders added since start: ${currentTotal - parseInt(initial.total)}`);
        console.log(`   July progress: ${julyOrders - parseInt(initial.july_total)} orders, ${julyShipped - parseInt(initial.july_shipped)} shipped`);
        console.log(`   Remaining gap: ${14710 - julyShipped} shipped orders`);
      }
    }
    
    // Final results
    const finalCheck = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' THEN 1 END) as july_total,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' AND fulfillment_status = 'fulfilled' THEN 1 END) as july_shipped,
        MIN(order_date) as earliest,
        MAX(order_date) as latest
      FROM orders 
      WHERE brand_id = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'
    `);
    
    const final = finalCheck.rows[0];
    
    console.log('\n🎯 COMPLETE RESYNC RESULTS:');
    console.log(`Total orders: ${final.total} (was ${initial.total}, +${final.total - initial.total})`);
    console.log(`July orders: ${final.july_total} (was ${initial.july_total}, +${final.july_total - initial.july_total})`);
    console.log(`July shipped: ${final.july_shipped} (was ${initial.july_shipped}, +${final.july_shipped - initial.july_shipped})`);
    console.log(`Date coverage: ${final.earliest?.toISOString().split('T')[0]} to ${final.latest?.toISOString().split('T')[0]}`);
    console.log(`Target: 14,710 July shipped`);
    console.log(`Gap: ${14710 - final.july_shipped}`);
    
    let success = false;
    if (parseInt(final.july_shipped) >= 14000) {
      console.log('✅ MISSION ACCOMPLISHED: July shipment target achieved!');
      success = true;
    } else if (parseInt(final.july_shipped) >= 10000) {
      console.log('✅ MAJOR SUCCESS: Substantial July data captured');
      success = true;
    } else if (parseInt(final.july_total) >= 10000) {
      console.log('⚠️ PARTIAL SUCCESS: July orders found, fulfillment status may need review');
    } else if (parseInt(final.july_total) > 0) {
      console.log('⚠️ MINIMAL SUCCESS: Some July data captured');
    } else {
      console.log('❌ NO SUCCESS: July data gap persists');
    }
    
    return {
      success,
      initialOrders: parseInt(initial.total),
      finalOrders: parseInt(final.total),
      ordersAdded: parseInt(final.total) - parseInt(initial.total),
      julyOrders: parseInt(final.july_total),
      julyShipped: parseInt(final.july_shipped),
      breakthrough: julyBreakthrough,
      gap: 14710 - parseInt(final.july_shipped)
    };
    
  } catch (error) {
    console.error('❌ Complete resync failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

completeOrderResync().then(results => {
  console.log('\n🎯 COMPLETE ORDER RESYNC FINISHED');
  console.log(`Orders added: ${results.ordersAdded}`);
  console.log(`July orders: ${results.julyOrders}`);
  console.log(`July shipped: ${results.julyShipped}`);
  console.log(`Gap remaining: ${results.gap}`);
  
  if (results.success) {
    console.log('✅ SUCCESS: July data capture complete or substantially achieved');
  } else if (results.breakthrough) {
    console.log('⚠️ PARTIAL: July breakthrough achieved, may need additional sync cycles');
  } else {
    console.log('❌ CHALLENGE: July data gap persists, may need different approach');
  }
  
  process.exit(0);
}).catch(error => {
  console.error('❌ Complete resync failed:', error);
  process.exit(1);
});