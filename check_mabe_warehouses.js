/**
 * Check Mabē warehouse and inventory data
 */

console.log('🏪 CHECKING MABĒ WAREHOUSE AND INVENTORY DATA');
console.log('='.repeat(60));

async function checkWarehouseData() {
  try {
    const { storage } = await import('./server/storage.ts');
    
    console.log('\n📦 MABĒ PRODUCT INVENTORY SUMMARY:');
    const mabeBrandId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
    const products = await storage.getProductsByBrand(mabeBrandId);
    
    const totalProducts = products.length;
    const withInventory = products.filter(p => p.inventoryCount > 0);
    const totalInventoryUnits = products.reduce((sum, p) => sum + (p.inventoryCount || 0), 0);
    
    console.log(`Total Products: ${totalProducts}`);
    console.log(`Products with Inventory: ${withInventory.length} (${((withInventory.length/totalProducts)*100).toFixed(1)}%)`);
    console.log(`Total Inventory Units: ${totalInventoryUnits.toLocaleString()}`);
    
    console.log('\n🔝 TOP 15 PRODUCTS BY INVENTORY:');
    const topProducts = products
      .filter(p => p.inventoryCount > 0)
      .sort((a, b) => (b.inventoryCount || 0) - (a.inventoryCount || 0))
      .slice(0, 15);
      
    topProducts.forEach((product, index) => {
      console.log(`  ${index + 1}. ${product.sku} - ${product.name}`);
      console.log(`     📦 ${product.inventoryCount?.toLocaleString()} units`);
    });
    
    console.log('\n📊 INVENTORY DISTRIBUTION:');
    const ranges = [
      { min: 10000, max: Infinity, label: '10,000+ units' },
      { min: 5000, max: 9999, label: '5,000-9,999 units' },
      { min: 1000, max: 4999, label: '1,000-4,999 units' },
      { min: 100, max: 999, label: '100-999 units' },
      { min: 1, max: 99, label: '1-99 units' },
      { min: 0, max: 0, label: 'Zero inventory' }
    ];
    
    ranges.forEach(range => {
      const count = products.filter(p => {
        const inv = p.inventoryCount || 0;
        return range.max === Infinity ? inv >= range.min : inv >= range.min && inv <= range.max;
      }).length;
      
      if (count > 0) {
        console.log(`  ${range.label}: ${count} products`);
      }
    });
    
    console.log('\n🏷️ PRODUCT CATEGORIES (by SKU patterns):');
    const categories = {
      'Monarch Carriers (MON-*)': products.filter(p => p.sku.startsWith('MON-')),
      'Gift Cards': products.filter(p => p.name.includes('Gift Card')),
      'Shipping Protection (Recura)': products.filter(p => p.sku.startsWith('Recura')),
      'Special Promotions': products.filter(p => p.sku.includes('dadszn') || p.sku.includes('WINGS')),
      'Packaging/Boxes': products.filter(p => p.name.includes('Box') || p.name.includes('box')),
      'Other Products': products.filter(p => 
        !p.sku.startsWith('MON-') && 
        !p.name.includes('Gift Card') && 
        !p.sku.startsWith('Recura') &&
        !p.sku.includes('dadszn') &&
        !p.sku.includes('WINGS') &&
        !p.name.toLowerCase().includes('box')
      )
    };
    
    Object.entries(categories).forEach(([category, items]) => {
      const withStock = items.filter(p => p.inventoryCount > 0);
      const totalStock = items.reduce((sum, p) => sum + (p.inventoryCount || 0), 0);
      console.log(`  ${category}: ${items.length} products (${withStock.length} with stock, ${totalStock.toLocaleString()} total units)`);
    });
    
  } catch (error) {
    console.error('❌ Failed to check warehouse data:', error.message);
  }
}

await checkWarehouseData();
console.log('\n✅ Warehouse data check completed!');