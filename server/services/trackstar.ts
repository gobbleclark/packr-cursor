export class TrackstarService {
  private baseUrl = 'https://production.trackstarhq.com';
  private apiKey = process.env.TRACKSTAR_API_KEY || ''; // Your personal Trackstar API key

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
      const inventory = await this.getInventory(accessToken, connectionId);
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
      const orders = await this.getOrders(accessToken, connectionId);
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