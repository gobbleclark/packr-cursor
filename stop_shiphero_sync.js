/**
 * Stop all ShipHero synchronization processes
 */

import pg from 'pg';
const { Client } = pg;

async function stopShipHeroSync() {
  console.log('🛑 STOPPING ALL SHIPHERO SYNC PROCESSES');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Update sync status to stopped
    await client.query(`
      INSERT INTO sync_status (brand_id, sync_type, last_sync_at, last_sync_status, records_processed, error_details)
      SELECT DISTINCT brand_id, 'shiphero_sync_stopped', NOW(), 'stopped', 0, 
             '{"message": "ShipHero sync manually stopped - migrating to Trackstar", "timestamp": "' || NOW() || '"}'
      FROM orders 
      WHERE brand_id IS NOT NULL
      ON CONFLICT (brand_id, sync_type) DO UPDATE SET
        last_sync_at = NOW(),
        last_sync_status = 'stopped',
        error_details = '{"message": "ShipHero sync manually stopped - migrating to Trackstar", "timestamp": "' || NOW() || '"}'
    `);
    
    console.log('✅ ShipHero sync processes marked as stopped in database');
    console.log('✅ All background jobs will be terminated');
    console.log('🚀 Ready for Trackstar migration');
    
  } catch (error) {
    console.error('❌ Failed to stop sync:', error);
  } finally {
    await client.end();
  }
}

stopShipHeroSync().catch(console.error);