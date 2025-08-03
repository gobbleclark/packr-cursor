import { db } from '../db';
import { products, brands } from '../../shared/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

interface ShipHeroCredentials {
  username: string;
  password: string;
}

/**
 * Script to identify and remove kit/digital products from the database
 * that were previously imported from ShipHero before filtering was implemented
 */
class ProductCleanupService {
  private async getAccessToken(credentials: ShipHeroCredentials): Promise<string> {
    const response = await fetch('https://public-api.shiphero.com/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password,
      }),
    });

    if (!response.ok) {
      throw new Error(`ShipHero authentication failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  private async makeGraphQLRequest(query: string, variables: any, credentials: ShipHeroCredentials) {
    const accessToken = await this.getAccessToken(credentials);
    
    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`ShipHero GraphQL request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error(`❌ ShipHero GraphQL errors:`, data.errors);
      throw new Error(`ShipHero GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return data.data;
  }

  private async checkProductType(shipHeroProductId: string, credentials: ShipHeroCredentials): Promise<{
    kit: boolean;
    virtual: boolean;
    dropship: boolean;
    sku: string;
    name: string;
  }> {
    const query = `
      query getProduct($productId: String!) {
        product(id: $productId) {
          request_id
          complexity
          data {
            id
            sku
            name
            kit
            virtual
            dropship
          }
        }
      }
    `;

    try {
      const data = await this.makeGraphQLRequest(query, { productId: shipHeroProductId }, credentials);
      
      if (!data.product?.data) {
        console.log(`⚠️ Product ${shipHeroProductId} not found in ShipHero`);
        return { kit: false, virtual: false, dropship: false, sku: '', name: '' };
      }

      const product = data.product.data;
      return {
        kit: product.kit || false,
        virtual: product.virtual || false,
        dropship: product.dropship || false,
        sku: product.sku,
        name: product.name
      };
    } catch (error) {
      console.error(`❌ Failed to check product ${shipHeroProductId}:`, error);
      return { kit: false, virtual: false, dropship: false, sku: '', name: '' };
    }
  }

  async cleanupExistingProducts(brandId: string, credentials: ShipHeroCredentials): Promise<void> {
    console.log(`🧹 Starting cleanup of kit/digital products for brand ${brandId}`);

    // Get all products for this brand that have ShipHero IDs
    const existingProducts = await db
      .select()
      .from(products)
      .where(and(
        eq(products.brandId, brandId),
        isNotNull(products.shipHeroProductId)
      ));

    console.log(`📊 Found ${existingProducts.length} products to check`);

    let removedCount = 0;
    let checkedCount = 0;

    for (const product of existingProducts) {
      try {
        checkedCount++;
        console.log(`🔍 Checking product ${checkedCount}/${existingProducts.length}: ${product.sku} - ${product.name}`);

        if (!product.shipHeroProductId) {
          continue;
        }

        const productInfo = await this.checkProductType(product.shipHeroProductId, credentials);

        if (productInfo.kit || productInfo.virtual || productInfo.dropship) {
          console.log(`🚫 Removing ${productInfo.kit ? 'kit' : productInfo.virtual ? 'digital' : 'dropship'} product: ${product.sku} - ${product.name}`);
          
          await db
            .delete(products)
            .where(eq(products.id, product.id));
          
          removedCount++;
        } else {
          console.log(`✅ Keeping physical product: ${product.sku} - ${product.name}`);
        }

        // Add a small delay to respect API limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error processing product ${product.sku}:`, error);
      }
    }

    console.log(`✅ Cleanup completed: Removed ${removedCount} kit/digital products out of ${checkedCount} checked`);
  }
}

export { ProductCleanupService };