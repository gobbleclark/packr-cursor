/**
 * Verify Complete Trackstar Field Mapping
 * This script confirms we're capturing every field from Trackstar orders
 */

console.log('🔍 VERIFYING COMPLETE TRACKSTAR FIELD MAPPING');
console.log('='.repeat(60));

// Check database schema for all new Trackstar fields
const { sql } = await import('drizzle-orm');

async function verifyCompleteFieldMapping() {
  try {
    const { db } = await import('./server/db.ts');
    
    console.log('\n📋 CHECKING DATABASE SCHEMA FOR NEW TRACKSTAR FIELDS:');
    console.log('-'.repeat(50));
    
    // Check all new fields are present
    const schemaQuery = `
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name IN (
        'warehouse_customer_id', 'reference_id', 'raw_status', 'channel', 
        'channel_object', 'order_type', 'trading_partner', 'is_third_party_freight',
        'third_party_freight_account_number', 'first_party_freight_account_number',
        'invoice_currency_code', 'saturday_delivery', 'signature_required',
        'international_duty_paid_by', 'shipments', 'external_system_url',
        'trackstar_tags', 'additional_fields'
      )
      ORDER BY column_name;
    `;
    
    const result = await db.execute(sql.raw(schemaQuery));
    
    if (result.rows.length > 0) {
      console.log('✅ NEW TRACKSTAR FIELDS CONFIRMED IN DATABASE:');
      result.rows.forEach(row => {
        console.log(`  📋 ${row.column_name} (${row.data_type}) - Default: ${row.column_default || 'null'}`);
      });
    } else {
      console.log('❌ No new Trackstar fields found in database schema');
    }
    
    // Check field coverage
    console.log('\n📊 FIELD COVERAGE ANALYSIS:');
    console.log('-'.repeat(40));
    
    const expectedTrackstarFields = [
      'warehouse_customer_id', 'reference_id', 'raw_status', 'channel', 'channel_object',
      'order_type', 'trading_partner', 'is_third_party_freight', 'third_party_freight_account_number',
      'first_party_freight_account_number', 'invoice_currency_code', 'saturday_delivery',
      'signature_required', 'international_duty_paid_by', 'shipments', 'external_system_url',
      'trackstar_tags', 'additional_fields'
    ];
    
    const foundFields = result.rows.map(row => row.column_name);
    const missingFields = expectedTrackstarFields.filter(field => !foundFields.includes(field));
    
    console.log(`✅ Fields in database: ${foundFields.length}`);
    console.log(`❌ Missing fields: ${missingFields.length}`);
    
    if (missingFields.length > 0) {
      console.log('\n🚨 MISSING FIELDS:');
      missingFields.forEach(field => console.log(`  ❌ ${field}`));
    } else {
      console.log('\n🎯 100% FIELD COVERAGE ACHIEVED!');
      console.log('   All expected Trackstar fields are present in database schema');
    }
    
    // Check data population
    console.log('\n📊 CHECKING ACTUAL DATA POPULATION:');
    console.log('-'.repeat(40));
    
    const dataQuery = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(warehouse_customer_id) as has_warehouse_customer_id,
        COUNT(reference_id) as has_reference_id,
        COUNT(raw_status) as has_raw_status,
        COUNT(channel) as has_channel,
        COUNT(order_type) as has_order_type,
        COUNT(trading_partner) as has_trading_partner
      FROM orders 
      WHERE brand_id = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
    `;
    
    const dataResult = await db.execute(sql.raw(dataQuery));
    const stats = dataResult.rows[0];
    
    console.log(`📦 Total orders: ${stats.total_orders}`);
    console.log(`🏢 Orders with warehouse_customer_id: ${stats.has_warehouse_customer_id}`);
    console.log(`📋 Orders with reference_id: ${stats.has_reference_id}`);
    console.log(`🔄 Orders with raw_status: ${stats.has_raw_status}`);
    console.log(`📺 Orders with channel: ${stats.has_channel}`);
    console.log(`📦 Orders with order_type: ${stats.has_order_type}`);
    console.log(`🤝 Orders with trading_partner: ${stats.has_trading_partner}`);
    
    // Calculate field population percentage
    const totalOrders = parseInt(stats.total_orders);
    if (totalOrders > 0) {
      console.log('\n📈 FIELD POPULATION RATES:');
      console.log('-'.repeat(30));
      Object.entries(stats).forEach(([key, value]) => {
        if (key !== 'total_orders') {
          const percentage = ((parseInt(value) / totalOrders) * 100).toFixed(1);
          console.log(`  ${key}: ${percentage}%`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

// Run verification
console.log('🚀 Starting verification...\n');
await verifyCompleteFieldMapping();
console.log('\n✅ Verification completed!');