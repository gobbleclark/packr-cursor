/**
 * Debug script to test warehouse inventory sync
 */

import { shipHeroApiFixed } from './server/services/shipHeroApiFixed.js';
import { storage } from './server/storage.js';

async function debugWarehouseSync() {
  console.log('=== WAREHOUSE SYNC DEBUG ===');
  
  try {
    // Get brand
    const brand = await storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    console.log(`Brand: ${brand.name}`);
    
    // Get credentials
    const credentials = {
      username: brand.shipHeroApiKey,
      password: brand.shipHeroPassword
    };
    console.log(`Credentials: ${credentials.username}`);
    
    // Test connection
    console.log('Testing ShipHero connection...');
    const connected = await shipHeroApiFixed.testConnection(credentials);
    console.log(`Connection: ${connected ? 'SUCCESS' : 'FAILED'}`);
    
    if (!connected) {
      console.log('❌ Cannot proceed - connection failed');
      return;
    }
    
    // Get products with warehouse data
    console.log('Fetching products...');
    const products = await shipHeroApiFixed.getProducts(credentials);
    console.log(`Products fetched: ${products.length}`);
    
    // Analyze warehouse data
    let withWarehouseData = 0;
    let withoutWarehouseData = 0;
    
    for (const product of products) {
      if (product.warehouse_products && product.warehouse_products.length > 0) {
        withWarehouseData++;
        console.log(`✅ ${product.sku}: ${product.warehouse_products.length} warehouses`);
        product.warehouse_products.forEach(wh => {
          console.log(`   - Warehouse ${wh.warehouse_id}: ${wh.on_hand || 0} on hand`);
        });
      } else {
        withoutWarehouseData++;
        console.log(`❌ ${product.sku}: No warehouse data`);
      }
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Products with warehouse data: ${withWarehouseData}`);
    console.log(`Products without warehouse data: ${withoutWarehouseData}`);
    console.log(`Total products: ${products.length}`);
    
  } catch (error) {
    console.error('Debug failed:', error);
  }
}

debugWarehouseSync();