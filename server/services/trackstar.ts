export class TrackstarService {
  private baseUrl = 'https://production.trackstarhq.com';

  constructor(private apiKey?: string) {}

  /**
   * Get a link token for connecting a brand to Trackstar
   */
  async getLinkToken(): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Trackstar API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/link/token`, {
      method: 'POST',
      headers: {
        'x-trackstar-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get link token: ${response.statusText}`);
    }

    const data = await response.json();
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
    if (!this.apiKey) {
      throw new Error('Trackstar API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/link/exchange`, {
      method: 'POST',
      headers: {
        'x-trackstar-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ auth_code: authCode }),
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange auth code: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get inventory data for a specific connection
   */
  async getInventory(accessToken: string, connectionId: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/inventory`, {
      headers: {
        'x-trackstar-api-key': this.apiKey!,
        'x-trackstar-access-token': accessToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get inventory: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get orders data for a specific connection
   */
  async getOrders(accessToken: string, connectionId: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/orders`, {
      headers: {
        'x-trackstar-api-key': this.apiKey!,
        'x-trackstar-access-token': accessToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get orders: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get products data for a specific connection
   */
  async getProducts(accessToken: string, connectionId: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/products`, {
      headers: {
        'x-trackstar-api-key': this.apiKey!,
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
        'x-trackstar-api-key': this.apiKey!,
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