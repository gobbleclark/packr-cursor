/**
 * ShipHero Webhook Management Service
 * Handles subscription and management of ShipHero webhooks for real-time data updates
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

export class ShipHeroWebhookService {
  private baseUrl = 'https://public-api.shiphero.com';
  private tokenCache: Map<string, { token: string; expiresAt: number }> = new Map();

  /**
   * Get access token using username/password authentication
   * Caches tokens to avoid repeated auth requests
   */
  private async getAccessToken(credentials: ShipHeroCredentials): Promise<string> {
    const cacheKey = credentials.username;
    const cached = this.tokenCache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) { // 5 min buffer
      return cached.token;
    }

    console.log(`🔐 Requesting new ShipHero access token for ${credentials.username}`);
    
    const response = await fetch(`${this.baseUrl}/auth`, {
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
      const errorText = await response.text();
      console.error(`❌ ShipHero auth failed: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`ShipHero authentication failed: ${response.status}`);
    }

    const data: ShipHeroTokenResponse = await response.json();
    console.log(`✅ ShipHero token obtained for ${credentials.username}, expires in ${data.expires_in} seconds`);
    
    this.tokenCache.set(cacheKey, {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000) - 60000, // 1 min buffer
    });

    return data.access_token;
  }

  /**
   * Make GraphQL request to ShipHero API
   */
  private async makeGraphQLRequest(query: string, variables: any, credentials: ShipHeroCredentials): Promise<any> {
    const token = await this.getAccessToken(credentials);
    
    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ShipHero GraphQL request failed: ${response.status}`, errorText);
      throw new Error(`ShipHero API request failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.errors && data.errors.length > 0) {
      console.error('❌ ShipHero GraphQL errors:', data.errors);
      throw new Error(`ShipHero GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return data.data;
  }

  /**
   * Subscribe to ShipHero allocation webhook
   */
  async subscribeToAllocationWebhook(credentials: ShipHeroCredentials, webhookUrl: string): Promise<any> {
    console.log(`🔗 Subscribing to ShipHero allocation webhook: ${webhookUrl}`);
    
    const mutation = `
      mutation createWebhook($data: WebhookCreateInput!) {
        webhook_create(data: $data) {
          request_id
          complexity
          webhook {
            id
            name
            url
            resource_type
            webhook_events
            active
            created_at
          }
        }
      }
    `;

    const variables = {
      data: {
        name: "Order Allocation Webhook",
        url: webhookUrl,
        resource_type: "order",
        webhook_events: ["allocation", "order.allocated", "order.status_changed"],
        active: true
      }
    };

    try {
      const result = await this.makeGraphQLRequest(mutation, variables, credentials);
      console.log('✅ Allocation webhook created:', result.webhook_create?.webhook);
      return result.webhook_create?.webhook;
    } catch (error) {
      console.error('❌ Failed to create allocation webhook:', error);
      throw error;
    }
  }

  /**
   * Subscribe to general order status webhook
   */
  async subscribeToOrderWebhook(credentials: ShipHeroCredentials, webhookUrl: string): Promise<any> {
    console.log(`🔗 Subscribing to ShipHero order webhook: ${webhookUrl}`);
    
    const mutation = `
      mutation createWebhook($data: WebhookCreateInput!) {
        webhook_create(data: $data) {
          request_id
          complexity
          webhook {
            id
            name
            url
            resource_type
            webhook_events
            active
            created_at
          }
        }
      }
    `;

    const variables = {
      data: {
        name: "Order Status Webhook",
        url: webhookUrl,
        resource_type: "order",
        webhook_events: ["order.created", "order.updated", "order.shipped", "order.fulfilled", "order.cancelled"],
        active: true
      }
    };

    try {
      const result = await this.makeGraphQLRequest(mutation, variables, credentials);
      console.log('✅ Order webhook created:', result.webhook_create?.webhook);
      return result.webhook_create?.webhook;
    } catch (error) {
      console.error('❌ Failed to create order webhook:', error);
      throw error;
    }
  }

  /**
   * List existing webhooks
   */
  async listWebhooks(credentials: ShipHeroCredentials): Promise<any[]> {
    console.log('📋 Fetching existing ShipHero webhooks');
    
    const query = `
      query getWebhooks {
        webhooks {
          request_id
          complexity
          data {
            edges {
              node {
                id
                name
                url
                resource_type
                webhook_events
                active
                created_at
              }
            }
          }
        }
      }
    `;

    try {
      const result = await this.makeGraphQLRequest(query, {}, credentials);
      const webhooks = result.webhooks?.data?.edges?.map((edge: any) => edge.node) || [];
      console.log(`📋 Found ${webhooks.length} existing webhooks`);
      return webhooks;
    } catch (error) {
      console.error('❌ Failed to list webhooks:', error);
      throw error;
    }
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(credentials: ShipHeroCredentials, webhookId: string): Promise<boolean> {
    console.log(`🗑️ Deleting ShipHero webhook: ${webhookId}`);
    
    const mutation = `
      mutation deleteWebhook($id: String!) {
        webhook_delete(data: { id: $id }) {
          request_id
          complexity
          ok
        }
      }
    `;

    try {
      const result = await this.makeGraphQLRequest(mutation, { id: webhookId }, credentials);
      console.log('✅ Webhook deleted successfully');
      return result.webhook_delete?.ok || false;
    } catch (error) {
      console.error('❌ Failed to delete webhook:', error);
      throw error;
    }
  }

  /**
   * Setup all required webhooks for a brand
   */
  async setupWebhooksForBrand(credentials: ShipHeroCredentials, baseUrl: string): Promise<void> {
    console.log(`🔄 Setting up ShipHero webhooks for ${credentials.username}`);
    
    try {
      // List existing webhooks first
      const existingWebhooks = await this.listWebhooks(credentials);
      
      // Check if allocation webhook already exists
      const allocationWebhookUrl = `${baseUrl}/api/webhooks/shiphero/allocation`;
      const existingAllocationWebhook = existingWebhooks.find(w => 
        w.url === allocationWebhookUrl || w.webhook_events?.includes('allocation')
      );
      
      if (!existingAllocationWebhook) {
        await this.subscribeToAllocationWebhook(credentials, allocationWebhookUrl);
      } else {
        console.log('✅ Allocation webhook already exists');
      }
      
      // Check if order webhook already exists
      const orderWebhookUrl = `${baseUrl}/api/webhooks/shiphero/order`;
      const existingOrderWebhook = existingWebhooks.find(w => 
        w.url === orderWebhookUrl || w.webhook_events?.includes('order.updated')
      );
      
      if (!existingOrderWebhook) {
        await this.subscribeToOrderWebhook(credentials, orderWebhookUrl);
      } else {
        console.log('✅ Order webhook already exists');
      }
      
      console.log('🎉 Webhook setup completed successfully');
      
    } catch (error) {
      console.error('❌ Webhook setup failed:', error);
      throw error;
    }
  }
}

export const shipHeroWebhookService = new ShipHeroWebhookService();