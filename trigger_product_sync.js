/**
 * Trigger comprehensive product and inventory sync
 */

console.log('🔄 TRIGGERING COMPREHENSIVE PRODUCT AND INVENTORY SYNC');
console.log('='.repeat(60));

async function triggerProductSync() {
  try {
    const { productInventorySync } = await import('./server/services/productInventorySync.ts');
    
    console.log('🚀 Starting comprehensive product and inventory sync...');
    
    // Sync all brands products and inventory
    await productInventorySync.syncAllBrandsProductsAndInventory();
    
    console.log('✅ Product and inventory sync completed!');
    
  } catch (error) {
    console.error('❌ Product sync failed:', error.message);
  }
}

await triggerProductSync();