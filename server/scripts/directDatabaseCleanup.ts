import { db } from '../db';
import { products } from '../../shared/schema';
import { eq, and, or, ilike } from 'drizzle-orm';

/**
 * Direct database cleanup script to remove digital products and kits
 * based on product name patterns and characteristics
 */
export class DirectDatabaseCleanup {
  
  async cleanupDigitalAndKitProducts(brandId: string): Promise<{
    deletedCount: number;
    deletedProducts: Array<{ sku: string; name: string; reason: string }>;
  }> {
    console.log(`🧹 Starting direct database cleanup for brand ${brandId}`);

    // Get all products for this brand
    const allProducts = await db
      .select()
      .from(products)
      .where(eq(products.brandId, brandId));

    console.log(`📊 Found ${allProducts.length} products to analyze`);

    const productsToDelete: Array<{ id: string; sku: string; name: string; reason: string }> = [];

    // Analyze each product to determine if it should be deleted
    for (const product of allProducts) {
      const name = product.name.toLowerCase();
      let shouldDelete = false;
      let reason = '';

      // Check for shipping protection services (these are digital services)
      if (name.includes('shipping protection') || 
          name.includes('recura') ||
          name.includes('protection plan')) {
        shouldDelete = true;
        reason = 'Digital shipping protection service';
      }
      
      // Check for zero-price items (often digital/service items)
      else if ((product.price === '0' || product.price === '0.00') && 
               (name.includes('protection') || name.includes('service'))) {
        shouldDelete = true;
        reason = 'Zero-price service item';
      }

      // Check for typical kit indicators
      else if (name.includes('kit ') || 
               name.includes(' kit') ||
               name.includes('bundle') ||
               name.includes('combo') ||
               name.includes('set of ')) {
        shouldDelete = true;
        reason = 'Kit/bundle product';
      }

      // Check for digital product indicators
      else if (name.includes('digital') ||
               name.includes('download') ||
               name.includes('e-book') ||
               name.includes('software') ||
               name.includes('license') ||
               name.includes('subscription')) {
        shouldDelete = true;
        reason = 'Digital product';
      }

      if (shouldDelete) {
        productsToDelete.push({
          id: product.id,
          sku: product.sku,
          name: product.name,
          reason
        });
      }
    }

    console.log(`🚫 Identified ${productsToDelete.length} products for deletion`);

    // Delete the identified products
    let deletedCount = 0;
    const deletedProducts: Array<{ sku: string; name: string; reason: string }> = [];

    for (const product of productsToDelete) {
      try {
        await db
          .delete(products)
          .where(eq(products.id, product.id));
        
        deletedCount++;
        deletedProducts.push({
          sku: product.sku,
          name: product.name,
          reason: product.reason
        });
        
        console.log(`✅ Deleted: ${product.sku} - ${product.name} (${product.reason})`);
      } catch (error) {
        console.error(`❌ Failed to delete product ${product.sku}:`, error);
      }
    }

    console.log(`✅ Database cleanup completed: Deleted ${deletedCount} digital/kit products`);

    return {
      deletedCount,
      deletedProducts
    };
  }
}