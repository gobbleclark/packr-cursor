/**
 * Complete Trackstar Migration
 * Clean slate transition from ShipHero to Trackstar
 */

import pg from 'pg';
const { Client } = pg;

async function completeTrackstarMigration() {
  console.log('🔄 COMPLETE SHIPHERO → TRACKSTAR CLEAN SLATE MIGRATION');
  console.log('🎯 Clean slate: Erase ShipHero data, prepare for Trackstar');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Step 1: Backup current counts
    console.log('\n📊 CURRENT DATA COUNT:');
    const currentData = await client.query(`
      SELECT 
        COUNT(*) as total_orders,
        (SELECT COUNT(*) FROM order_items) as total_order_items,
        (SELECT COUNT(*) FROM products) as total_products
      FROM orders
    `);
    const counts = currentData.rows[0];
    console.log(`   Orders: ${counts.total_orders}`);
    console.log(`   Order Items: ${counts.total_order_items}`);
    console.log(`   Products: ${counts.total_products}`);
    
    // Step 2: Clean slate - remove all ShipHero data
    console.log('\n🧹 STEP 1: Clean slate - removing all ShipHero data');
    
    // Delete order items first (foreign key constraint)
    const deletedItems = await client.query('DELETE FROM order_items');
    console.log(`   Deleted ${deletedItems.rowCount} order items`);
    
    // Delete orders
    const deletedOrders = await client.query('DELETE FROM orders');
    console.log(`   Deleted ${deletedOrders.rowCount} orders`);
    
    // Delete products
    const deletedProducts = await client.query('DELETE FROM products');
    console.log(`   Deleted ${deletedProducts.rowCount} products`);
    
    // Clear sync status
    await client.query('DELETE FROM sync_status');
    console.log(`   Cleared sync status`);
    
    // Step 3: Update brands for Trackstar
    console.log('\n🔧 STEP 2: Configuring brands for Trackstar');
    
    // Update brands to use Trackstar instead of ShipHero
    const brandUpdate = await client.query(`
      UPDATE brands SET 
        ship_hero_api_key = NULL,
        ship_hero_password = NULL,
        ship_hero_user_id = NULL,
        trackstar_api_key = '269fcaf8b50a4fb4b384724f3e5d76db',
        integration_status = 'trackstar_ready'
    `);
    console.log(`   Updated ${brandUpdate.rowCount} brands with Trackstar credentials`);
    
    // Step 4: Add necessary Trackstar columns if not exists
    console.log('\n📋 STEP 3: Updating database schema for Trackstar');
    
    // Add Trackstar fields to orders table
    await client.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS trackstar_order_id VARCHAR,
      ADD COLUMN IF NOT EXISTS trackstar_integration_id VARCHAR,
      ADD COLUMN IF NOT EXISTS warehouse_name VARCHAR,
      ADD COLUMN IF NOT EXISTS warehouse_id VARCHAR,
      ADD COLUMN IF NOT EXISTS cost_details JSONB,
      ADD COLUMN IF NOT EXISTS custom_fields JSONB
    `);
    
    // Add Trackstar fields to products table
    await client.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS trackstar_product_id VARCHAR,
      ADD COLUMN IF NOT EXISTS warehouse_locations JSONB,
      ADD COLUMN IF NOT EXISTS product_dimensions JSONB,
      ADD COLUMN IF NOT EXISTS cost_per_unit DECIMAL(10,2)
    `);
    
    // Add indexes for Trackstar fields
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_trackstar_order_id ON orders(trackstar_order_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_trackstar_product_id ON products(trackstar_product_id);
    `);
    
    console.log('   Added Trackstar schema fields and indexes');
    
    // Step 5: Initialize Trackstar sync status
    console.log('\n📡 STEP 4: Initializing Trackstar sync status');
    
    await client.query(`
      INSERT INTO sync_status (brand_id, sync_type, last_sync_at, last_sync_status, records_processed, error_details)
      SELECT id, 'trackstar_initial', NOW(), 'ready', 0, 
             '{"message": "Clean slate migration complete, ready for Trackstar sync", "api_key": "configured", "timestamp": "' || NOW() || '"}'::jsonb
      FROM brands
      WHERE trackstar_api_key IS NOT NULL
    `);
    
    // Step 6: Final verification
    console.log('\n📊 MIGRATION COMPLETE:');
    const finalCheck = await client.query(`
      SELECT 
        COUNT(*) as orders_count,
        (SELECT COUNT(*) FROM order_items) as items_count,
        (SELECT COUNT(*) FROM products) as products_count,
        (SELECT COUNT(*) FROM brands WHERE trackstar_api_key IS NOT NULL) as brands_with_trackstar,
        (SELECT COUNT(*) FROM sync_status WHERE sync_type = 'trackstar_initial') as trackstar_ready_brands
      FROM orders
    `);
    
    const final = finalCheck.rows[0];
    console.log(`   Orders: ${final.orders_count} (clean slate)`);
    console.log(`   Products: ${final.products_count} (clean slate)`);
    console.log(`   Brands with Trackstar: ${final.brands_with_trackstar}`);
    console.log(`   Trackstar ready brands: ${final.trackstar_ready_brands}`);
    
    console.log('\n🎉 CLEAN SLATE MIGRATION COMPLETE!');
    console.log('═══════════════════════════════════════════════');
    console.log('✅ All ShipHero data erased');
    console.log('✅ Database schema updated for Trackstar');
    console.log('✅ Brands configured with Trackstar API key');
    console.log('✅ Ready for fresh Trackstar data import');
    console.log('═══════════════════════════════════════════════');
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. UI will now show only Trackstar integration options');
    console.log('2. Use Trackstar API to import fresh data');
    console.log('3. Configure webhooks for real-time updates');
    console.log('4. Test with initial order sync from warehouse');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

completeTrackstarMigration().catch(console.error);