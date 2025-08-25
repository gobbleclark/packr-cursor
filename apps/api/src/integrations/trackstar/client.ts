import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';

// Rate limiting: 10 requests per second per access token (from Trackstar API docs)
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW = 1000; // 1 second in milliseconds

// Trackstar API Types
export interface TrackstarLinkTokenResponse {
  link_token: string;
  expires_at: string;
}

export interface TrackstarExchangeRequest {
  auth_code: string;
  integration_name?: string; // Make optional since not all exchanges require it
}

export interface TrackstarExchangeResponse {
  access_token: string;
  connection_id: string;
  integration_name: string;
  available_actions: string[];
}

export interface TrackstarListResponse<T> {
  data: T[];
  next_token?: string | null;
  total_count?: number;
}

export interface TrackstarFilters {
  limit?: number;
  page_token?: string;
  [key: string]: any;
}

// Rate limiter class for each access token
class RateLimiter {
  private requests: number[] = [];
  private readonly limit: number;
  private readonly window: number;

  constructor(limit: number, window: number) {
    this.limit = limit;
    this.window = window;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.window);
    
    // If we're at the limit, wait until we can make another request
    if (this.requests.length >= this.limit) {
      const oldestRequest = this.requests[0];
      const waitTime = this.window - (now - oldestRequest);
      if (waitTime > 0) {
        logger.info(`Rate limit reached, waiting ${waitTime}ms for next request slot`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Add current request
    this.requests.push(now);
  }
}

export class TrackstarClient {
  private axiosInstance: AxiosInstance;
  private rateLimiters: Map<string, RateLimiter> = new Map();

  constructor() {
    // Hardcoded values as per previous fixes
    const apiKey = 'f9bc96aa7e0145b899b713d83a61ad3d';
    const baseURL = 'https://production.trackstarhq.com';
    
    this.axiosInstance = axios.create({
      baseURL,
      headers: {
        'x-trackstar-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor to handle rate limit headers
    this.axiosInstance.interceptors.response.use(
      (response) => {
        // Log rate limit info if available
        const rateLimitRemaining = response.headers['x-rate-limit-remaining'];
        const rateLimitReset = response.headers['x-rate-limit-reset'];
        
        if (rateLimitRemaining !== undefined) {
          logger.debug(`Rate limit remaining: ${rateLimitRemaining}, reset at: ${rateLimitReset}`);
        }
        
        return response;
      },
      (error) => {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['x-rate-limit-retry-after'];
          logger.warn(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get or create rate limiter for an access token
   */
  private getRateLimiter(accessToken: string): RateLimiter {
    if (!this.rateLimiters.has(accessToken)) {
      this.rateLimiters.set(accessToken, new RateLimiter(RATE_LIMIT, RATE_LIMIT_WINDOW));
    }
    return this.rateLimiters.get(accessToken)!;
  }

  /**
   * Fetch all pages of data with proper pagination and rate limiting
   */
  private async fetchAllPages<T>(
    accessToken: string,
    endpoint: string,
    filters: TrackstarFilters = {},
    maxPages: number = 200 // Increased to handle more orders (200 pages * 1000 orders = 200,000 max)
  ): Promise<T[]> {
    const rateLimiter = this.getRateLimiter(accessToken);
    const allData: T[] = [];
    let pageToken: string | undefined = undefined;
    let pageCount = 0;
    let finished = false;

    while (pageCount < maxPages && !finished) {
      // Wait for rate limit slot
      await rateLimiter.waitForSlot();

      let attempt = 0;
      while (attempt < 3) {
        try {
          const params = { 
            ...filters,
            limit: 1000 // Use Trackstar's default of 1000 records per page
          };
          if (pageToken) {
            params.page_token = pageToken;
          }

          logger.info(`Fetching page ${pageCount + 1} from ${endpoint}`, { 
            pageToken, 
            pageCount, 
            expectedRecords: 1000,
            totalSoFar: allData.length,
            attempt: attempt + 1
          });

          const response = await this.axiosInstance.get<TrackstarListResponse<T>>(endpoint, {
            headers: {
              'x-trackstar-access-token': accessToken
            },
            params
          });

          const { data, next_token } = response.data;
          
          if (data && Array.isArray(data)) {
            allData.push(...data);
            logger.info(`Received ${data.length} records from page ${pageCount + 1} (expected up to 1000)`);
          }

          // Check if there are more pages
          if (!next_token) {
            logger.info(`No more pages available, total records: ${allData.length}`);
            finished = true;
          } else {
            pageToken = next_token;
            pageCount++;
          }

          // Small delay between pages to be respectful (reduced since we're getting more data per page)
          await new Promise(resolve => setTimeout(resolve, 50));
          break; // success, exit retry loop

        } catch (error: any) {
          attempt++;
          logger.warn(`Attempt ${attempt} failed to fetch page ${pageCount + 1} from ${endpoint}`, {
            error: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            pageToken,
            pageCount,
            totalSoFar: allData.length
          });

          if (attempt >= 3) {
            logger.error(`Failed to fetch page ${pageCount + 1} after ${attempt} attempts`);
            throw error;
          }

          // Exponential backoff between retries
          const backoffMs = attempt * 500;
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    logger.info(`Completed fetching ${pageCount} pages, total records: ${allData.length}`);
    return allData;
  }

  /**
   * Create a Trackstar Link token for WMS connection
   * This is the first step in the integration process
   * According to Trackstar docs: /link/token only needs API key, no request body
   */
  async createLinkToken(request?: { customer_id?: string; integration_name?: string }): Promise<TrackstarLinkTokenResponse> {
    try {
      logger.info('Creating Trackstar link token', { request });
      
      // Log the request details
      logger.info('Making Trackstar API request:', {
        method: 'POST',
        url: `${this.axiosInstance.defaults.baseURL}/link/token`,
        headers: {
          'x-trackstar-api-key': 'f9bc96aa...',
          'Content-Type': 'application/json'
        },
        body: request
      });
      
      const response = await this.axiosInstance.post<TrackstarLinkTokenResponse>('/link/token', request || {});
      
      logger.info('Successfully created Trackstar link token');
      return response.data;
    } catch (error: any) {
      logger.error('Failed to create Trackstar link token:', error);
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        logger.error('Trackstar API response error:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        // The request was made but no response was received
        logger.error('Trackstar API request error - no response received:', error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        logger.error('Trackstar API setup error:', error.message);
      }
      
      throw error;
    }
  }

  /**
   * Exchange auth code for access token
   * This is the second step after user completes WMS connection
   */
  async exchangeAuthCode(request: TrackstarExchangeRequest): Promise<TrackstarExchangeResponse> {
    try {
      logger.info('Exchanging auth code for access token');
      
      const response = await this.axiosInstance.post<TrackstarExchangeResponse>('/link/exchange', request);
      
      logger.info('Successfully exchanged auth code for access token');
      return response.data;
    } catch (error: any) {
      logger.error('Failed to exchange auth code:', error);
      throw error;
    }
  }

  /**
   * Subscribe to webhook events for real-time updates
   */
  async subscribeToWebhook(accessToken: string, webhookConfig: {
    event_type: string;
    url: string;
    connection_id: string;
  }): Promise<any> {
    try {
      logger.info(`Subscribing to webhook: ${webhookConfig.event_type}`);
      
      const response = await this.axiosInstance.post('/webhooks/subscribe', webhookConfig, {
        headers: {
          'x-trackstar-access-token': accessToken
        }
      });
      
      logger.info(`Successfully subscribed to webhook: ${webhookConfig.event_type}`);
      return response.data;
    } catch (error: any) {
      logger.error(`Failed to subscribe to webhook ${webhookConfig.event_type}:`, error);
      
      if (error.response) {
        logger.error('Webhook subscription error:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      }
      
      throw error;
    }
  }

  /**
   * Get connection details using access token
   */
  async getConnection(accessToken: string): Promise<any> {
    try {
      logger.info('Getting connection details');
      
      const response = await this.axiosInstance.get('/connections', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get connection details:', error);
      throw error;
    }
  }

  /**
   * Sync connection data
   */
  async syncConnection(accessToken: string, functionsToSync: string[]): Promise<any> {
    try {
      logger.info('Syncing connection data:', { functionsToSync });
      
      const response = await this.axiosInstance.post('/connections/sync', {
        functions_to_sync: functionsToSync
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      return response.data;
    } catch (error: any) {
      logger.error('Failed to sync connection:', error);
      throw error;
    }
  }

  /**
   * Get products from WMS
   */
  async getProducts(accessToken: string, filters: TrackstarFilters = {}): Promise<TrackstarListResponse<any>> {
    try {
      logger.info('Getting products from WMS with filters:', filters);
      
      // Use pagination to fetch all products
      const allProducts = await this.fetchAllPages(accessToken, '/wms/products', filters);
      
      logger.info(`Successfully fetched ${allProducts.length} products from Trackstar`);
      
      return {
        data: allProducts,
        next_token: null,
        total_count: allProducts.length
      };
    } catch (error: any) {
      logger.error('Failed to get products from Trackstar:', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Get a specific order from WMS by order number
   */
  async getOrderByNumber(accessToken: string, orderNumber: string): Promise<any> {
    try {
      logger.info(`Getting order ${orderNumber} from WMS`);
      
      const response = await this.getOrders(accessToken, { 
        order_number: orderNumber,
        limit: 1 
      });
      
      if (response.data && response.data.length > 0) {
        logger.info(`Found order ${orderNumber} in Trackstar`);
        return response.data[0];
      } else {
        logger.warn(`Order ${orderNumber} not found in Trackstar`);
        return null;
      }
    } catch (error: any) {
      logger.error(`Failed to fetch order ${orderNumber} from Trackstar:`, {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  async getOrderById(accessToken: string, orderId: string): Promise<any> {
    try {
      logger.info(`Getting order by ID ${orderId} from WMS using direct endpoint`);
      
      const response = await this.axiosInstance.get(`/wms/orders/${orderId}`, {
        headers: {
          'x-trackstar-access-token': accessToken
        }
      });
      
      logger.info(`Successfully fetched order ${orderId} from Trackstar`);
      return response.data;
    } catch (error: any) {
      logger.error(`Failed to fetch order ${orderId} from Trackstar:`, {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
        orderId
      });
      throw error;
    }
  }

  /**
   * Get orders from WMS
   */
  async getOrders(accessToken: string, filters: TrackstarFilters = {}): Promise<TrackstarListResponse<any>> {
    try {
      logger.info('Getting orders from WMS with filters:', filters);
      
      // Use pagination to fetch all orders
      const allOrders = await this.fetchAllPages(accessToken, '/wms/orders', filters);
      
      logger.info(`Successfully fetched ${allOrders.length} orders from Trackstar`);
      
      return {
        data: allOrders,
        next_token: null,
        total_count: allOrders.length
      };
    } catch (error: any) {
      logger.error('Failed to get orders from Trackstar:', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Get inventory from WMS
   */
  async getInventory(accessToken: string, filters: TrackstarFilters = {}): Promise<TrackstarListResponse<any>> {
    try {
      logger.info('Getting inventory from WMS with filters:', filters);
      
      // Use pagination to fetch all inventory
      const allInventory = await this.fetchAllPages(accessToken, '/wms/inventory', filters);
      
      logger.info(`Successfully fetched ${allInventory.length} inventory records from Trackstar`);
      
      return {
        data: allInventory,
        next_token: null,
        total_count: allInventory.length
      };
    } catch (error: any) {
      logger.error('Failed to get inventory from Trackstar:', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Get shipments from WMS - NOT AVAILABLE
   * Shipments are embedded within orders, not a separate endpoint
   */
  async getShipments(accessToken: string, filters: TrackstarFilters = {}): Promise<TrackstarListResponse<any>> {
    throw new Error('Shipments endpoint not available - shipments are embedded within orders');
  }

  /**
   * Get ship methods from WMS
   */
  async getShipMethods(accessToken: string, filters: TrackstarFilters = {}): Promise<TrackstarListResponse<any>> {
    try {
      logger.info('Getting ship methods from WMS with filters:', filters);
      
      const response = await this.fetchAllPages<any>(
        '/wms/shipmethods',
        accessToken,
        filters
      );
      
      logger.info(`Successfully fetched ${response.data.length} ship methods from Trackstar`);
      return response;
    } catch (error: any) {
      logger.error('Failed to fetch ship methods from Trackstar:', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Update order status in WMS
   */
  async updateOrderStatus(accessToken: string, externalOrderId: string, status: string): Promise<any> {
    try {
      logger.info(`Updating order status in Trackstar: ${externalOrderId} -> ${status}`);
      
      const response = await this.axiosInstance.put(`/wms/orders/${externalOrderId}`, {
        status: status
      }, {
        headers: {
          'x-trackstar-access-token': accessToken
        }
      });
      
      logger.info('Successfully updated order status in Trackstar');
      return response.data;
    } catch (error: any) {
      logger.error('Failed to update order status in Trackstar:', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Update order shipping address in WMS
   */
  async updateOrderAddress(accessToken: string, externalOrderId: string, address: any): Promise<any> {
    try {
      logger.info(`Updating order address in Trackstar: ${externalOrderId}`);
      
      const response = await this.axiosInstance.put(`/wms/orders/${externalOrderId}`, {
        ship_to_address: {
          full_name: address.fullName,
          company: address.company,
          address1: address.address1,
          address2: address.address2,
          city: address.city,
          state: address.state,
          zip_code: address.zipCode,
          country: address.country,
          phone: address.phone,
          email: address.email
        }
      }, {
        headers: {
          'x-trackstar-access-token': accessToken
        }
      });
      
      logger.info('Successfully updated order address in Trackstar');
      return response.data;
    } catch (error: any) {
      logger.error('Failed to update order address in Trackstar:', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Update order shipping method in WMS
   */
  async updateOrderShipping(accessToken: string, externalOrderId: string, shipping: { carrier: string, service: string }): Promise<any> {
    try {
      logger.info(`Updating order shipping method in Trackstar: ${externalOrderId}`);
      
      const response = await this.axiosInstance.put(`/wms/orders/${externalOrderId}`, {
        shipping_method: {
          carrier: shipping.carrier,
          service: shipping.service
        }
      }, {
        headers: {
          'x-trackstar-access-token': accessToken
        }
      });
      
      logger.info('Successfully updated order shipping method in Trackstar');
      return response.data;
    } catch (error: any) {
      logger.error('Failed to update order shipping method in Trackstar:', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Update order line items in Trackstar
   */
  async updateOrderItems(accessToken: string, externalOrderId: string, items: any[], idempotencyKey: string): Promise<any> {
    try {
      logger.info(`Updating order items in Trackstar: ${externalOrderId}`, { itemCount: items.length });
      
      const response = await this.axiosInstance.put(`/wms/orders/${externalOrderId}`, {
        line_items: items.map(item => ({
          sku: item.sku,
          quantity: item.quantity,
          ...(item.id && { id: item.id }) // Include ID for existing items
        }))
      }, {
        headers: {
          'x-trackstar-access-token': accessToken,
          'idempotency-key': idempotencyKey
        }
      });
      
      logger.info('Successfully updated order items in Trackstar');
      return response.data;
    } catch (error: any) {
      logger.error('Failed to update order items in Trackstar:', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Cancel order in Trackstar
   */
  async cancelOrder(accessToken: string, externalOrderId: string, reason: string, idempotencyKey: string): Promise<any> {
    try {
      logger.info(`Canceling order in Trackstar: ${externalOrderId}`, { reason });
      
      const response = await this.axiosInstance.post(`/wms/orders/${externalOrderId}/cancel`, {
        reason: reason
      }, {
        headers: {
          'x-trackstar-access-token': accessToken,
          'idempotency-key': idempotencyKey
        }
      });
      
      logger.info('Successfully canceled order in Trackstar');
      return response.data;
    } catch (error: any) {
      logger.error('Failed to cancel order in Trackstar:', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Add note to order in Trackstar
   */
  async addOrderNote(accessToken: string, externalOrderId: string, note: string, isInternal: boolean, idempotencyKey: string): Promise<any> {
    try {
      logger.info(`Adding note to order in Trackstar: ${externalOrderId}`, { isInternal });
      
      const response = await this.axiosInstance.post(`/wms/orders/${externalOrderId}/notes`, {
        content: note,
        type: isInternal ? 'internal' : 'customer'
      }, {
        headers: {
          'x-trackstar-access-token': accessToken,
          'idempotency-key': idempotencyKey
        }
      });
      
      logger.info('Successfully added note to order in Trackstar');
      return response.data;
    } catch (error: any) {
      logger.error('Failed to add note to order in Trackstar:', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }
}

// Singleton instance
let _trackstarClient: TrackstarClient | null = null;

export const trackstarClient = {
  get instance() {
    if (!_trackstarClient) {
      logger.info('Creating new Trackstar client instance');
      _trackstarClient = new TrackstarClient();
    }
    return _trackstarClient;
  },
  
  reset() {
    logger.info('Resetting Trackstar client singleton');
    _trackstarClient = null;
  }
};
