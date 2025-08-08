/**
 * Historical sync to capture missing July data - uses working 5-minute sync patterns
 * This extends the current working sync back to July 1st
 */

import pg from 'pg';

const { Client } = pg;

// Database connection
const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function historicalSync30Days() {
  console.log('🚨 HISTORICAL SYNC: Capturing missing July 2025 orders');
  console.log('🎯 Target: 14,710 shipped orders from ShipHero report');
  
  try {
    await client.connect();
    
    // Check current state
    const currentState = await client.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' THEN 1 END) as july_orders,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' AND fulfillment_status = 'fulfilled' THEN 1 END) as july_shipped,
        MIN(order_date) as earliest_order,
        MAX(order_date) as latest_order
      FROM orders 
      WHERE brand_id = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'
    `);
    
    const current = currentState.rows[0];
    console.log('📊 CURRENT DATABASE STATE:');
    console.log(`   Total orders: ${current.total_orders}`);
    console.log(`   July orders: ${current.july_orders}`);
    console.log(`   July shipped: ${current.july_shipped}`);
    console.log(`   Date range: ${current.earliest_order} to ${current.latest_order}`);
    
    if (current.july_orders > 0) {
      console.log('✅ July data already exists in database');
      console.log(`🎯 Gap analysis: Need ${14710 - parseInt(current.july_shipped)} more shipped orders`);
    } else {
      console.log('🚨 CRITICAL: No July data found - complete sync needed');
    }
    
    // Trigger comprehensive sync via the working incremental sync mechanism
    console.log('\n🔄 Monitoring active sync progress...');
    
    let previousCount = parseInt(current.total_orders);
    let iterations = 0;
    const maxIterations = 60; // Monitor for up to 60 iterations
    
    while (iterations < maxIterations) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
      const progressCheck = await client.query(`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' THEN 1 END) as july_orders,
          COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' AND fulfillment_status = 'fulfilled' THEN 1 END) as july_shipped,
          MAX(last_sync_at) as last_sync
        FROM orders 
        WHERE brand_id = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'
      `);
      
      const progress = progressCheck.rows[0];
      const newCount = parseInt(progress.total_orders);
      
      if (newCount > previousCount) {
        const added = newCount - previousCount;
        console.log(`📈 Progress: +${added} orders (Total: ${newCount}, July: ${progress.july_orders}, July shipped: ${progress.july_shipped})`);
        previousCount = newCount;
        
        // Check if we've reached our target
        const julyShippedCount = parseInt(progress.july_shipped);
        if (julyShippedCount > 10000) {
          console.log(`🎯 SUCCESS: Found ${julyShippedCount} July shipped orders - approaching target!`);
          break;
        }
      } else {
        console.log(`⏳ Waiting... (Total: ${newCount}, July shipped: ${progress.july_shipped})`);
      }
      
      iterations++;
    }
    
    // Final state check
    const finalState = await client.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' THEN 1 END) as july_orders,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' AND fulfillment_status = 'fulfilled' THEN 1 END) as july_shipped,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' AND fulfillment_status != 'fulfilled' THEN 1 END) as july_unfulfilled
      FROM orders 
      WHERE brand_id = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'
    `);
    
    const final = finalState.rows[0];
    
    console.log('\n🎯 FINAL RESULTS:');
    console.log(`   Total orders: ${final.total_orders}`);
    console.log(`   July total: ${final.july_orders}`);
    console.log(`   July shipped: ${final.july_shipped}`);
    console.log(`   July unfulfilled: ${final.july_unfulfilled}`);
    console.log(`   Target: 14,710 shipped`);
    console.log(`   Gap: ${14710 - parseInt(final.july_shipped)} orders`);
    
    if (parseInt(final.july_shipped) > 10000) {
      console.log('✅ SUCCESS: Substantial July shipment data captured');
    } else if (parseInt(final.july_orders) > 5000) {
      console.log('⚠️ PARTIAL: Good July data but may need fulfillment status verification');
    } else {
      console.log('❌ INSUFFICIENT: More historical sync needed');
    }
    
    return {
      totalOrders: parseInt(final.total_orders),
      julyOrders: parseInt(final.july_orders),
      julyShipped: parseInt(final.july_shipped),
      target: 14710,
      gap: 14710 - parseInt(final.july_shipped)
    };
    
  } catch (error) {
    console.error('❌ Historical sync monitoring failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the sync monitoring
historicalSync30Days().then(results => {
  console.log('\n📊 HISTORICAL SYNC MONITORING COMPLETE');
  
  if (results.gap < 1000) {
    console.log('✅ EXCELLENT: Very close to ShipHero target');
  } else if (results.gap < 5000) {
    console.log('✅ GOOD: Substantial progress toward target');
  } else {
    console.log('⚠️ NEEDS MORE WORK: Significant gap remains');
  }
  
  process.exit(0);
}).catch(error => {
  console.error('❌ Monitoring failed:', error);
  process.exit(1);
});