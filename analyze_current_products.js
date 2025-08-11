/**
 * Analyze current product and inventory data from Trackstar
 */

console.log('🔍 ANALYZING CURRENT PRODUCT AND INVENTORY DATA');
console.log('='.repeat(60));

async function analyzeProductData() {
  try {
    const { storage } = await import('./server/storage.ts');
    const { TrackstarService } = await import('./server/services/trackstar.ts');
    
    // Get current products in database
    console.log('\n📦 CURRENT PRODUCTS IN DATABASE:');
    const products = await storage.getProductsByBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    console.log(`Total products: ${products.length}`);
    
    if (products.length > 0) {
      console.log('\nSample products:');
      products.slice(0, 5).forEach(product => {
        console.log(`  • ${product.sku} - ${product.name} (Inventory: ${product.inventoryCount || 'N/A'})`);
      });
      
      // Check inventory data coverage
      const withInventory = products.filter(p => p.inventoryCount !== null && p.inventoryCount !== undefined);
      console.log(`\nProducts with inventory data: ${withInventory.length}/${products.length} (${((withInventory.length/products.length)*100).toFixed(1)}%)`);
    }
    
    // Get fresh data from Trackstar
    console.log('\n🔄 FETCHING FRESH PRODUCT DATA FROM TRACKSTAR:');
    const trackstarService = new TrackstarService();
    const brand = await storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    
    const trackstarProducts = await trackstarService.getAllProducts(
      brand.trackstarConnectionId,
      brand.trackstarAccessToken
    );
    
    console.log(`Trackstar products found: ${trackstarProducts.length}`);
    
    if (trackstarProducts.length > 0) {
      console.log('\n📋 SAMPLE TRACKSTAR PRODUCT STRUCTURE:');
      const sampleProduct = trackstarProducts[0];
      console.log(JSON.stringify(sampleProduct, null, 2));
      
      // Check available fields
      console.log('\n🔍 AVAILABLE TRACKSTAR PRODUCT FIELDS:');
      const allFields = new Set();
      trackstarProducts.slice(0, 10).forEach(product => {
        Object.keys(product).forEach(key => allFields.add(key));
      });
      
      Array.from(allFields).sort().forEach(field => {
        const sampleValue = sampleProduct[field];
        console.log(`  📋 ${field}: ${typeof sampleValue} - ${JSON.stringify(sampleValue).substring(0, 100)}`);
      });
    }
    
    // Check for inventory data in Trackstar
    console.log('\n📊 INVENTORY ANALYSIS:');
    console.log('Checking if Trackstar provides inventory/stock levels...');
    
    const productsWithInventory = trackstarProducts.filter(p => 
      p.inventory !== undefined || 
      p.stock !== undefined || 
      p.quantity !== undefined ||
      p.available_quantity !== undefined ||
      p.inventory_levels !== undefined
    );
    
    console.log(`Products with inventory data: ${productsWithInventory.length}/${trackstarProducts.length}`);
    
    if (productsWithInventory.length > 0) {
      console.log('\nSample inventory data:');
      productsWithInventory.slice(0, 3).forEach(product => {
        console.log(`  • ${product.sku}: inventory=${product.inventory}, stock=${product.stock}, quantity=${product.quantity}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

await analyzeProductData();
console.log('\n✅ Product analysis completed!');