// Mock ShipHero API service - in production this would make real API calls
export class ShipHeroService {
  private baseUrl = 'https://public-api.shiphero.com/v1';

  async getOrders(apiKey: string): Promise<any[]> {
    // Mock implementation - in production would make real API calls
    console.log('Fetching orders from ShipHero API with key:', apiKey.substring(0, 8) + '...');
    
    // Return mock order data
    return [
      {
        id: 'sh_order_1',
        order_number: 'SH-2024-0001',
        status: 'pending',
        customer: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        shipping_address: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zip: '10001',
        },
        line_items: [
          {
            sku: 'PROD001',
            quantity: 2,
            price: 29.99,
          }
        ],
        total: 59.98,
        created_at: new Date().toISOString(),
      }
    ];
  }

  async getInventory(apiKey: string): Promise<any[]> {
    // Mock implementation
    console.log('Fetching inventory from ShipHero API with key:', apiKey.substring(0, 8) + '...');
    
    return [
      {
        id: 'sh_product_1',
        sku: 'PROD001',
        name: 'Sample Product',
        available_quantity: 150,
        allocated_quantity: 25,
        on_hand: 175,
      }
    ];
  }

  async updateOrderShipping(orderId: string, address: any, method?: string): Promise<any> {
    // Mock implementation
    console.log('Updating order shipping in ShipHero:', orderId, address, method);
    
    return {
      success: true,
      order_id: orderId,
      updated_address: address,
      shipping_method: method,
    };
  }

  async updateOrderItems(orderId: string, items: any[]): Promise<any> {
    // Mock implementation
    console.log('Updating order items in ShipHero:', orderId, items);
    
    return {
      success: true,
      order_id: orderId,
      updated_items: items,
    };
  }

  async placeHold(orderId: string, reason: string): Promise<any> {
    // Mock implementation
    console.log('Placing hold on order in ShipHero:', orderId, reason);
    
    return {
      success: true,
      order_id: orderId,
      hold_reason: reason,
      status: 'on_hold',
    };
  }

  async removeHold(orderId: string): Promise<any> {
    // Mock implementation
    console.log('Removing hold from order in ShipHero:', orderId);
    
    return {
      success: true,
      order_id: orderId,
      status: 'processing',
    };
  }

  async getFulfillmentUpdates(apiKey: string): Promise<any[]> {
    // Mock webhook data - in production this would be webhook endpoints
    console.log('Getting fulfillment updates from ShipHero API');
    
    return [
      {
        order_id: 'sh_order_1',
        status: 'shipped',
        tracking_number: '1Z999AA1234567890',
        carrier: 'UPS',
        shipped_at: new Date().toISOString(),
      }
    ];
  }
}
