/**
 * Product and Inventory Synchronization Service
 * Handles comprehensive product data and real-time inventory sync from Trackstar
 */

import { TrackstarService } from './trackstar.ts';
import { storage } from '../storage.ts';

export class ProductInventorySync {
  private trackstarService: TrackstarService;

  constructor() {
    this.trackstarService = new TrackstarService();
  }

  /**
   * Complete product and inventory synchronization for all brands
   */
  async syncAllBrandsProductsAndInventory(): Promise<void> {
    console.log('🔄 Starting comprehensive product and inventory sync for all brands...');
    
    try {
      const brands = await storage.getBrandsWithTrackstarConnections();
      console.log(`📊 Found ${brands.length} brands with Trackstar integration`);
      
      for (const brand of brands) {
        if (!brand.trackstarConnectionId || !brand.trackstarAccessToken) {
          console.log(`⚠️ Skipping ${brand.name}: missing Trackstar credentials`);
          continue;
        }
        
        console.log(`🔄 Syncing products and inventory for brand: ${brand.name}`);
        await this.syncBrandProductsAndInventory(brand);
      }
      
      console.log('✅ All brands product and inventory sync completed');
    } catch (error) {
      console.error('❌ Failed to sync products and inventory:', error.message);
      throw error;
    }
  }

  /**
   * Sync products and inventory for a specific brand
   */
  async syncBrandProductsAndInventory(brand: any): Promise<void> {
    try {
      console.log(`🔗 Using connection: ${brand.trackstarConnectionId}`);
      
      // 1. Sync products first
      await this.syncProducts(brand);
      
      // 2. Sync inventory levels
      await this.syncInventory(brand);
      
      // 3. Setup webhooks for real-time updates
      await this.setupWebhooks(brand);
      
      console.log(`✅ Successfully synced products and inventory for ${brand.name}`);
      
    } catch (error) {
      console.error(`❌ Failed to sync brand ${brand.name}:`, error.message);
      throw error;
    }
  }

  /**
   * Sync products from Trackstar with complete field mapping
   */
  private async syncProducts(brand: any): Promise<void> {
    console.log(`🏷️ Syncing products for ${brand.name}...`);
    
    try {
      // Get products from Trackstar
      const trackstarProducts = await this.trackstarService.getAllProducts(
        brand.trackstarConnectionId,
        brand.trackstarAccessToken
      );
      
      console.log(`📦 Retrieved ${trackstarProducts.length} products from Trackstar`);
      
      if (trackstarProducts.length === 0) {
        console.log(`⚠️ No products found for ${brand.name}`);
        return;
      }
      
      // Process and store products
      await this.processAndStoreProducts(brand, trackstarProducts);
      
    } catch (error) {
      console.error(`❌ Failed to sync products for ${brand.name}:`, error.message);
      throw error;
    }
  }

  /**
   * Sync inventory levels from Trackstar
   */
  private async syncInventory(brand: any): Promise<void> {
    console.log(`📊 Syncing inventory for ${brand.name}...`);
    
    try {
      // Get inventory levels from Trackstar
      const inventoryData = await this.trackstarService.getInventoryLevels(
        brand.trackstarConnectionId,
        brand.trackstarAccessToken
      );
      
      console.log(`📊 Retrieved ${inventoryData.length} inventory records from Trackstar`);
      
      if (inventoryData.length === 0) {
        console.log(`⚠️ No inventory data found for ${brand.name} - may not be supported by this WMS`);
        return;
      }
      
      // Process and store inventory
      await this.processAndStoreInventory(brand, inventoryData);
      
    } catch (error) {
      console.error(`❌ Failed to sync inventory for ${brand.name}:`, error.message);
      // Don't throw - inventory may not be available for all WMS providers
    }
  }

  /**
   * Process and store products with comprehensive field mapping
   */
  private async processAndStoreProducts(brand: any, products: any[]): Promise<void> {
    console.log(`🏷️ Processing ${products.length} products for ${brand.name}...`);
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const trackstarProduct of products) {
      try {
        const trackstarProductId = trackstarProduct.id || trackstarProduct.product_id;
        const sku = trackstarProduct.sku || trackstarProduct.product_id || trackstarProduct.id;
        
        // Check if product already exists
        const existingProduct = await storage.getProductByTrackstarId(trackstarProductId);
        
        // Map Trackstar product to our schema with comprehensive field coverage
        const productData = {
          brandId: brand.id,
          sku: sku,
          name: trackstarProduct.name || trackstarProduct.title || trackstarProduct.description || sku,
          description: trackstarProduct.description || trackstarProduct.details || null,
          price: trackstarProduct.price || trackstarProduct.unit_price || null,
          weight: trackstarProduct.weight || null,
          dimensions: trackstarProduct.dimensions || null,
          
          // Trackstar-specific fields
          trackstarProductId: trackstarProductId,
          warehouseLocations: trackstarProduct.warehouse_locations || null,
          productDimensions: trackstarProduct.product_dimensions || trackstarProduct.dimensions || null,
          costPerUnit: trackstarProduct.cost_per_unit || trackstarProduct.cost || null,
          
          // Additional product metadata
          barcode: trackstarProduct.barcode || trackstarProduct.upc || trackstarProduct.gtin || null,
          hsCode: trackstarProduct.hs_code || trackstarProduct.harmonized_code || null,
          countryOfOrigin: trackstarProduct.country_of_origin || null,
          
          // Inventory from product data (if available)
          inventoryCount: this.extractInventoryCount(trackstarProduct),
          lowStockThreshold: trackstarProduct.low_stock_threshold || 10,
          
          lastSyncAt: new Date(),
        };

        if (existingProduct) {
          await storage.updateProduct(existingProduct.id, productData);
          updated++;
          console.log(`✅ Updated product: ${productData.sku}`);
        } else {
          await storage.createProduct(productData);
          created++;
          console.log(`✅ Created product: ${productData.sku}`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to process product:`, error.message);
        skipped++;
      }
    }
    
    console.log(`📊 Product processing summary for ${brand.name}: ${created} created, ${updated} updated, ${skipped} skipped`);
  }

  /**
   * Process and store inventory data
   */
  private async processAndStoreInventory(brand: any, inventoryData: any[]): Promise<void> {
    console.log(`📊 Processing ${inventoryData.length} inventory records for ${brand.name}...`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const inventoryItem of inventoryData) {
      try {
        const sku = inventoryItem.sku || inventoryItem.product_sku || inventoryItem.product_id;
        const warehouseId = inventoryItem.warehouse_id || inventoryItem.location_id;
        
        if (!sku) {
          skipped++;
          continue;
        }
        
        // Find the product by SKU
        const product = await storage.getProductBySku(brand.id, sku);
        if (!product) {
          console.log(`⚠️ Product not found for SKU: ${sku}`);
          skipped++;
          continue;
        }
        
        // Update product inventory count
        const inventoryCount = this.extractInventoryCount(inventoryItem);
        if (inventoryCount !== null) {
          await storage.updateProduct(product.id, { 
            inventoryCount: inventoryCount,
            lastSyncAt: new Date() 
          });
          updated++;
        }
        
        // Store warehouse-specific inventory if warehouse data available
        if (warehouseId) {
          await this.updateWarehouseInventory(product.id, warehouseId, inventoryItem);
        }
        
      } catch (error) {
        console.error(`❌ Failed to process inventory:`, error.message);
        skipped++;
      }
    }
    
    console.log(`📊 Inventory processing summary for ${brand.name}: ${updated} updated, ${skipped} skipped`);
  }

  /**
   * Extract inventory count from Trackstar data (tries multiple field names)
   */
  private extractInventoryCount(item: any): number | null {
    const possibleFields = [
      'inventory_count', 'inventory', 'stock', 'quantity', 'available_quantity',
      'on_hand', 'sellable', 'available', 'qty_available', 'total_quantity'
    ];
    
    for (const field of possibleFields) {
      if (item[field] !== undefined && item[field] !== null) {
        const count = parseInt(item[field]);
        if (!isNaN(count)) {
          return count;
        }
      }
    }
    
    return 0; // Default to 0 if no inventory data found
  }

  /**
   * Update warehouse-specific inventory
   */
  private async updateWarehouseInventory(productId: string, warehouseId: string, inventoryItem: any): Promise<void> {
    try {
      const warehouseInventoryData = {
        productId: productId,
        warehouseId: warehouseId,
        warehouseName: inventoryItem.warehouse_name || inventoryItem.location_name || 'Unknown',
        onHand: parseInt(inventoryItem.on_hand || inventoryItem.inventory || 0),
        allocated: parseInt(inventoryItem.allocated || 0),
        available: parseInt(inventoryItem.available || inventoryItem.sellable || 0),
        committed: parseInt(inventoryItem.committed || 0),
        reserved: parseInt(inventoryItem.reserved || 0),
        lastSyncAt: new Date(),
      };
      
      // This would need to be implemented in storage
      // await storage.upsertWarehouseInventory(warehouseInventoryData);
      
    } catch (error) {
      console.error(`❌ Failed to update warehouse inventory:`, error.message);
    }
  }

  /**
   * Setup webhooks for real-time inventory updates
   */
  private async setupWebhooks(brand: any): Promise<void> {
    try {
      const webhookUrl = `${process.env.REPLIT_DEV_DOMAIN || 'https://your-domain.replit.app'}/api/webhooks/trackstar`;
      
      await this.trackstarService.subscribeToWebhooks(
        brand.trackstarConnectionId,
        brand.trackstarAccessToken,
        webhookUrl
      );
      
      console.log(`✅ Webhooks configured for ${brand.name}`);
      
    } catch (error) {
      console.error(`❌ Failed to setup webhooks for ${brand.name}:`, error.message);
    }
  }

  /**
   * Clean slate - remove all products and start fresh
   */
  async cleanSlateProductSync(brandId: string): Promise<void> {
    console.log(`🧹 Starting clean slate product sync for brand ${brandId}...`);
    
    try {
      // Delete all existing products for this brand
      await storage.deleteAllProductsByBrand(brandId);
      console.log(`✅ Cleared all existing products for brand`);
      
      // Get brand and perform fresh sync
      const brand = await storage.getBrand(brandId);
      if (brand && brand.trackstarConnectionId && brand.trackstarAccessToken) {
        await this.syncBrandProductsAndInventory(brand);
        console.log(`✅ Clean slate sync completed for ${brand.name}`);
      } else {
        throw new Error('Brand not found or missing Trackstar credentials');
      }
      
    } catch (error) {
      console.error(`❌ Clean slate sync failed:`, error.message);
      throw error;
    }
  }
}

export const productInventorySync = new ProductInventorySync();