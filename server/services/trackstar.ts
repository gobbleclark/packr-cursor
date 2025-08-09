export class TrackstarService {
  private baseUrl = 'https://production.trackstarhq.com';
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TRACKSTAR_API_KEY || '';
  }

  /**
   * Get a link token for connecting a brand to Trackstar
   */
  async getLinkToken(): Promise<string> {
    console.log(`🔗 Getting Trackstar link token with API key: ${this.apiKey.substring(0, 8)}...`);

    const response = await fetch(`${this.baseUrl}/link/token`, {
      method: 'POST',
      headers: {
        'x-trackstar-api-key': this.apiKey,
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`📡 Trackstar link token response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Trackstar link token error: ${errorText}`);
      throw new Error(`Failed to get link token: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ Trackstar link token received: ${data.link_token?.substring(0, 8)}...`);
    return data.link_token;
  }

  /**
   * Exchange auth code for access token
   */
  async exchangeAuthCode(authCode: string): Promise<{
    access_token: string;
    connection_id: string;
    integration_name: string;
    available_endpoints: string[];
  }> {
    console.log(`🔄 Exchanging Trackstar auth code: ${authCode.substring(0, 8)}...`);

    const response = await fetch(`${this.baseUrl}/link/exchange`, {
      method: 'POST',
      headers: {
        'x-trackstar-api-key': this.apiKey,
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ auth_code: authCode }),
    });

    console.log(`📡 Trackstar exchange response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Trackstar exchange error: ${errorText}`);
      throw new Error(`Failed to exchange auth code: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ Trackstar connection established: ${data.connection_id}`);
    return data;
  }

  /**
   * Get inventory data using brand's access token
   */
  async getInventoryWithToken(connectionId: string, accessToken: string): Promise<any[]> {
    console.log(`📊 Getting inventory from connection ${connectionId}...`);

    const response = await fetch(`${this.baseUrl}/wms/inventory`, {
      method: 'GET',
      headers: {
        'x-trackstar-api-key': this.apiKey,
        'x-trackstar-access-token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Trackstar inventory error: ${errorText}`);
      throw new Error(`Failed to get inventory: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ Retrieved ${data.length || 0} inventory items from connection ${connectionId}`);
    return data;
  }

  /**
   * Get warehouses using brand's access token
   */
  async getWarehousesWithToken(connectionId: string, accessToken: string): Promise<any[]> {
    console.log(`🏭 Getting warehouses from connection ${connectionId}...`);

    const response = await fetch(`${this.baseUrl}/wms/warehouses`, {
      method: 'GET',
      headers: {
        'x-trackstar-api-key': this.apiKey,
        'x-trackstar-access-token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Trackstar warehouses error: ${errorText}`);
      throw new Error(`Failed to get warehouses: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ Retrieved ${data.length || 0} warehouses from connection ${connectionId}`);
    return data;
  }

  /**
   * Get returns using brand's access token
   */
  async getReturnsWithToken(connectionId: string, accessToken: string): Promise<any[]> {
    console.log(`↩️ Getting returns from connection ${connectionId}...`);

    const response = await fetch(`${this.baseUrl}/wms/returns`, {
      method: 'GET',
      headers: {
        'x-trackstar-api-key': this.apiKey,
        'x-trackstar-access-token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Trackstar returns error: ${errorText}`);
      throw new Error(`Failed to get returns: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ Retrieved ${data.length || 0} returns from connection ${connectionId}`);
    return data;
  }

  /**
   * Trigger manual sync for a connection
   */
  async triggerSync(connectionId: string, dataType?: string): Promise<void> {
    console.log(`🔄 Triggering manual sync for connection ${connectionId}, data type: ${dataType || 'all'}`);

    const body: any = { connection_id: connectionId };
    if (dataType) {
      body.data_type = dataType;
    }

    const response = await fetch(`${this.baseUrl}/mgmt/sync-connection`, {
      method: 'POST',
      headers: {
        'x-trackstar-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Trackstar manual sync error: ${errorText}`);
      throw new Error(`Failed to trigger sync: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log(`✅ Manual sync triggered for connection ${connectionId}`);
  }

  /**
   * Get orders using brand's access token (basic version - no filtering supported by Trackstar API)
   */
  async getOrdersWithToken(connectionId: string, accessToken: string): Promise<any[]> {
    const url = `${this.baseUrl}/wms/orders`;
    
    console.log(`📦 Getting orders from connection ${connectionId}...`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-trackstar-api-key': this.apiKey,
        'x-trackstar-access-token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to fetch orders: ${response.status} ${errorText}`);
      throw new Error(`Failed to fetch orders: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log(`📊 Trackstar response: found ${data.data?.length || 0} orders`);
    return data.data || data.orders || data || [];
  }

  /**
   * Get ALL orders using pagination to fetch beyond 1000 limit
   */
  async getAllOrdersWithToken(connectionId: string, accessToken: string): Promise<any[]> {
    console.log(`📦 Getting ALL orders from connection ${connectionId} using pagination...`);
    
    let allOrders = [];
    let offset = 0;
    const limit = 1000;
    
    while (true) {
      const orders = await this.getOrdersWithToken(connectionId, accessToken, limit, offset);
      
      if (orders.length === 0) {
        console.log(`✅ No more orders found. Total retrieved: ${allOrders.length}`);
        break;
      }
      
      allOrders.push(...orders);
      console.log(`📊 Retrieved batch: ${orders.length} orders, Total so far: ${allOrders.length}`);
      
      // If we got less than the limit, we've reached the end
      if (orders.length < limit) {
        console.log(`✅ Reached end of orders. Final total: ${allOrders.length}`);
        break;
      }
      
      offset += limit;
    }
    
    return allOrders;
  }

  /**
   * Get products using brand's access token
   */
  async getProductsWithToken(connectionId: string, accessToken: string): Promise<any[]> {
    console.log(`🏷️ Getting products from connection ${connectionId}...`);
    
    const response = await fetch(`${this.baseUrl}/wms/products`, {
      method: 'GET',
      headers: {
        'x-trackstar-api-key': this.apiKey,
        'x-trackstar-access-token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to fetch products: ${response.status} ${errorText}`);
      throw new Error(`Failed to fetch products: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log(`📊 Trackstar response: found ${data.data?.length || 0} products`);
    return data.data || data.products || data || [];
  }

  /**
   * Get all connections from your Trackstar account
   */
  async getConnections(): Promise<any[]> {
    console.log(`📋 Getting all connections from Trackstar account...`);
    
    const response = await fetch(`${this.baseUrl}/connections`, {
      headers: {
        'x-trackstar-api-key': this.apiKey,
      },
    });

    console.log(`📡 Trackstar connections response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to get connections: ${errorText}`);
      throw new Error(`Failed to get connections: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ Found ${data.length || 0} connections in Trackstar account`);
    return data;
  }

  /**
   * Get inventory data for a specific connection
   */
  async getInventory(connectionId: string): Promise<any[]> {
    console.log(`📦 Getting inventory for connection: ${connectionId}`);
    
    const response = await fetch(`${this.baseUrl}/inventory?connection_id=${connectionId}`, {
      headers: {
        'x-trackstar-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to get inventory: ${errorText}`);
      throw new Error(`Failed to get inventory: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get orders data for a specific connection
   */
  async getOrders(connectionId: string): Promise<any[]> {
    console.log(`📋 Getting orders for connection: ${connectionId}`);
    
    const response = await fetch(`${this.baseUrl}/orders?connection_id=${connectionId}`, {
      headers: {
        'x-trackstar-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to get orders: ${errorText}`);
      throw new Error(`Failed to get orders: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get products data for a specific connection
   */
  async getProducts(accessToken: string, connectionId: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/products`, {
      headers: {
        'x-trackstar-api-key': this.apiKey,
        'x-trackstar-access-token': accessToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get products: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get shipments data for a specific connection
   */
  async getShipments(accessToken: string, connectionId: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/shipments`, {
      headers: {
        'x-trackstar-api-key': this.apiKey,
        'x-trackstar-access-token': accessToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get shipments: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Sync inventory data for a brand
   */
  async syncInventoryForBrand(accessToken: string, connectionId: string): Promise<{
    synced: number;
    errors: string[];
  }> {
    try {
      const inventory = await this.getInventoryWithToken(connectionId, accessToken);
      console.log(`Synced ${inventory.length} inventory items for connection ${connectionId}`);
      
      return {
        synced: inventory.length,
        errors: [],
      };
    } catch (error) {
      console.error('Error syncing Trackstar inventory:', error);
      return {
        synced: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Sync orders data for a brand
   */
  async syncOrdersForBrand(accessToken: string, connectionId: string): Promise<{
    synced: number;
    errors: string[];
  }> {
    try {
      const orders = await this.getOrdersWithToken(connectionId, accessToken);
      console.log(`Synced ${orders.length} orders for connection ${connectionId}`);
      
      return {
        synced: orders.length,
        errors: [],
      };
    } catch (error) {
      console.error('Error syncing Trackstar orders:', error);
      return {
        synced: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }
}