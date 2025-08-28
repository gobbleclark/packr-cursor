/**
 * Trackstar Order Service - Handles all order modifications through Trackstar API
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export interface TrackstarResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AddressData {
  street: string;
  street2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  name?: string;
  phone?: string;
}

export interface LineItemData {
  sku: string;
  quantity: number;
  name?: string;
}

export interface CarrierData {
  carrierId: string;
  carrierName: string;
  serviceLevel?: string;
}

export interface TrackingData {
  trackingNumber?: string;
  carrier?: string;
  status?: string;
  estimatedDelivery?: string;
  trackingUrl?: string;
  events?: Array<{
    date: string;
    status: string;
    location?: string;
    description?: string;
  }>;
}

export interface OrderDetailsData {
  id: string;
  orderNumber: string;
  status: string;
  customerName?: string;
  customerEmail?: string;
  shippingAddress: AddressData;
  lineItems: LineItemData[];
  carrier?: CarrierData;
  tracking?: TrackingData;
  createdAt: string;
  updatedAt: string;
  notes?: Array<{
    id: string;
    content: string;
    author: string;
    createdAt: string;
    isInternal: boolean;
  }>;
}

class TrackstarOrderService {
  private getAuthHeaders() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      throw new Error('No authentication token found');
    }
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<TrackstarResponse<T>> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          headers: {
            ...this.getAuthHeaders(),
            ...options.headers
          }
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        return {
          success: true,
          data: data.data || data,
          message: data.message
        };
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error);

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Unknown error occurred'
    };
  }

  /**
   * Get full order details
   */
  async getOrderDetails(orderNumber: string): Promise<TrackstarResponse<OrderDetailsData>> {
    console.log('🔍 Getting order details for:', orderNumber);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    console.log('🔑 Token available:', !!token);
    if (token) {
      console.log('🔑 Token preview:', token.substring(0, 20) + '...');
    }
    return this.makeRequest<OrderDetailsData>(`/api/trackstar/orders/${orderNumber}`);
  }

  /**
   * Update shipping address
   */
  async updateAddress(orderNumber: string, address: AddressData): Promise<TrackstarResponse> {
    return this.makeRequest(`/api/trackstar/orders/${orderNumber}/address`, {
      method: 'POST',
      body: JSON.stringify(address)
    });
  }

  /**
   * Update line items
   */
  async updateLineItems(orderNumber: string, items: LineItemData[]): Promise<TrackstarResponse> {
    return this.makeRequest(`/api/trackstar/orders/${orderNumber}/items`, {
      method: 'POST',
      body: JSON.stringify({ items })
    });
  }

  /**
   * Update carrier and shipping method
   */
  async updateCarrier(orderNumber: string, carrier: CarrierData): Promise<TrackstarResponse> {
    return this.makeRequest(`/api/trackstar/orders/${orderNumber}/carrier`, {
      method: 'POST',
      body: JSON.stringify(carrier)
    });
  }

  /**
   * Get tracking information
   */
  async getTrackingInfo(orderNumber: string): Promise<TrackstarResponse<TrackingData>> {
    return this.makeRequest<TrackingData>(`/api/trackstar/orders/${orderNumber}/tracking`);
  }

  /**
   * Get available carriers for an order
   */
  async getAvailableCarriers(orderNumber: string): Promise<TrackstarResponse<CarrierData[]>> {
    return this.makeRequest<CarrierData[]>(`/api/trackstar/orders/${orderNumber}/carriers`);
  }

  /**
   * Add order note
   */
  async addOrderNote(
    orderNumber: string, 
    content: string, 
    isInternal: boolean = false
  ): Promise<TrackstarResponse> {
    return this.makeRequest(`/api/trackstar/orders/${orderNumber}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content, isInternal })
    });
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderNumber: string, reason: string): Promise<TrackstarResponse> {
    return this.makeRequest(`/api/trackstar/orders/${orderNumber}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }
}

export const trackstarOrderService = new TrackstarOrderService();
