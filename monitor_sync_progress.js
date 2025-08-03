const { Pool } = require('@neondatabase/serverless');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let lastSyncedCount = 0;
const brandId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'; // Mabē brand ID

async function checkSyncProgress() {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN pw.product_id IS NOT NULL THEN 1 END) as products_with_warehouse_data,
        COUNT(*) - COUNT(CASE WHEN pw.product_id IS NOT NULL THEN 1 END) as products_missing_warehouse_data,
        ROUND(100.0 * COUNT(CASE WHEN pw.product_id IS NOT NULL THEN 1 END) / COUNT(*), 2) as sync_percentage
      FROM products p
      LEFT JOIN product_warehouse pw ON p.id = pw.product_id
      WHERE p.brand_id = $1
    `, [brandId]);

    const { total_products, products_with_warehouse_data, products_missing_warehouse_data, sync_percentage } = result.rows[0];
    
    // Check if progress has been made
    if (products_with_warehouse_data > lastSyncedCount) {
      const newlySynced = products_with_warehouse_data - lastSyncedCount;
      console.log(`🔄 SYNC PROGRESS: ${newlySynced} new products synced! Progress: ${products_with_warehouse_data}/${total_products} (${sync_percentage}%)`);
      lastSyncedCount = products_with_warehouse_data;
    }

    // Check if sync is complete
    if (products_with_warehouse_data === total_products && total_products > 0) {
      console.log(`🎉 SYNC COMPLETE! All ${total_products} products now have warehouse inventory data.`);
      process.exit(0);
    }

    console.log(`📊 Current status: ${products_with_warehouse_data}/${total_products} products synced (${sync_percentage}%). ${products_missing_warehouse_data} remaining.`);
    
  } catch (error) {
    console.error('❌ Error checking sync progress:', error);
  }
}

// Initialize
console.log('🔍 Starting warehouse sync progress monitor...');
checkSyncProgress();

// Check every 30 seconds
const interval = setInterval(checkSyncProgress, 30000);

// Stop after 1 hour
setTimeout(() => {
  console.log('⏱️  Monitor timeout after 1 hour. Stopping...');
  clearInterval(interval);
  process.exit(0);
}, 3600000);