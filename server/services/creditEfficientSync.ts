/**
 * Credit-Efficient ShipHero Sync Service
 * Implements intelligent querying strategies to work within API credit limits
 * Ensures continuous data availability even when credits are exhausted
 */

import { shipHeroApi } from './shipHeroApiFixed';
import { storage } from '../storage';
import type { ShipHeroCredentials } from './shipHeroApiFixed';

interface SyncStrategy {
  name: string;
  priority: number;
  creditCost: number;
  query: string;
  variables: any;
  description: string;
}

interface SyncSession {
  brandId: string;
  availableCredits: number;
  completedStrategies: string[];
  failedStrategies: string[];
  dataCollected: {
    orders: number;
    products: number;
    shipments: number;
  };
}

export class CreditEfficientSyncService {
  private syncSessions: Map<string, SyncSession> = new Map();
  
  /**
   * Define sync strategies in order of priority and credit efficiency
   */
  private getSyncStrategies(): SyncStrategy[] {
    return [
      {
        name: 'critical_orders_today',
        priority: 1,
        creditCost: 150,
        query: `
          query getCriticalOrders {
            orders(order_date_from: "$TODAY") {
              request_id
              complexity
              data(first: 10) {
                edges {
                  node {
                    id
                    order_number
                    fulfillment_status
                    order_date
                    total_price
                    email
                  }
                }
              }
            }
          }
        `,
        variables: {},
        description: 'Today\'s critical orders only'
      },
      {
        name: 'recent_orders_minimal',
        priority: 2,
        creditCost: 300,
        query: `
          query getRecentOrdersMinimal($dateFrom: String) {
            orders(order_date_from: $dateFrom) {
              request_id
              complexity
              data(first: 25) {
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
                  }
                }
              }
            }
          }
        `,
        variables: { dateFrom: '2025-08-02' },
        description: 'Recent orders with minimal fields'
      },
      {
        name: 'product_inventory_summary',
        priority: 3,
        creditCost: 400,
        query: `
          query getProductsSummary {
            products {
              request_id
              complexity
              data(first: 50) {
                edges {
                  node {
                    id
                    sku
                    name
                    warehouse_products {
                      warehouse_id
                      on_hand
                    }
                  }
                }
              }
            }
          }
        `,
        variables: {},
        description: 'Product inventory summary'
      },
      {
        name: 'orders_with_line_items',
        priority: 4,
        creditCost: 800,
        query: `
          query getOrdersWithItems($dateFrom: String) {
            orders(order_date_from: $dateFrom) {
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
        `,
        variables: { dateFrom: '2025-08-01' },
        description: 'Orders with basic line items'
      },
      {
        name: 'full_product_details',
        priority: 5,
        creditCost: 1200,
        query: `
          query getFullProducts {
            products {
              request_id
              complexity
              data(first: 30) {
                edges {
                  node {
                    id
                    legacy_id
                    name
                    sku
                    price
                    value
                    barcode
                    dimensions {
                      height
                      width
                      length
                      weight
                    }
                    warehouse_products {
                      warehouse_id
                      on_hand
                      inventory_bin
                      reserve_inventory
                    }
                  }
                }
              }
            }
          }
        `,
        variables: {},
        description: 'Complete product information'
      }
    ];
  }

  /**
   * Execute credit-aware sync for a brand
   */
  async syncBrandWithCreditManagement(brandId: string, credentials: ShipHeroCredentials): Promise<{
    success: boolean;
    strategiesCompleted: string[];
    dataCollected: any;
    creditsUsed: number;
    nextSyncRecommendation: string;
  }> {
    console.log(`🎯 Starting credit-efficient sync for brand ${brandId}`);
    
    // Initialize or get existing sync session
    let session = this.syncSessions.get(brandId) || {
      brandId,
      availableCredits: 2000, // Conservative estimate
      completedStrategies: [],
      failedStrategies: [],
      dataCollected: { orders: 0, products: 0, shipments: 0 }
    };

    const strategies = this.getSyncStrategies();
    let totalCreditsUsed = 0;
    const results: any = {};

    // Execute strategies in priority order until credits are exhausted
    for (const strategy of strategies) {
      if (session.completedStrategies.includes(strategy.name)) {
        console.log(`⏭️ Skipping already completed strategy: ${strategy.name}`);
        continue;
      }

      if (strategy.creditCost > (session.availableCredits - totalCreditsUsed)) {
        console.log(`💳 Insufficient credits for ${strategy.name} (needs ${strategy.creditCost}, have ${session.availableCredits - totalCreditsUsed})`);
        break;
      }

      try {
        console.log(`🔄 Executing strategy: ${strategy.name} (${strategy.description})`);
        
        // Prepare query with current date variables
        const query = strategy.query.replace('$TODAY', new Date().toISOString().split('T')[0]);
        const variables = this.prepareVariables(strategy.variables);
        
        const data = await this.executeStrategyQuery(query, variables, credentials);
        
        if (data) {
          // Process and store the data
          await this.processStrategyData(strategy.name, data, brandId);
          
          session.completedStrategies.push(strategy.name);
          totalCreditsUsed += strategy.creditCost;
          results[strategy.name] = {
            success: true,
            creditsUsed: strategy.creditCost,
            dataPoints: this.countDataPoints(data)
          };
          
          console.log(`✅ Strategy ${strategy.name} completed - Credits used: ${strategy.creditCost}`);
        }
        
      } catch (error) {
        console.error(`❌ Strategy ${strategy.name} failed:`, error);
        session.failedStrategies.push(strategy.name);
        results[strategy.name] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        
        // If we hit a credit limit error, stop trying more expensive strategies
        if (error instanceof Error && error.message.includes('not enough credits')) {
          console.log(`🛑 Credit limit reached, stopping further sync attempts`);
          break;
        }
      }
    }

    // Update session
    session.availableCredits -= totalCreditsUsed;
    this.syncSessions.set(brandId, session);

    // Determine next sync recommendation
    const nextSyncRecommendation = this.calculateNextSyncStrategy(session, strategies);

    return {
      success: session.completedStrategies.length > 0,
      strategiesCompleted: session.completedStrategies,
      dataCollected: session.dataCollected,
      creditsUsed: totalCreditsUsed,
      nextSyncRecommendation
    };
  }

  /**
   * Execute a GraphQL query with error handling
   */
  private async executeStrategyQuery(query: string, variables: any, credentials: ShipHeroCredentials): Promise<any> {
    try {
      // Use the existing shipHeroApi service
      const response = await fetch('https://public-api.shiphero.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAccessToken(credentials)}`,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
      }

      return data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get access token (reuse from main service)
   */
  private async getAccessToken(credentials: ShipHeroCredentials): Promise<string> {
    // This would ideally reuse the token from shipHeroApi service
    // For now, we'll implement a simple version
    const response = await fetch('https://public-api.shiphero.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password,
      }),
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const tokenData = await response.json();
    return tokenData.access_token;
  }

  /**
   * Process and store data from a completed strategy
   */
  private async processStrategyData(strategyName: string, data: any, brandId: string): Promise<void> {
    try {
      if (data.orders?.data?.edges) {
        const orders = data.orders.data.edges.map((edge: any) => ({
          ...edge.node,
          line_items: edge.node.line_items?.edges?.map((item: any) => item.node) || [],
        }));
        
        for (const order of orders) {
          await storage.upsertOrder({
            id: order.id,
            brandId: brandId,
            orderNumber: order.order_number,
            shopName: order.shop_name || 'ShipHero',
            fulfillmentStatus: order.fulfillment_status || 'pending',
            orderDate: new Date(order.order_date),
            totalPrice: parseFloat(order.total_price || '0'),
            customerEmail: order.email,
            shippingAddress: order.shipping_address ? JSON.stringify(order.shipping_address) : null,
            lineItems: order.line_items ? JSON.stringify(order.line_items) : null,
            shipments: order.shipments ? JSON.stringify(order.shipments) : null,
          });
        }
        
        console.log(`📦 Processed ${orders.length} orders from strategy ${strategyName}`);
      }

      if (data.products?.data?.edges) {
        const products = data.products.data.edges.map((edge: any) => edge.node);
        
        for (const product of products) {
          await storage.upsertProduct({
            id: product.id,
            brandId: brandId,
            sku: product.sku,
            name: product.name,
            price: parseFloat(product.price || '0'),
            inventory: product.warehouse_products?.[0]?.on_hand || 0,
            warehouseProducts: product.warehouse_products ? JSON.stringify(product.warehouse_products) : null,
          });
        }
        
        console.log(`📦 Processed ${products.length} products from strategy ${strategyName}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to process data from strategy ${strategyName}:`, error);
    }
  }

  /**
   * Prepare variables for query execution
   */
  private prepareVariables(variables: any): any {
    const prepared = { ...variables };
    
    // Replace date placeholders with actual dates
    for (const [key, value] of Object.entries(prepared)) {
      if (typeof value === 'string') {
        if (value.includes('$TODAY')) {
          prepared[key] = new Date().toISOString().split('T')[0];
        } else if (value.includes('$YESTERDAY')) {
          prepared[key] = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        } else if (value.includes('$WEEK_AGO')) {
          prepared[key] = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }
      }
    }
    
    return prepared;
  }

  /**
   * Count data points returned from a query
   */
  private countDataPoints(data: any): number {
    let count = 0;
    if (data.orders?.data?.edges) count += data.orders.data.edges.length;
    if (data.products?.data?.edges) count += data.products.data.edges.length;
    if (data.shipments?.data?.edges) count += data.shipments.data.edges.length;
    return count;
  }

  /**
   * Calculate the best next sync strategy based on current state
   */
  private calculateNextSyncStrategy(session: SyncSession, strategies: SyncStrategy[]): string {
    const remainingStrategies = strategies.filter(s => 
      !session.completedStrategies.includes(s.name) && 
      !session.failedStrategies.includes(s.name)
    );

    if (remainingStrategies.length === 0) {
      return 'All strategies completed. Wait for credit refresh or upgrade account.';
    }

    const affordableStrategies = remainingStrategies.filter(s => s.creditCost <= session.availableCredits);
    
    if (affordableStrategies.length === 0) {
      const nextStrategy = remainingStrategies[0];
      const hoursToWait = Math.ceil((nextStrategy.creditCost - session.availableCredits) / 30); // 30 credits per hour
      return `Wait ${hoursToWait} hours for credit refresh, then run '${nextStrategy.name}'`;
    }

    return `Next recommended strategy: '${affordableStrategies[0].name}' (${affordableStrategies[0].description})`;
  }

  /**
   * Get sync session status for a brand
   */
  getSyncStatus(brandId: string): SyncSession | null {
    return this.syncSessions.get(brandId) || null;
  }

  /**
   * Reset sync session for a brand (useful for testing or manual resets)
   */
  resetSyncSession(brandId: string): void {
    this.syncSessions.delete(brandId);
    console.log(`🔄 Reset sync session for brand ${brandId}`);
  }
}

// Export singleton instance
export const creditEfficientSync = new CreditEfficientSyncService();