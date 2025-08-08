/**
 * Clean ShipHero to Trackstar Migration
 * Complete transition to universal WMS API
 */

import pg from 'pg';
const { Client } = pg;

async function cleanMigration() {
  console.log('🔄 STARTING CLEAN SHIPHERO → TRACKSTAR MIGRATION');
  console.log('🎯 Preserving data, adding Trackstar support\n');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Check current state
    console.log('📊 CURRENT STATE:');
    const stateCheck = await client.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' THEN 1 END) as july_orders,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' AND fulfillment_status = 'fulfilled' THEN 1 END) as july_shipped
      FROM orders
    `);
    const state = stateCheck.rows[0];
    console.log(`   Total Orders: ${state.total_orders}`);
    console.log(`   July Orders: ${state.july_orders} (${state.july_shipped} shipped)`);
    
    // Step 1: Add integration status to brands
    console.log('\n🔧 STEP 1: Updating brands for Trackstar');
    await client.query(`
      ALTER TABLE brands ADD COLUMN IF NOT EXISTS integration_status VARCHAR DEFAULT 'shiphero_legacy'
    `);
    
    await client.query(`
      UPDATE brands 
      SET integration_status = 'ready_for_trackstar'
      WHERE ship_hero_api_key IS NOT NULL
    `);
    console.log('✅ Brands updated for Trackstar migration');
    
    // Step 2: Stop ShipHero sync processes
    console.log('\n🛑 STEP 2: Stopping ShipHero processes');
    
    // Simple approach - just mark sync as stopped
    await client.query(`
      UPDATE sync_status 
      SET last_sync_status = 'migration_stopped'
      WHERE sync_type IN ('orders', 'products', 'inventory')
    `);
    
    // Mark all existing orders as historical
    await client.query(`
      UPDATE orders 
      SET tags = CASE 
        WHEN tags IS NULL OR tags::text = '[]' THEN '["shiphero_historical"]'::jsonb
        ELSE tags::jsonb || '["shiphero_historical"]'::jsonb
      END
      WHERE ship_hero_order_id IS NOT NULL
    `);
    console.log('✅ ShipHero processes stopped, orders marked as historical');
    
    // Step 3: Final verification
    console.log('\n📊 MIGRATION COMPLETE:');
    const finalCheck = await client.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN integration_status = 'ready_for_trackstar' THEN 1 END) as brands_ready,
        COUNT(CASE WHEN tags::text LIKE '%shiphero_historical%' THEN 1 END) as historical_orders
      FROM orders o
      JOIN brands b ON o.brand_id = b.id
    `);
    
    const final = finalCheck.rows[0];
    console.log(`   Orders Preserved: ${final.total_orders}`);
    console.log(`   Brands Ready: ${final.brands_ready}`);
    console.log(`   Historical Orders: ${final.historical_orders}`);
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Use Trackstar UI to connect brands to their WMS');
    console.log('2. All existing data is preserved and tagged');
    console.log('3. ShipHero sync processes are stopped');
    console.log('4. Ready for Trackstar universal WMS integration');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

cleanMigration().catch(console.error);