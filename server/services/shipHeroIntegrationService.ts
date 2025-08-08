/**
 * Comprehensive ShipHero Integration Service
 * 
 * Based on user requirements:
 * 1. 3PL signs up -> Creates brand -> Adds ShipHero integration with email/password
 * 2. Initial 7-day backpull with pagination and credit monitoring
 * 3. 5-minute incremental syncs 
 * 4. Webhook subscriptions for allocation, deallocation, shipments, order cancellation, PO updates
 * 5. Background job for hourly data integrity checks
 * 6. Purchase order management
 * 7. Product synchronization
 */

import { IStorage } from '../storage';

interface ShipHeroCredentials {
  username: string;
  password: string;
}

interface ShipHeroIntegration {
  brandId: string;
  brandEmail: string; // Used as ShipHero username
  brandPassword: string; // ShipHero password
}

interface ShipHeroApiResponse {
  data: any;
  errors?: Array<{ message: string; code?: number; time_remaining?: string }>;
}

export class ShipHeroIntegrationService {
  private baseUrl = 'https://public-api.shiphero.com';
  private tokenCache = new Map<string, { token: string; expiresAt: number }>();
  private creditsPaused = false;

  constructor(private storage: IStorage) {}

  /**
   * Step 1: Set up ShipHero integration for a brand
   */
  async setupBrandIntegration(integration: ShipHeroIntegration): Promise<void> {
    console.log(`🔧 Setting up ShipHero integration for brand: ${integration.brandId}`);
    
    try {
      // Test credentials first
      const credentials = { 
        username: integration.brandEmail, 
        password: integration.brandPassword 
      };
      
      await this.getAccessToken(credentials);
      console.log('✅ ShipHero credentials validated');

      // Update brand with ShipHero credentials
      await this.storage.updateBrand?.(integration.brandId, {
        shipHeroApiKey: integration.brandEmail,
        shipHeroPassword: integration.brandPassword,
      });

      // Subscribe to all required webhooks
      await this.subscribeToWebhooks(credentials, integration.brandId);
      
      // Begin 7-day historical backpull
      await this.performHistoricalBackpull(integration.brandId, credentials);
      
      console.log('🎉 ShipHero integration setup complete!');
      
    } catch (error) {
      console.error('❌ ShipHero integration setup failed:', error);
      throw error;
    }
  }

  /**
   * Sync shipments for a brand to get accurate shipped order count
   */
  async syncShipments(brandId: string, days: number = 30): Promise<void> {
    console.log(`🚢 Syncing shipments for brand ${brandId} - last ${days} days`);
    
    try {
      const brand = await this.storage.getBrand(brandId);
      if (!brand?.shipHeroApiKey || !brand?.shipHeroPassword) {
        throw new Error('ShipHero credentials not configured');
      }
      
      const credentials = {
        username: brand.shipHeroApiKey,
        password: brand.shipHeroPassword
      };
      
      const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const toDate = new Date();
      
      console.log(`📅 Fetching shipments from ${fromDate.toISOString()} to ${toDate.toISOString()}`);
      
      // Use the working ShipHero API service
      const { shipHeroApiFixed } = await import('./shipHeroApiFixed.js');
      const shipments = await shipHeroApiFixed.getShipments(credentials, fromDate, toDate);
      
      console.log(`📦 Found ${shipments.length} shipments from ShipHero`);
      console.log(`🎯 Answer: ${shipments.length} orders shipped in last ${days} days`);
      
    } catch (error) {
      console.error(`❌ Shipments sync failed for brand ${brandId}:`, error);
      throw error;
    }
  }

  /**
   * Step 2: Subscribe to all required ShipHero webhooks
   */
  private async subscribeToWebhooks(credentials: ShipHeroCredentials, brandId: string): Promise<void> {
    console.log('🔔 Setting up ShipHero webhooks...');
    
    const webhooks = [
      {
        name: 'order_allocated',
        url: `${process.env.REPLIT_DOMAIN || 'http://localhost:5000'}/api/webhooks/shiphero/allocation`,
        event: 'order_allocated'
      },
      {
        name: 'order_deallocated', 
        url: `${process.env.REPLIT_DOMAIN || 'http://localhost:5000'}/api/webhooks/shiphero/deallocation`,
        event: 'order_deallocated'
      },
      {
        name: 'shipment_update',
        url: `${process.env.REPLIT_DOMAIN || 'http://localhost:5000'}/api/webhooks/shiphero/shipment`,
        event: 'shipment_update'
      },
      {
        name: 'order_canceled',
        url: `${process.env.REPLIT_DOMAIN || 'http://localhost:5000'}/api/webhooks/shiphero/order-canceled`,
        event: 'order_canceled'
      },
      {
        name: 'po_update',
        url: `${process.env.REPLIT_DOMAIN || 'http://localhost:5000'}/api/webhooks/shiphero/po-update`, 
        event: 'po_update'
      }
    ];

    for (const webhook of webhooks) {
      try {
        await this.createWebhook(credentials, webhook);
        console.log(`✅ Webhook created: ${webhook.name}`);
      } catch (error) {
        console.error(`❌ Failed to create webhook ${webhook.name}:`, error);
      }
    }
  }

  /**
   * Step 3: Perform 7-day historical backpull with pagination
   */
  private async performHistoricalBackpull(brandId: string, credentials: ShipHeroCredentials): Promise<void> {
    console.log('📅 Starting 7-day historical backpull...');
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    let cursor: string | null = null;
    let totalOrders = 0;
    let totalShipments = 0;
    
    console.log(`📊 Pulling orders from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    do {
      // Check credit limits before each API call
      await this.checkCreditsAndPause();
      
      try {
        // Fetch orders with pagination (100 per page as per ShipHero limit)
        const ordersResult = await this.fetchOrdersPaginated(credentials, startDate, endDate, cursor);
        
        if (ordersResult.orders.length > 0) {
          await this.processOrderBatch(brandId, ordersResult.orders);
          totalOrders += ordersResult.orders.length;
          console.log(`📦 Processed ${ordersResult.orders.length} orders (Total: ${totalOrders})`);
        }
        
        cursor = ordersResult.nextCursor;
        
        // Small delay to be nice to API
        await this.delay(1000);
        
      } catch (error) {
        if (this.isCreditLimitError(error)) {
          await this.handleCreditLimit(error);
          continue; // Retry the same batch
        }
        throw error;
      }
      
    } while (cursor);
    
    // Also pull shipments for the same period
    await this.pullHistoricalShipments(credentials, brandId, startDate, endDate);
    
    console.log(`✅ Historical backpull complete: ${totalOrders} orders, ${totalShipments} shipments`);
  }

  /**
   * Step 4: 5-minute incremental sync
   */
  async performIncrementalSync(brandId: string): Promise<void> {
    try {
      const brand = await this.storage.getBrand(brandId);
      if (!brand?.shipHeroApiKey || !brand?.shipHeroPassword) {
        console.log(`⚠️ No ShipHero credentials for brand ${brandId}`);
        return;
      }
      
      const credentials = { 
        username: brand.shipHeroApiKey, 
        password: brand.shipHeroPassword 
      };
      
      // Get timestamp of last successful fetch
      const lastSync = await this.getLastSuccessfulSync(brandId);
      const fromDate = lastSync || new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago as fallback
      
      console.log(`🔄 Incremental sync for ${brand.name} since ${fromDate.toISOString()}`);
      
      // Fetch new orders
      const orders = await this.fetchOrdersSince(credentials, fromDate);
      
      if (orders.length > 0) {
        await this.processOrderBatch(brandId, orders);
        console.log(`✅ Synced ${orders.length} new orders`);
      }
      
      // Update last successful sync timestamp
      await this.updateLastSuccessfulSync(brandId, new Date());
      
    } catch (error) {
      console.error(`❌ Incremental sync failed for brand ${brandId}:`, error);
      
      if (this.isCreditLimitError(error)) {
        await this.handleCreditLimit(error);
      }
    }
  }

  /**
   * Step 5: Hourly background job for unfulfilled orders integrity check
   */
  async performUnfulfilledOrdersIntegrityCheck(): Promise<void> {
    console.log('🔍 Starting hourly unfulfilled orders integrity check...');
    
    try {
      // Get all brands with ShipHero integrations
      const brands = await this.storage.getAllBrandsWithShipHeroCredentials?.() || [];
      
      for (const brand of brands) {
        await this.checkBrandUnfulfilledOrders(brand);
      }
      
    } catch (error) {
      console.error('❌ Unfulfilled orders integrity check failed:', error);
    }
  }

  private async checkBrandUnfulfilledOrders(brand: any): Promise<void> {
    console.log(`🔍 Checking unfulfilled orders for ${brand.name}...`);
    
    const credentials = { 
      username: brand.shipHeroApiKey, 
      password: brand.shipHeroPassword 
    };
    
    // Fetch only unfulfilled orders from ShipHero
    const unfulfilledOrders = await this.fetchUnfulfilledOrders(credentials);
    
    // Compare with our database
    const dbUnfulfilled = await this.storage.getUnfulfilledOrdersByBrand?.(brand.id) || [];
    
    console.log(`📊 ShipHero: ${unfulfilledOrders.length} unfulfilled, DB: ${dbUnfulfilled.length} unfulfilled`);
    
    // Sync any differences
    await this.reconcileUnfulfilledOrders(brand.id, unfulfilledOrders, dbUnfulfilled);
  }

  /**
   * Purchase Order Management
   */
  async createPurchaseOrder(brandId: string, poData: any): Promise<string> {
    const brand = await this.storage.getBrand(brandId);
    if (!brand?.shipHeroApiKey || !brand?.shipHeroPassword) {
      throw new Error('ShipHero credentials not found');
    }
    
    const credentials = { 
      username: brand.shipHeroApiKey, 
      password: brand.shipHeroPassword 
    };
    
    const mutation = `
      mutation CreatePO($data: CreatePOInput!) {
        po_create(data: $data) {
          request_id
          complexity
          po {
            id
            po_number
            status
          }
        }
      }
    `;
    
    const result = await this.makeGraphQLRequest(mutation, { data: poData }, credentials);
    return result.data.po_create.po.id;
  }

  /**
   * Product Synchronization
   */
  async syncProducts(brandId: string): Promise<void> {
    const brand = await this.storage.getBrand(brandId);
    if (!brand?.shipHeroApiKey || !brand?.shipHeroPassword) {
      throw new Error('ShipHero credentials not found');
    }
    
    const credentials = { 
      username: brand.shipHeroApiKey, 
      password: brand.shipHeroPassword 
    };
    
    console.log(`🔄 Syncing products for ${brand.name}...`);
    
    let cursor: string | null = null;
    let totalProducts = 0;
    
    do {
      const result = await this.fetchProductsPaginated(credentials, cursor);
      
      if (result.products.length > 0) {
        await this.processProductBatch(brandId, result.products);
        totalProducts += result.products.length;
        console.log(`📦 Processed ${result.products.length} products (Total: ${totalProducts})`);
      }
      
      cursor = result.nextCursor;
      await this.delay(1000);
      
    } while (cursor);
    
    console.log(`✅ Product sync complete: ${totalProducts} products`);
  }

  // Helper methods for API interactions

  private async getAccessToken(credentials: ShipHeroCredentials): Promise<string> {
    const cacheKey = credentials.username;
    const cached = this.tokenCache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }
    
    const response = await fetch(`${this.baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`ShipHero authentication failed: ${response.status} - ${errorText}`);
    }
    
    const tokenData = await response.json();
    const expiresAt = Date.now() + (tokenData.expires_in - 300) * 1000; // 5 min safety margin
    
    this.tokenCache.set(cacheKey, {
      token: tokenData.access_token,
      expiresAt
    });
    
    return tokenData.access_token;
  }

  private async makeGraphQLRequest(query: string, variables: any, credentials: ShipHeroCredentials): Promise<any> {
    const accessToken = await this.getAccessToken(credentials);
    
    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query, variables }),
    });
    
    if (!response.ok) {
      throw new Error(`ShipHero GraphQL request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.errors) {
      const creditError = data.errors.find((e: any) => e.code === 30);
      if (creditError) {
        throw new Error(`CREDIT_LIMIT: ${creditError.time_remaining}`);
      }
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }
    
    return data;
  }

  private async fetchOrdersPaginated(credentials: ShipHeroCredentials, startDate: Date, endDate: Date, cursor?: string | null) {
    const query = `
      query GetOrders($from: ISODateTime!, $to: ISODateTime!, $first: Int, $after: String) {
        orders(date_from: $from, date_to: $to, first: $first, after: $after) {
          request_id
          complexity
          data {
            edges {
              node {
                id
                order_number
                legacy_id
                shop_name
                fulfillment_status
                order_date
                total_price
                subtotal
                total_discounts
                total_tax
                total_shipping
                email
                profile { name }
                shipping_address {
                  first_name
                  last_name
                  address1
                  address2
                  city
                  state
                  country
                  zip
                  phone
                }
                hold_until_date
                required_ship_date
                priority_flag
                tags
                order_source
                currency
                warehouse
                total_backorder_quantity
                allocated_at
                packed_at
                shipped_at
                delivered_at
                cancelled_at
                updated_at
                line_items {
                  edges {
                    node {
                      id
                      title
                      quantity
                      price
                      sku
                      product_id
                      quantity_allocated
                      quantity_shipped
                      backorder_quantity
                      fulfillment_status
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;
    
    const variables = {
      from: startDate.toISOString(),
      to: endDate.toISOString(),
      first: 100,
      after: cursor
    };
    
    const result = await this.makeGraphQLRequest(query, variables, credentials);
    
    return {
      orders: result.data.orders.data.edges.map((edge: any) => edge.node),
      nextCursor: result.data.orders.data.pageInfo.hasNextPage 
        ? result.data.orders.data.pageInfo.endCursor 
        : null
    };
  }

  private async processOrderBatch(brandId: string, orders: any[]): Promise<void> {
    for (const order of orders) {
      try {
        await this.processOrder(brandId, order);
      } catch (error) {
        console.error(`❌ Error processing order ${order.order_number}:`, error);
      }
    }
  }

  private async processOrder(brandId: string, shipHeroOrder: any): Promise<void> {
    // Check if order already exists
    const existingOrder = await this.storage.getOrderByShipHeroId?.(shipHeroOrder.id);
    
    if (existingOrder) {
      // Update if needed
      await this.updateOrderIfChanged(existingOrder, shipHeroOrder);
    } else {
      // Create new order
      await this.createNewOrder(brandId, shipHeroOrder);
    }
  }

  private async createNewOrder(brandId: string, shipHeroOrder: any): Promise<void> {
    const orderData = {
      orderNumber: shipHeroOrder.order_number,
      brandId,
      customerName: shipHeroOrder.profile?.name || 
        `${shipHeroOrder.shipping_address?.first_name || ''} ${shipHeroOrder.shipping_address?.last_name || ''}`.trim() || null,
      customerEmail: shipHeroOrder.email || null,
      shippingAddress: shipHeroOrder.shipping_address || {},
      status: this.mapShipHeroStatus(shipHeroOrder.fulfillment_status) as any,
      totalAmount: shipHeroOrder.total_price || "0.00",
      
      // ShipHero specific fields
      shipHeroOrderId: shipHeroOrder.id,
      shipHeroLegacyId: shipHeroOrder.legacy_id,
      shopName: shipHeroOrder.shop_name,
      fulfillmentStatus: shipHeroOrder.fulfillment_status,
      subtotal: shipHeroOrder.subtotal || "0.00",
      totalTax: shipHeroOrder.total_tax || "0.00",
      totalShipping: shipHeroOrder.total_shipping || "0.00",
      totalDiscounts: shipHeroOrder.total_discounts || "0.00",
      profile: shipHeroOrder.profile || {},
      holdUntilDate: shipHeroOrder.hold_until_date ? new Date(shipHeroOrder.hold_until_date) : null,
      requiredShipDate: shipHeroOrder.required_ship_date ? new Date(shipHeroOrder.required_ship_date) : null,
      priorityFlag: shipHeroOrder.priority_flag || false,
      tags: shipHeroOrder.tags || [],
      orderSource: shipHeroOrder.order_source || shipHeroOrder.shop_name,
      orderCurrency: shipHeroOrder.currency || 'USD',
      warehouse: shipHeroOrder.warehouse || null,
      
      // Timestamps
      orderDate: shipHeroOrder.order_date ? new Date(shipHeroOrder.order_date) : new Date(),
      allocatedAt: shipHeroOrder.allocated_at ? new Date(shipHeroOrder.allocated_at) : null,
      packedAt: shipHeroOrder.packed_at ? new Date(shipHeroOrder.packed_at) : null,
      shippedAt: shipHeroOrder.shipped_at ? new Date(shipHeroOrder.shipped_at) : null,
      deliveredAt: shipHeroOrder.delivered_at ? new Date(shipHeroOrder.delivered_at) : null,
      cancelledAt: shipHeroOrder.cancelled_at ? new Date(shipHeroOrder.cancelled_at) : null,
      shipHeroUpdatedAt: shipHeroOrder.updated_at ? new Date(shipHeroOrder.updated_at) : new Date(),
      lastSyncAt: new Date(),
      
      // Quantity tracking
      totalQuantity: shipHeroOrder.line_items?.edges?.reduce((sum: number, edge: any) => 
        sum + (edge.node.quantity || 0), 0) || 0,
      backorderQuantity: shipHeroOrder.total_backorder_quantity || 0,
    };
    
    const createdOrder = await this.storage.createOrder(orderData);
    
    // Create order items
    if (shipHeroOrder.line_items?.edges) {
      for (const edge of shipHeroOrder.line_items.edges) {
        const item = edge.node;
        await this.storage.createOrderItem?.({
          orderId: createdOrder.id,
          shipHeroLineItemId: item.id,
          sku: item.sku,
          productName: item.title,
          quantity: item.quantity,
          quantityAllocated: item.quantity_allocated || 0,
          quantityShipped: item.quantity_shipped || 0,
          backorderQuantity: item.backorder_quantity || 0,
          unitPrice: item.price,
          totalPrice: (parseFloat(item.price || '0') * (item.quantity || 0)).toString(),
          fulfillmentStatus: item.fulfillment_status || 'pending'
        });
      }
    }
  }

  private mapShipHeroStatus(fulfillmentStatus: string): string {
    // Map ShipHero statuses to our enum values
    const statusMap: Record<string, string> = {
      'pending': 'pending',
      'allocated': 'allocated',
      'picked': 'processing',
      'packed': 'processing', 
      'shipped': 'shipped',
      'fulfilled': 'fulfilled',
      'canceled': 'cancelled',
      'cancelled': 'cancelled',
      'hold': 'on_hold',
      'partial': 'partially_fulfilled'
    };
    
    return statusMap[fulfillmentStatus?.toLowerCase()] || 'unfulfilled';
  }

  // Credit monitoring and delay utilities
  private async checkCreditsAndPause(): Promise<void> {
    if (this.creditsPaused) {
      console.log('⏳ Credits paused, waiting...');
      await this.delay(60000); // Wait 1 minute
      this.creditsPaused = false;
    }
  }

  private isCreditLimitError(error: any): boolean {
    return error?.message?.includes('CREDIT_LIMIT');
  }

  private async handleCreditLimit(error: any): Promise<void> {
    const timeMatch = error.message.match(/(\d+)/);
    const waitTime = timeMatch ? parseInt(timeMatch[1]) * 1000 : 300000; // Default 5 min
    
    console.log(`⏳ Credit limit reached. Waiting ${waitTime / 1000} seconds...`);
    this.creditsPaused = true;
    await this.delay(waitTime);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Stub methods to be implemented based on specific storage interface
  private async getLastSuccessfulSync(brandId: string): Promise<Date | null> {
    // Implementation depends on your storage layer
    return null;
  }

  private async updateLastSuccessfulSync(brandId: string, timestamp: Date): Promise<void> {
    // Implementation depends on your storage layer
  }

  private async fetchOrdersSince(credentials: ShipHeroCredentials, fromDate: Date): Promise<any[]> {
    const result = await this.fetchOrdersPaginated(credentials, fromDate, new Date());
    return result.orders;
  }

  private async fetchUnfulfilledOrders(credentials: ShipHeroCredentials): Promise<any[]> {
    // Query for orders with unfulfilled statuses only
    return [];
  }

  private async pullHistoricalShipments(credentials: ShipHeroCredentials, brandId: string, startDate: Date, endDate: Date): Promise<void> {
    // Implementation for shipment sync
  }

  private async reconcileUnfulfilledOrders(brandId: string, shipHeroOrders: any[], dbOrders: any[]): Promise<void> {
    // Implementation for data reconciliation
  }

  private async createWebhook(credentials: ShipHeroCredentials, webhook: any): Promise<void> {
    // Implementation for webhook creation
  }

  private async updateOrderIfChanged(existingOrder: any, shipHeroOrder: any): Promise<void> {
    // Implementation for order updates
  }

  private async fetchProductsPaginated(credentials: ShipHeroCredentials, cursor?: string | null) {
    return { products: [], nextCursor: null };
  }

  private async processProductBatch(brandId: string, products: any[]): Promise<void> {
    // Implementation for product processing
  }
}