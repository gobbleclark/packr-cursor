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
    const dateFilter = fromDate ? fromDate.toISOString().split('T')[0] : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    console.log(`🔍 Fetching ShipHero orders from ${dateFilter} with credentials ${credentials.username}`);
    
    const query = `
      query getOrders($orderDateFrom: String, $orderDateTo: String) {
        orders(order_date_from: $orderDateFrom, order_date_to: $orderDateTo) {
          request_id
          complexity
          data(first: 20) {
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
                shipping_address {
                  first_name
                  last_name
                  city
                  state
                  zip
                }
                line_items(first: 5) {
                  edges {
                    node {
                      id
                      sku
                      quantity
                      product_name
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
        orderDateFrom: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],  // Just yesterday
        orderDateTo: new Date().toISOString().split('T')[0]
      }, credentials);
      console.log(`✅ ShipHero orders API response received, complexity: ${data.orders?.complexity || 'N/A'}`);
      
      if (!data.orders?.data?.edges) {
        console.log(`⚠️ No orders data structure found in response`);
        return [];
      }

      return data.orders.data.edges.map((edge: any) => ({
        ...edge.node,
        line_items: edge.node.line_items?.edges?.map((item: any) => item.node) || [],
        shipments: edge.node.shipments || [],
      }));
      
    } catch (error) {
      console.error(`❌ ShipHero orders API failed:`, error);
      throw error;
    }
  }

  async getProducts(credentials: ShipHeroCredentials): Promise<ShipHeroProduct[]> {
    console.log(`🔍 Fetching ShipHero products with credentials ${credentials.username}`);
    const query = `
      query getProducts {
        products {
          request_id
          complexity
          data(first: 200) {
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
      const data = await this.makeGraphQLRequest(query, {}, credentials);
      console.log(`✅ ShipHero products API response received, complexity: ${data.products?.complexity || 'N/A'}`);
      
      if (!data.products?.data?.edges) {
        console.log(`⚠️ No products data structure found in response`);
        return [];
      }

      return data.products.data.edges.map((edge: any) => ({
        ...edge.node,
        warehouse_products: edge.node.warehouse_products || [],
      }));
      
    } catch (error) {
      console.error(`❌ ShipHero products API failed:`, error);
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