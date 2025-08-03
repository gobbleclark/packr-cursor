/**
 * ShipHero API Integration Service - Fixed Implementation  
 * Uses modern ShipHero GraphQL API with proper Bearer token authentication
 * https://public-api.shiphero.com/graphql
 */

interface ShipHeroCredentials {
  username: string;
  password: string;
}

interface ShipHeroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface ShipHeroOrder {
  id: string;
  order_number: string;
  shop_name: string;
  fulfillment_status: string;
  order_date: string;
  total_price: string;
  subtotal: string;
  total_discounts: string;
  total_tax: string;
  email: string;
  profile: {
    name: string;
  };
  shipping_address: {
    first_name: string;
    last_name: string;
    address1: string;
    address2: string;
    city: string;
    state: string;
    country: string;
    zip: string;
    phone: string;
  };
  line_items: Array<{
    id: string;
    title: string;
    quantity: number;
    price: string;
    sku: string;
    product_id: string;
  }>;
  shipments: Array<{
    id: string;
    carrier: string;
    method: string;
    tracking_number: string;
    tracking_url: string;
    status: string;
  }>;
}

interface ShipHeroProduct {
  id: string;
  name: string;
  sku: string;
  price: string;
  value: string;
  barcode: string;
  country_of_origin: string;
  customs_description: string;
  weight: string;
  height: string;
  width: string;
  length: string;
  kit: boolean;
  kit_build: boolean;
  no_air: boolean;
  final_sale: boolean;
  customs_value: string;
  customs_description_2: string;
  not_owned: boolean;
  dropship: boolean;
  needs_serial_number: boolean;
  thumbnail: string;
  large_thumbnail: string;
  created_at: string;
  updated_at: string;
  product_note: string;
  sync_inventories: boolean;
  tags: string;
  total_on_hand: number;
  total_committed: number;
  total_available: number;
  total_allocated: number;
  total_backordered: number;
  warehouse_products: Array<{
    id: string;
    warehouse_id: string;
    on_hand: number;
    allocated: number;
    available: number;
    committed: number;
    backordered: number;
    pending: number;
    sellable: number;
    non_sellable: number;
    received: number;
  }>;
}

export class ShipHeroApiService {
  private baseUrl = 'https://public-api.shiphero.com';
  private tokenCache: Map<string, { token: string; expiresAt: number }> = new Map();

  /**
   * Get access token using username/password authentication
   * Caches tokens to avoid repeated auth requests
   */
  private async getAccessToken(credentials: ShipHeroCredentials): Promise<string> {
    const cacheKey = credentials.username;
    const cached = this.tokenCache.get(cacheKey);
    
    // Check if we have a valid cached token
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    console.log(`🔐 Requesting new ShipHero access token for ${credentials.username}`);

    // Request new access token
    const response = await fetch(`${this.baseUrl}/auth/token`, {
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
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`ShipHero authentication failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const tokenData: ShipHeroTokenResponse = await response.json();
    console.log(`✅ ShipHero token obtained for ${credentials.username}, expires in ${tokenData.expires_in} seconds`);

    // Cache the token (expire 5 minutes before actual expiry for safety)
    const expiresAt = Date.now() + (tokenData.expires_in - 300) * 1000;
    this.tokenCache.set(cacheKey, {
      token: tokenData.access_token,
      expiresAt
    });

    return tokenData.access_token;
  }

  /**
   * Make GraphQL request using Bearer token authentication
   */
  private async makeGraphQLRequest(query: string, variables: any, credentials: ShipHeroCredentials) {
    const accessToken = await this.getAccessToken(credentials);
    
    const response = await fetch(`${this.baseUrl}/graphql`, {
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

  async getOrders(credentials: ShipHeroCredentials, fromDate?: Date): Promise<ShipHeroOrder[]> {
    const fromDateTime = fromDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDateTime = new Date();
    console.log(`🔍 Fetching ShipHero orders from ${fromDateTime.toISOString()} to ${toDateTime.toISOString()} with credentials ${credentials.username}`);
    
    let allOrders: any[] = [];
    let cursor: string | null = null;
    let pageCount = 0;

    do {
      pageCount++;
      console.log(`📄 Fetching orders page ${pageCount}${cursor ? ` (cursor: ${cursor})` : ''}...`);

      const query = `
        query getOrders($orderDateFrom: ISODateTime, $orderDateTo: ISODateTime, $after: String) {
          orders(order_date_from: $orderDateFrom, order_date_to: $orderDateTo) {
            request_id
            complexity
            data(first: 100, after: $after) {
              pageInfo {
                hasNextPage
                endCursor
              }
              edges {
                node {
                  id
                  legacy_id
                  order_number
                  shop_name
                  fulfillment_status
                  order_date
                  total_price
                  email
                  profile
                  hold_until_date
                  required_ship_date
                  priority_flag
                  tags
                  updated_at
                  shipping_address {
                    first_name
                    last_name
                    address1
                    address2
                    city
                    state
                    zip
                    country
                    phone
                  }
                  line_items(first: 10) {
                    edges {
                      node {
                        id
                        sku
                        quantity
                        quantity_allocated
                        quantity_shipped
                        backorder_quantity
                        product_name
                        price
                        fulfillment_status
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      try {
        const data = await this.makeGraphQLRequest(query, { 
          orderDateFrom: fromDateTime.toISOString(),
          orderDateTo: toDateTime.toISOString(),
          after: cursor
        }, credentials);
        console.log(`✅ ShipHero orders API page ${pageCount} response received, complexity: ${data.orders?.complexity || 'N/A'}`);
        
        if (!data.orders?.data?.edges) {
          console.log(`⚠️ No orders data structure found in page ${pageCount} response`);
          break;
        }

        const pageOrders = data.orders.data.edges.map((edge: any) => ({
          ...edge.node,
          line_items: edge.node.line_items?.edges?.map((item: any) => ({
            ...item.node,
            // Calculate total backorder quantity for the order
            backorder_quantity: item.node.backorder_quantity || 0
          })) || [],
          // Calculate total backorder quantity for the entire order
          total_backorder_quantity: edge.node.line_items?.edges?.reduce((total: number, item: any) => {
            return total + (item.node.backorder_quantity || 0);
          }, 0) || 0,
          shipments: edge.node.shipments || [],
        }));

        allOrders.push(...pageOrders);
        console.log(`📦 Orders page ${pageCount}: Found ${pageOrders.length} orders (Total so far: ${allOrders.length})`);

        // Check if there are more pages
        const hasNextPage = data.orders.data.pageInfo?.hasNextPage;
        cursor = hasNextPage ? data.orders.data.pageInfo?.endCursor : null;
        
        if (!hasNextPage) {
          console.log(`✅ All order pages fetched. Total orders: ${allOrders.length}`);
          break;
        }
        
      } catch (error) {
        console.error(`❌ ShipHero orders API failed on page ${pageCount}:`, error);
        throw error;
      }
    } while (cursor && pageCount < 20); // Safety limit

    console.log(`📊 SHIPHERO ORDERS ANALYSIS:`);
    console.log(`   - Total orders fetched: ${allOrders.length}`);
    console.log(`   - Pages fetched: ${pageCount}`);
    console.log(`   - Date range: ${fromDateTime.toISOString()} to ${toDateTime.toISOString()}`);
    
    return allOrders;
  }

  async getProducts(credentials: ShipHeroCredentials): Promise<ShipHeroProduct[]> {
    console.log(`🔍 Fetching ALL ShipHero products with pagination for ${credentials.username}`);
    
    let allProducts: any[] = [];
    let cursor: string | null = null;
    let pageCount = 0;
    
    do {
      pageCount++;
      console.log(`📄 Fetching page ${pageCount}${cursor ? ` (cursor: ${cursor.substring(0, 20)}...)` : ' (first page)'}`);
      
      const query = `
        query getProducts($cursor: String) {
          products {
            request_id
            complexity
            data(first: 200, after: $cursor) {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              node {
                id
                legacy_id
                account_id
                name
                sku
                price
                value
                barcode
                country_of_manufacture
                dimensions {
                  height
                  width
                  length
                  weight
                }
                tariff_code
                kit
                kit_build
                no_air
                final_sale
                customs_value
                customs_description
                not_owned
                dropship
                needs_serial_number
                thumbnail
                large_thumbnail
                created_at
                updated_at
                product_note
                virtual
                ignore_on_invoice
                ignore_on_customs
                active
                warehouse_products {
                  warehouse_id
                  on_hand
                  inventory_bin
                  inventory_overstock_bin
                  reserve_inventory
                  replenishment_level
                  reorder_amount
                  reorder_level
                  custom
                }
                images {
                  src
                  position
                }
                tags
                kit_components {
                  sku
                  quantity
                }
              }
            }
          }
        }
      }
    `;

      try {
        const data = await this.makeGraphQLRequest(query, { cursor }, credentials);
        console.log(`✅ Page ${pageCount} received, complexity: ${data.products?.complexity || 'N/A'}`);
        
        if (!data.products?.data?.edges) {
          console.log(`⚠️ No products data structure found in page ${pageCount}`);
          break;
        }
        
        // Add products from this page with calculated inventory totals and warehouse details
        const pageProducts = data.products.data.edges.map((edge: any) => {
          const node = edge.node;
          
          // Calculate total available inventory across all warehouses
          const total_available = (node.warehouse_products || []).reduce((total: number, warehouse: any) => {
            return total + (parseInt(warehouse.on_hand) || 0);
          }, 0);
          
          // Calculate total committed/reserved across all warehouses  
          const total_committed = (node.warehouse_products || []).reduce((total: number, warehouse: any) => {
            return total + (parseInt(warehouse.reserve_inventory) || 0);
          }, 0);
          
          // Debug warehouse details for this product
          if ((node.warehouse_products || []).length > 0) {
            console.log(`📦 ${node.sku} warehouse breakdown:`);
            (node.warehouse_products || []).forEach((wh: any) => {
              console.log(`   - Warehouse ${wh.warehouse_id}: ${wh.on_hand || 0} on hand, ${wh.reserve_inventory || 0} reserved`);
            });
          }
          
          return {
            ...node,
            warehouse_products: node.warehouse_products || [],
            images: node.images || [],
            tags: node.tags || [],
            kit_components: node.kit_components || [],
            // Add calculated fields that realApiSync.ts expects
            total_available,
            total_committed,
            // Map dimension fields for compatibility
            weight: node.dimensions?.weight || '0',
            length: node.dimensions?.length || '0',
            width: node.dimensions?.width || '0', 
            height: node.dimensions?.height || '0',
            country_of_origin: node.country_of_manufacture || '',
            customs_description_2: node.tariff_code || '',
          };
        });
        
        allProducts.push(...pageProducts);
        console.log(`📦 Page ${pageCount}: Found ${pageProducts.length} products (Total so far: ${allProducts.length})`);
        
        // Check if there are more pages
        const hasNextPage = data.products.data.pageInfo?.hasNextPage;
        cursor = hasNextPage ? data.products.data.pageInfo?.endCursor : null;
        
        if (!hasNextPage) {
          console.log(`✅ All pages fetched. Total products: ${allProducts.length}`);
          break;
        }
        
      } catch (error) {
        console.error(`❌ ShipHero products API failed on page ${pageCount}:`, error);
        throw error;
      }
    } while (cursor && pageCount < 10); // Safety limit
    
    // Now filter all collected products
    console.log(`🔍 Filtering ${allProducts.length} total products from ${pageCount} pages...`);
    try {

      // Filter out kits, digital products, and dropship items for Packr inventory
      const filteredProducts = allProducts
        .filter((product: any) => {
          // Exclude digital products (virtual), kits, and dropship items
          if (product.virtual) {
            console.log(`🚫 Excluding digital product: ${product.sku} - ${product.name}`);
            return false;
          }
          if (product.kit) {
            console.log(`🚫 Excluding kit product: ${product.sku} - ${product.name}`);
            return false;
          }
          if (product.dropship) {
            console.log(`🚫 Excluding dropship product: ${product.sku} - ${product.name}`);
            return false;
          }
          
          // Additional name-based filtering for services/digital products
          const name = product.name.toLowerCase();
          if (name.includes('shipping protection') || 
              name.includes('recura') ||
              name.includes('protection plan') ||
              name.includes('gift card') ||
              name.includes('covered returns')) {
            console.log(`🚫 Excluding service/digital product by name: ${product.sku} - ${product.name}`);
            return false;
          }
          
          // Exclude zero-price service items (but allow boxes/packaging)
          if ((product.price === '0' || product.price === 0 || product.price === '0.00') && 
              (name.includes('protection') || name.includes('service') || name.includes('insurance'))) {
            console.log(`🚫 Excluding zero-price service item: ${product.sku} - ${product.name}`);
            return false;
          }
          
          // Debug: Log all products that pass filtering to see what's actually coming from ShipHero
          console.log(`✅ ACCEPTING physical product: ${product.sku} - ${product.name} (Price: ${product.price}, Inventory: ${product.total_available})`);
          console.log(`📋 Product details: Virtual=${product.virtual}, Kit=${product.kit}, Dropship=${product.dropship}, Warehouses: ${product.warehouse_products?.length || 0}`);
          
          return true;
        });

      console.log(`📊 SHIPHERO API ANALYSIS (ALL PAGES):`);
      console.log(`   - Total products across all pages: ${allProducts.length}`);
      console.log(`   - Pages fetched: ${pageCount}`);
      console.log(`   - Filtered physical products: ${filteredProducts.length}`);
      
      // Log the actual non-filtered products to see what Mabē has
      if (filteredProducts.length > 0) {
        console.log(`📦 ACTUAL PHYSICAL PRODUCTS IN SHIPHERO:`);
        filteredProducts.forEach((product: any) => {
          console.log(`   - ${product.sku}: ${product.name} ($${product.price})`);
        });
      } else {
        console.log(`⚠️ NO PHYSICAL PRODUCTS FOUND - only service/digital items exist in this ShipHero account`);
        console.log(`💡 This suggests the Mabē account is set up for shipping services rather than physical merchandise`);
      }
      
      return filteredProducts;
      
    } catch (error) {
      console.error(`❌ ShipHero products filtering failed:`, error);
      throw error;
    }
  }

  async getInventory(credentials: ShipHeroCredentials): Promise<any[]> {
    const query = `
      query getInventory {
        products {
          request_id
          complexity
          data(first: 200) {
            edges {
              node {
                id
                sku
                name
                warehouse_products {
                  warehouse_id
                  on_hand
                  inventory_bin
                  inventory_overstock_bin
                  reserve_inventory
                  replenishment_level
                  reorder_amount
                  reorder_level
                  custom
                }
              }
            }
          }
        }
      }
    `;

    try {
      const data = await this.makeGraphQLRequest(query, {}, credentials);
      console.log(`✅ ShipHero inventory API response received, complexity: ${data.products?.complexity || 'N/A'}`);
      
      if (!data.products?.data?.edges) {
        console.log(`⚠️ No inventory data structure found in response`);
        return [];
      }

      return data.products.data.edges.map((edge: any) => ({
        ...edge.node,
        warehouse_products: edge.node.warehouse_products || [],
      }));

    } catch (error) {
      console.error(`❌ ShipHero inventory API failed:`, error);
      throw error;
    }
  }

  async syncWarehouseInventory(credentials: ShipHeroCredentials, storage: any): Promise<void> {
    console.log(`🏭 Starting warehouse inventory sync for ${credentials.username}`);
    
    try {
      // Get all products for this brand
      const brandId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'; // Mabē brand ID - in production get from credentials
      const products = await storage.getProductsByBrand(brandId);
      console.log(`📦 Found ${products.length} products to sync warehouse inventory for`);

      let syncedCount = 0;
      
      // Get fresh inventory data from ShipHero
      const inventoryData = await this.getInventory(credentials);
      console.log(`📊 Received inventory data for ${inventoryData.length} products from ShipHero`);

      for (const product of products) {
        try {
          // Find matching inventory data by SKU
          const inventoryMatch = inventoryData.find(inv => inv.sku === product.sku);
          
          if (inventoryMatch && inventoryMatch.warehouse_products) {
            console.log(`🔄 Syncing warehouse inventory for product ${product.sku} (${inventoryMatch.warehouse_products.length} warehouses)`);
            
            // Sync each warehouse's inventory for this product
            for (const warehouse of inventoryMatch.warehouse_products) {
              await storage.upsertProductWarehouse({
                productId: product.id,
                warehouseId: warehouse.warehouse_id,
                warehouseName: this.getWarehouseName(warehouse.warehouse_id),
                onHand: warehouse.on_hand || 0,
                allocated: warehouse.reserve_inventory || 0,
                available: (warehouse.on_hand || 0) - (warehouse.reserve_inventory || 0),
                committed: warehouse.reserve_inventory || 0,
                reserved: warehouse.reserve_inventory || 0,
                backordered: 0,
                pending: 0,
                sellable: warehouse.on_hand || 0,
                nonSellable: 0,
                inventoryBin: warehouse.inventory_bin || '',
                overstockBin: warehouse.inventory_overstock_bin || '',
                reorderLevel: warehouse.reorder_level || 0,
                reorderAmount: warehouse.reorder_amount || 0,
                replenishmentLevel: warehouse.replenishment_level || 0,
                lastSyncAt: new Date(),
              });
            }
            
            syncedCount++;
            console.log(`✅ Synced warehouse inventory for ${product.sku} (${syncedCount}/${products.length})`);
          } else {
            console.log(`⚠️  No warehouse inventory found for product ${product.sku}`);
          }
        } catch (error) {
          console.error(`❌ Failed to sync warehouse inventory for product ${product.sku}:`, error);
        }
      }

      console.log(`🎉 Warehouse inventory sync complete! Synced ${syncedCount}/${products.length} products`);
      
    } catch (error) {
      console.error(`❌ Warehouse inventory sync failed:`, error);
      throw error;
    }
  }

  private getWarehouseName(warehouseId: string): string {
    const warehouseNames: { [key: string]: string } = {
      'WH001': 'Main Warehouse',
      'WH002': 'Secondary Warehouse', 
      'WH003': 'Overflow Warehouse',
      // Add more warehouse mappings as needed
    };
    return warehouseNames[warehouseId] || `Warehouse ${warehouseId}`;
  }

  async testConnection(credentials: ShipHeroCredentials): Promise<boolean> {
    try {
      console.log(`🔍 Testing ShipHero connection for user: ${credentials.username}`);
      const query = `
        query testConnection {
          orders {
            request_id
            complexity
            data(first: 1) {
              edges {
                node {
                  id
                  order_number
                }
              }
            }
          }
        }
      `;
      
      const result = await this.makeGraphQLRequest(query, {}, credentials);
      console.log(`✅ ShipHero connection successful - Got ${result.orders?.data?.edges?.length || 0} orders`);
      return true;
    } catch (error) {
      console.error(`❌ ShipHero connection test failed:`, error);
      return false;
    }
  }
}

// Export a singleton instance
export const shipHeroApi = new ShipHeroApiService();
export const shipHeroApiFixed = new ShipHeroApiService();