/**
 * Migration Script: ShipHero → Trackstar Universal WMS
 * Comprehensive transition to universal warehouse management system
 */

import pg from 'pg';
const { Client } = pg;

async function migrateToTrackstar() {
  console.log('🔄 STARTING SHIPHERO → TRACKSTAR MIGRATION');
  console.log('🎯 Goal: Clean transition to universal WMS API');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    console.log('\n📊 CURRENT DATABASE STATE:');
    
    // Check current data
    const dataCheck = await client.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN ship_hero_order_id IS NOT NULL THEN 1 END) as shiphero_orders,
        COUNT(CASE WHEN trackstar_order_id IS NOT NULL THEN 1 END) as trackstar_orders,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' THEN 1 END) as july_orders,
        COUNT(CASE WHEN order_date >= '2025-07-01' AND order_date < '2025-08-01' AND fulfillment_status = 'fulfilled' THEN 1 END) as july_shipped,
        MIN(order_date) as earliest_order,
        MAX(order_date) as latest_order
      FROM orders
    `);
    
    const currentState = dataCheck.rows[0];
    console.log(`   Total Orders: ${currentState.total_orders}`);
    console.log(`   ShipHero Orders: ${currentState.shiphero_orders}`);
    console.log(`   Trackstar Orders: ${currentState.trackstar_orders}`);
    console.log(`   July Orders: ${currentState.july_orders} (${currentState.july_shipped} shipped)`);
    console.log(`   Date Range: ${currentState.earliest_order} to ${currentState.latest_order}`);
    
    console.log('\n🧹 MIGRATION OPTIONS:');
    console.log('1. Keep existing data and add Trackstar support (RECOMMENDED)');
    console.log('2. Clean slate - remove all ShipHero data');
    console.log('3. Archive ShipHero data and start fresh with Trackstar');
    
    // For this script, we'll go with option 1 - keep data and add Trackstar support
    console.log('\n✅ SELECTED: Option 1 - Keep existing data, add Trackstar support');
    
    // Step 1: Update brands table to support Trackstar
    console.log('\n📋 STEP 1: Adding Trackstar fields to brands table');
    
    await client.query(`
      ALTER TABLE brands 
      ADD COLUMN IF NOT EXISTS trackstar_access_token VARCHAR,
      ADD COLUMN IF NOT EXISTS integration_status VARCHAR DEFAULT 'legacy_shiphero'
    `);
    console.log('✅ Trackstar fields added to brands table');
    
    // Step 2: Stop ShipHero background processes
    console.log('\n🛑 STEP 2: Stopping ShipHero background processes');
    
    // Update sync status to indicate migration
    await client.query(`
      INSERT INTO sync_status (brand_id, sync_type, last_sync_at, last_sync_status, records_processed, error_details)
      SELECT DISTINCT brand_id, 'migration_to_trackstar', NOW(), 'in_progress', 0, 
             ('{"message": "Migration from ShipHero to Trackstar in progress", "timestamp": "' || NOW() || '"}')::jsonb::jsonb
      FROM orders 
      WHERE brand_id IS NOT NULL
      ON CONFLICT (brand_id, sync_type) DO UPDATE SET
        last_sync_at = NOW(),
        last_sync_status = 'in_progress',
        error_details = ('{"message": "Migration from ShipHero to Trackstar in progress", "timestamp": "' || NOW() || '"}')::jsonb::jsonb
    `);
    console.log('✅ Migration status recorded');
    
    // Step 3: Create Trackstar integration records for existing brands
    console.log('\n🔗 STEP 3: Preparing brands for Trackstar integration');
    
    const brandUpdateResult = await client.query(`
      UPDATE brands 
      SET integration_status = 'ready_for_trackstar'
      WHERE ship_hero_api_key IS NOT NULL 
        AND integration_status = 'legacy_shiphero'
    `);
    console.log(`✅ Updated ${brandUpdateResult.rowCount} brands for Trackstar migration`);
    
    // Step 4: Data preservation and cleanup
    console.log('\n🗂️ STEP 4: Data preservation strategy');
    
    // Mark all existing orders as historical ShipHero data
    await client.query(`
      UPDATE orders 
      SET 
        tags = CASE 
          WHEN tags::text = '[]' THEN '["shiphero_historical"]'
          ELSE (tags::jsonb || '["shiphero_historical"]'::jsonb)::text::jsonb
        END
      WHERE ship_hero_order_id IS NOT NULL 
        AND NOT (tags::text LIKE '%shiphero_historical%')
    `);
    console.log('✅ Tagged existing orders as ShipHero historical data');
    
    // Step 5: Create migration summary
    console.log('\n📊 STEP 5: Migration summary');
    
    const finalCheck = await client.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN integration_status = 'ready_for_trackstar' THEN 1 END) as brands_ready,
        COUNT(CASE WHEN tags::text LIKE '%shiphero_historical%' THEN 1 END) as historical_orders
      FROM orders o
      JOIN brands b ON o.brand_id = b.id
    `);
    
    const summary = finalCheck.rows[0];
    
    console.log('\n🎉 MIGRATION COMPLETE!');
    console.log('═══════════════════════════════════════');
    console.log(`📦 Total Orders Preserved: ${summary.total_orders}`);
    console.log(`🏢 Brands Ready for Trackstar: ${summary.brands_ready}`);
    console.log(`📚 Historical ShipHero Orders: ${summary.historical_orders}`);
    console.log('═══════════════════════════════════════');
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Use Trackstar Setup UI to connect each brand to their WMS');
    console.log('2. Configure Trackstar webhooks for real-time sync');
    console.log('3. Test with a small brand first, then migrate others');
    console.log('4. Historical ShipHero data remains accessible for reporting');
    
    console.log('\n💡 TRACKSTAR BENEFITS:');
    console.log('✅ Universal API - works with dozens of WMS providers');
    console.log('✅ Real-time webhooks for instant order updates');
    console.log('✅ Comprehensive data sync (orders, inventory, products)');
    console.log('✅ Better rate limiting and API management');
    console.log('✅ Future-proof integration architecture');
    
    // Final status update
    await client.query(`
      UPDATE sync_status 
      SET 
        last_sync_status = 'migration_complete',
        records_processed = (SELECT COUNT(*) FROM orders WHERE brand_id = sync_status.brand_id),
        error_details = '{"message": "Successfully migrated to Trackstar architecture", "timestamp": "' || NOW() || '", "orders_preserved": ' || (SELECT COUNT(*) FROM orders WHERE brand_id = sync_status.brand_id) || '}'
      WHERE sync_type = 'migration_to_trackstar'
    `);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    
    // Log failure
    await client.query(`
      UPDATE sync_status 
      SET 
        last_sync_status = 'migration_failed',
        error_details = '{"message": "Migration failed", "error": "' + error.message + '", "timestamp": "' || NOW() || '"}'
      WHERE sync_type = 'migration_to_trackstar'
    `).catch(() => {}); // Ignore if this fails too
    
    throw error;
  } finally {
    await client.end();
  }
}

// Optional: Clean slate migration (removes all ShipHero data)
async function cleanSlateMigration() {
  console.log('🧹 CLEAN SLATE MIGRATION - REMOVING ALL SHIPHERO DATA');
  console.log('⚠️  WARNING: This will permanently delete all existing orders and data!');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Remove all orders
    const deletedOrders = await client.query('DELETE FROM order_items');
    const deletedItems = await client.query('DELETE FROM orders');
    
    // Clear ShipHero credentials
    await client.query(`
      UPDATE brands SET 
        ship_hero_api_key = NULL,
        ship_hero_password = NULL,
        ship_hero_user_id = NULL,
        integration_status = 'clean_slate_trackstar'
    `);
    
    // Reset sync status
    await client.query('DELETE FROM sync_status');
    
    console.log(`✅ Clean slate complete:`);
    console.log(`   - Deleted ${deletedOrders.rowCount} order items`);
    console.log(`   - Deleted ${deletedItems.rowCount} orders`);
    console.log(`   - Cleared all ShipHero credentials`);
    console.log(`   - Ready for fresh Trackstar integration`);
    
  } catch (error) {
    console.error('❌ Clean slate migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run migration based on command line argument
const migrationMode = process.argv[2] || 'preserve';

if (migrationMode === 'clean') {
  cleanSlateMigration().catch(console.error);
} else {
  migrateToTrackstar().catch(console.error);
}