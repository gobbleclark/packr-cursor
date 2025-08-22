import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '../../utils/logger';

export interface TrackstarListResponse<T> {
  data: T[];
  next_token: string | null;
  total_count?: number;
}

export interface TrackstarFilters {
  limit?: number;
  page_token?: string;
  updated_date?: {
    gte?: string;
    lte?: string;
  };
  ids?: string[];
  [key: string]: any;
}

export interface TrackstarSyncRequest {
  accessToken: string;
  functions_to_sync: string[];
}

export interface TrackstarLinkTokenRequest {
  customer_id?: string;
  integration_name?: string;
}

export interface TrackstarExchangeRequest {
  auth_code: string;
  customer_id?: string;
}

export interface TrackstarExchangeResponse {
  access_token: string;
  connection_id: string;
  integration_name: string;
  available_actions: string[];
}

export class TrackstarClient {
  private axiosInstance: AxiosInstance;
  private rateLimiters: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly RATE_LIMIT_PER_SECOND = 10;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: process.env.TRACKSTAR_BASE_URL || 'https://production.trackstarhq.com',
      timeout: 30000,
      headers: {
        'x-trackstar-api-key': process.env.TRACKSTAR_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for rate limiting
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['x-rate-limit-retry-after'];
          if (retryAfter) {
            const waitTime = parseInt(retryAfter) * 1000;
            logger.info(`Rate limited, waiting ${waitTime}ms before retry`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.axiosInstance.request(error.config);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private async checkRateLimit(accessToken: string): Promise<void> {
    const now = Date.now();
    const limiter = this.rateLimiters.get(accessToken) || { count: 0, resetTime: now + 1000 };

    if (now >= limiter.resetTime) {
      limiter.count = 0;
      limiter.resetTime = now + 1000;
    }

    if (limiter.count >= this.RATE_LIMIT_PER_SECOND) {
      const waitTime = limiter.resetTime - now;
      logger.info(`Rate limit reached for token ${accessToken}, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      limiter.count = 0;
      limiter.resetTime = Date.now() + 1000;
    }

    limiter.count++;
    this.rateLimiters.set(accessToken, limiter);
  }

  private async makeRequest<T>(
    method: 'GET' | 'POST',
    path: string,
    accessToken?: string,
    data?: any,
    params?: any
  ): Promise<T> {
    if (accessToken) {
      await this.checkRateLimit(accessToken);
    }

    const config: any = {
      method,
      url: path,
      headers: accessToken ? { 'x-trackstar-access-token': accessToken } : {},
    };

    if (data) config.data = data;
    if (params) config.params = params;

    try {
      const response: AxiosResponse<T> = await this.axiosInstance.request(config);
      return response.data;
    } catch (error: any) {
      logger.error(`Trackstar API error for ${path}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async paginate<T>(
    path: string,
    accessToken: string,
    filters: TrackstarFilters = {},
    onPage?: (data: T[], pageNumber: number) => Promise<void>
  ): Promise<T[]> {
    const allData: T[] = [];
    let pageToken: string | null = null;
    let pageNumber = 1;

    do {
      const params = { ...filters };
      if (pageToken) {
        params.page_token = pageToken;
      }

      const response = await this.makeRequest<TrackstarListResponse<T>>(
        'GET',
        path,
        accessToken,
        undefined,
        params
      );

      allData.push(...response.data);
      
      if (onPage) {
        await onPage(response.data, pageNumber);
      }

      pageToken = response.next_token;
      pageNumber++;

      // Safety check to prevent infinite loops
      if (pageNumber > 100) {
        logger.warn(`Pagination limit reached for ${path}, stopping at page ${pageNumber}`);
        break;
      }
    } while (pageToken);

    return allData;
  }

  // WMS Endpoints
  async getProducts(accessToken: string, filters: TrackstarFilters = {}): Promise<TrackstarListResponse<any>> {
    return this.makeRequest<TrackstarListResponse<any>>('GET', '/wms/products', accessToken, undefined, filters);
  }

  async getProduct(accessToken: string, productId: string): Promise<any> {
    return this.makeRequest<any>('GET', `/wms/products/${productId}`, accessToken);
  }

  async getInventory(accessToken: string, filters: TrackstarFilters = {}): Promise<TrackstarListResponse<any>> {
    return this.makeRequest<TrackstarListResponse<any>>('GET', '/wms/inventory', accessToken, undefined, filters);
  }

  async getOrders(accessToken: string, filters: TrackstarFilters = {}): Promise<TrackstarListResponse<any>> {
    return this.makeRequest<TrackstarListResponse<any>>('GET', '/wms/orders', accessToken, undefined, filters);
  }

  async getOrder(accessToken: string, orderId: string): Promise<any> {
    return this.makeRequest<any>('GET', `/wms/orders/${orderId}`, accessToken);
  }

  async getShipments(accessToken: string, filters: TrackstarFilters = {}): Promise<TrackstarListResponse<any>> {
    return this.makeRequest<TrackstarListResponse<any>>('GET', '/wms/shipments', accessToken, undefined, filters);
  }

  async getShipment(accessToken: string, shipmentId: string): Promise<any> {
    return this.makeRequest<any>('GET', `/wms/shipments/${shipmentId}`, accessToken);
  }

  // Connection Management
  async createLinkToken(request: TrackstarLinkTokenRequest): Promise<{ link_token: string }> {
    return this.makeRequest<{ link_token: string }>('POST', '/link/token', undefined, request);
  }

  async exchangeAuthCode(request: TrackstarExchangeRequest): Promise<TrackstarExchangeResponse> {
    return this.makeRequest<TrackstarExchangeResponse>('POST', '/link/exchange', undefined, request);
  }

  // Sync Management
  async syncConnection(accessToken: string, functionsToSync: string[]): Promise<any> {
    return this.makeRequest<any>('POST', '/connections/sync', accessToken, {
      functions_to_sync: functionsToSync
    });
  }

  // Get connection details
  async getConnection(accessToken: string): Promise<any> {
    return this.makeRequest<any>('GET', '/connections', accessToken);
  }
}

export const trackstarClient = new TrackstarClient();
