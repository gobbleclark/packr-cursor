/**
 * Trigger specific date sync targeting July 1-8, 2025
 * This is the exact missing window from our 30-day vs 39-day analysis
 */

import fetch from 'node-fetch';
import pg from 'pg';

const { Client } = pg;

async function triggerSpecificJulySync() {
  console.log('🚨 SPECIFIC JULY 1-8 SYNC');
  console.log('🎯 Target: Missing orders from July 1-8, 2025 (the gap in 30-day window)');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Check current state
    const beforeResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-07-09' THEN 1 END) as july_1_to_8,
        COUNT(CASE WHEN order_date >= '2025-07-09' AND order_date < '2025-08-01' THEN 1 END) as july_9_plus
      FROM orders 
      WHERE brand_id = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'
    `);
    
    const before = beforeResult.rows[0];
    console.log(`📊 BEFORE: July 1-8: ${before.july_1_to_8}, July 9+: ${before.july_9_plus}`);
    
    if (parseInt(before.july_1_to_8) > 100) {
      console.log('✅ July 1-8 data already exists - the fix worked!');
      return {
        success: true,
        july1to8: parseInt(before.july_1_to_8)
      };
    }
    
    // Wait for the restarted sync to process
    console.log('⏳ Waiting for background sync to process July 1-8 data...');
    
    let iteration = 0;
    const maxIterations = 30; // 5 minutes of monitoring
    let foundJuly1to8 = false;
    
    while (iteration < maxIterations && !foundJuly1to8) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
      const progressResult = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-07-09' THEN 1 END) as july_1_to_8,
          COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' AND fulfillment_status = 'fulfilled' THEN 1 END) as july_shipped
        FROM orders 
        WHERE brand_id = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'
      `);
      
      const current = progressResult.rows[0];
      const july1to8 = parseInt(current.july_1_to_8);
      const julyShipped = parseInt(current.july_shipped);
      
      iteration++;
      
      console.log(`📊 ${iteration}: July 1-8: ${july1to8}, July shipped: ${julyShipped}`);
      
      if (july1to8 > 0) {
        console.log('🎉 BREAKTHROUGH: July 1-8 data found!');
        foundJuly1to8 = true;
        
        if (julyShipped > 10000) {
          console.log('✅ MAJOR SUCCESS: Substantial July shipments captured!');
          break;
        } else if (julyShipped > 5000) {
          console.log('✅ GOOD PROGRESS: Significant July shipments');
        } else if (july1to8 > 1000) {
          console.log('⚠️ PARTIAL: July 1-8 data found but shipment status needs review');
        } else {
          console.log('📍 MINIMAL: Some July 1-8 data appearing');
        }
      }
      
      if (julyShipped >= 14000) {
        console.log('🎯 TARGET ACHIEVED: July shipment goal reached!');
        break;
      }
    }
    
    // Final results
    const finalResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-07-09' THEN 1 END) as july_1_to_8,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' THEN 1 END) as july_total,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' AND fulfillment_status = 'fulfilled' THEN 1 END) as july_shipped
      FROM orders 
      WHERE brand_id = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'
    `);
    
    const final = finalResult.rows[0];
    
    console.log('\n🎯 SPECIFIC JULY SYNC RESULTS:');
    console.log(`July 1-8 orders: ${final.july_1_to_8} (was ${before.july_1_to_8})`);
    console.log(`July total: ${final.july_total}`);
    console.log(`July shipped: ${final.july_shipped}`);
    console.log(`Target: 14,710 July shipped`);
    console.log(`Gap: ${14710 - final.july_shipped}`);
    
    return {
      success: foundJuly1to8,
      july1to8: parseInt(final.july_1_to_8),
      julyTotal: parseInt(final.july_total),
      julyShipped: parseInt(final.july_shipped),
      gap: 14710 - parseInt(final.july_shipped)
    };
    
  } catch (error) {
    console.error('❌ Specific July sync failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

triggerSpecificJulySync().then(results => {
  console.log('\n🎯 SPECIFIC JULY SYNC COMPLETE');
  console.log(`July 1-8 orders found: ${results.july1to8}`);
  console.log(`July total: ${results.julyTotal}`);
  console.log(`July shipped: ${results.julyShipped}`);
  console.log(`Gap: ${results.gap}`);
  
  if (results.success && results.july1to8 > 100) {
    console.log('✅ SUCCESS: July 1-8 gap fixed! Date range correction worked');
  } else if (results.julyShipped > 10000) {
    console.log('✅ MAJOR SUCCESS: Substantial July shipments captured');
  } else {
    console.log('⚠️ PARTIAL: Some progress but may need additional sync cycles');
  }
  
  process.exit(0);
}).catch(error => {
  console.error('❌ Specific July sync failed:', error);
  process.exit(1);
});