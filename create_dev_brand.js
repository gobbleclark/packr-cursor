/**
 * Create a feature brand called "dev"
 * This script creates a brand directly in the database
 */

import pg from 'pg';

const { Client } = pg;

async function createDevBrand() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔧 Creating feature brand "dev"...');
    
    await client.connect();
    
    // Check if the brand already exists
    const existingBrand = await client.query(
      'SELECT id, name, email FROM brands WHERE name = $1',
      ['dev']
    );
    
    if (existingBrand.rows.length > 0) {
      console.log('⚠️  Brand "dev" already exists:');
      console.log(`   ID: ${existingBrand.rows[0].id}`);
      console.log(`   Name: ${existingBrand.rows[0].name}`);
      console.log(`   Email: ${existingBrand.rows[0].email}`);
      return existingBrand.rows[0];
    }
    
    // Create the dev brand
    const result = await client.query(`
      INSERT INTO brands (
        name, 
        email, 
        three_pl_id, 
        is_active, 
        integration_status, 
        wms_provider, 
        invitation_token, 
        invitation_sent_at,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
      ) RETURNING id, name, email, three_pl_id, is_active, integration_status
    `, [
      'dev',                                    // name
      'dev@packr.com',                          // email
      'd4d15ba7-a23e-4fbb-94be-c4f19c697f85', // three_pl_id (default from codebase)
      true,                                     // is_active
      'disconnected',                           // integration_status
      null,                                     // wms_provider
      null,                                     // invitation_token
      null                                      // invitation_sent_at
    ]);
    
    const brand = result.rows[0];
    
    console.log('✅ Dev brand created successfully!');
    console.log('   Brand ID:', brand.id);
    console.log('   Brand Name:', brand.name);
    console.log('   Email:', brand.email);
    console.log('   3PL ID:', brand.three_pl_id);
    console.log('   Status:', brand.is_active ? 'Active' : 'Inactive');
    console.log('   Integration Status:', brand.integration_status);
    
    return brand;
    
  } catch (error) {
    console.error('❌ Error creating dev brand:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  createDevBrand()
    .then(() => {
      console.log('\n🎉 Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { createDevBrand };
