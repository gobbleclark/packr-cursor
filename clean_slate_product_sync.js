/**
 * Clean Slate Product and Inventory Sync
 * Removes all existing products for Mabē and performs fresh sync from Trackstar
 */

console.log('🧹 CLEAN SLATE PRODUCT AND INVENTORY SYNC');
console.log('='.repeat(60));

async function cleanSlateSync() {
  try {
    const { productInventorySync } = await import('./server/services/productInventorySync.ts');
    const { storage } = await import('./server/storage.ts');
    
    const mabeBrandId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
    
    console.log('🔍 Starting clean slate sync for Mabē...');
    
    // Get current product count before cleanup
    const currentProducts = await storage.getProductsByBrand(mabeBrandId);
    console.log(`📦 Current products in database: ${currentProducts.length}`);
    
    // Show sample of existing products
    if (currentProducts.length > 0) {
      console.log('\n📋 Sample existing products:');
      currentProducts.slice(0, 5).forEach(product => {
        console.log(`  • ${product.sku} - ${product.name} (Inventory: ${product.inventoryCount})`);
      });
    }
    
    // Perform clean slate sync
    console.log('\n🧹 Performing clean slate sync...');
    await productInventorySync.cleanSlateProductSync(mabeBrandId);
    
    // Check results
    const newProducts = await storage.getProductsByBrand(mabeBrandId);
    console.log(`\n✅ Clean slate sync completed!`);
    console.log(`📦 New product count: ${newProducts.length}`);
    
    if (newProducts.length > 0) {
      console.log('\n📋 Sample new products:');
      newProducts.slice(0, 5).forEach(product => {
        console.log(`  • ${product.sku} - ${product.name} (Inventory: ${product.inventoryCount})`);
      });
      
      // Check inventory data coverage
      const withInventory = newProducts.filter(p => p.inventoryCount > 0);
      console.log(`\n📊 Products with inventory > 0: ${withInventory.length}/${newProducts.length} (${((withInventory.length/newProducts.length)*100).toFixed(1)}%)`);
      
      // Show products with highest inventory
      const sortedByInventory = newProducts
        .filter(p => p.inventoryCount > 0)
        .sort((a, b) => (b.inventoryCount || 0) - (a.inventoryCount || 0))
        .slice(0, 10);
        
      if (sortedByInventory.length > 0) {
        console.log('\n🔝 Top 10 products by inventory:');
        sortedByInventory.forEach(product => {
          console.log(`  📦 ${product.sku} - ${product.name}: ${product.inventoryCount} units`);
        });
      }
    }
    
    console.log('\n🎯 CLEAN SLATE SYNC SUMMARY:');
    console.log(`  Before: ${currentProducts.length} products`);
    console.log(`  After: ${newProducts.length} products`);
    console.log(`  Change: ${newProducts.length - currentProducts.length > 0 ? '+' : ''}${newProducts.length - currentProducts.length}`);
    
  } catch (error) {
    console.error('❌ Clean slate sync failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the clean slate sync
await cleanSlateSync();
console.log('\n✅ Clean slate sync script completed!');