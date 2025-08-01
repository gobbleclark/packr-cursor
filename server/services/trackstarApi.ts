/**
 * Trackstar API Integration Service
 * Handles real API calls to Trackstar for universal WMS connectivity
 */

interface TrackstarCredentials {
  apiKey: string;
}

interface TrackstarOrder {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  status: string;
  totalAmount: number;
  currency: string;
  shippingMethod: string;
  trackingNumber?: string;
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  shippingAddress: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };
  fulfillmentStatus: string;
  createdAt: string;
  updatedAt: string;
}

interface TrackstarProduct {
  productId: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  barcode?: string;
  inventoryCount: number;
  lowStockThreshold?: number;
  category?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export class TrackstarApiService {
  private baseUrl = 'https://api.trackstar.io/v1';
  private universalApiKey = '269fcaf8b50a4fb4b384724f3e5d76db'; // Universal Trackstar API key

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any, customApiKey?: string) {
    const apiKey = customApiKey || this.universalApiKey;
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Key': apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Trackstar API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getOrders(credentials: TrackstarCredentials, fromDate?: Date): Promise<TrackstarOrder[]> {
    const params = new URLSearchParams();
    if (fromDate) {
      params.append('from_date', fromDate.toISOString());
    }
    params.append('limit', '100');

    const data = await this.makeRequest(`/orders?${params.toString()}`, 'GET', undefined, credentials.apiKey);
    return data.orders || [];
  }

  async getProducts(credentials: TrackstarCredentials): Promise<TrackstarProduct[]> {
    const data = await this.makeRequest('/products?limit=200', 'GET', undefined, credentials.apiKey);
    return data.products || [];
  }

  async getInventory(credentials: TrackstarCredentials): Promise<any[]> {
    const data = await this.makeRequest('/inventory?limit=200', 'GET', undefined, credentials.apiKey);
    return data.inventory || [];
  }

  async getWarehouses(credentials: TrackstarCredentials): Promise<any[]> {
    const data = await this.makeRequest('/warehouses', 'GET', undefined, credentials.apiKey);
    return data.warehouses || [];
  }

  async getShipments(credentials: TrackstarCredentials, fromDate?: Date): Promise<any[]> {
    const params = new URLSearchParams();
    if (fromDate) {
      params.append('from_date', fromDate.toISOString());
    }
    params.append('limit', '100');

    const data = await this.makeRequest(`/shipments?${params.toString()}`, 'GET', undefined, credentials.apiKey);
    return data.shipments || [];
  }

  async testConnection(credentials: TrackstarCredentials): Promise<boolean> {
    try {
      await this.makeRequest('/health', 'GET', undefined, credentials.apiKey);
      return true;
    } catch (error) {
      console.error('Trackstar connection test failed:', error);
      return false;
    }
  }

  // Method to use universal API key for brands without custom credentials
  async getUniversalData(endpoint: string): Promise<any> {
    try {
      return await this.makeRequest(endpoint);
    } catch (error) {
      console.error(`Universal Trackstar API call failed for ${endpoint}:`, error);
      return null;
    }
  }
}

export const trackstarApi = new TrackstarApiService();