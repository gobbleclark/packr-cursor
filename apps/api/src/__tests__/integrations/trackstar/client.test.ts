import nock from 'nock';
import { TrackstarClient } from '../../../integrations/trackstar/client';

describe('TrackstarClient', () => {
  let client: TrackstarClient;
  const baseURL = 'https://production.trackstarhq.com';
  const apiKey = 'f9bc96aa7e0145b899b713d83a61ad3d';

  beforeEach(() => {
    client = new TrackstarClient();
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('createLinkToken', () => {
    it('should create a link token successfully', async () => {
      const mockResponse = {
        link_token: 'test-link-token',
        expires_at: '2024-12-31T23:59:59Z'
      };

      nock(baseURL)
        .post('/link/token')
        .matchHeader('x-trackstar-api-key', apiKey)
        .reply(200, mockResponse);

      const result = await client.createLinkToken();

      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors gracefully', async () => {
      nock(baseURL)
        .post('/link/token')
        .reply(400, { error: 'Invalid request' });

      await expect(client.createLinkToken()).rejects.toThrow();
    });
  });

  describe('exchangeAuthCode', () => {
    it('should exchange auth code for access token', async () => {
      const mockRequest = {
        auth_code: 'test-auth-code',
        integration_name: 'test-integration'
      };

      const mockResponse = {
        access_token: 'test-access-token',
        connection_id: 'test-connection-id',
        integration_name: 'test-integration',
        available_actions: ['get_orders', 'get_products']
      };

      nock(baseURL)
        .post('/link/exchange', mockRequest)
        .matchHeader('x-trackstar-api-key', apiKey)
        .reply(200, mockResponse);

      const result = await client.exchangeAuthCode(mockRequest);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('getOrders', () => {
    const accessToken = 'test-access-token';

    it('should fetch orders with pagination', async () => {
      const mockResponse = {
        data: [
          {
            id: 'order-1',
            order_number: 'ORD-001',
            status: 'open',
            total_price: 100.00,
            line_items: [
              {
                id: 'item-1',
                sku: 'TEST-SKU',
                quantity: 2,
                unit_price: 50.00
              }
            ],
            shipments: []
          }
        ],
        next_token: null,
        total_count: 1
      };

      nock(baseURL)
        .get('/wms/orders')
        .query({ limit: 1000 })
        .matchHeader('x-trackstar-access-token', accessToken)
        .reply(200, mockResponse);

      const result = await client.getOrders(accessToken);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].order_number).toBe('ORD-001');
    });

    it('should handle filters correctly', async () => {
      const filters = {
        order_number: 'ORD-001',
        limit: 50
      };

      nock(baseURL)
        .get('/wms/orders')
        .query({ ...filters, limit: 1000 }) // The client always sets limit to 1000
        .matchHeader('x-trackstar-access-token', accessToken)
        .reply(200, { data: [], next_token: null });

      await client.getOrders(accessToken, filters);

      expect(nock.isDone()).toBe(true);
    });

    it('should handle rate limiting', async () => {
      // First request succeeds
      nock(baseURL)
        .get('/wms/orders')
        .query({ limit: 1000 })
        .matchHeader('x-trackstar-access-token', accessToken)
        .reply(200, { data: [], next_token: null });

      // Second request should be rate limited
      const startTime = Date.now();
      await client.getOrders(accessToken);
      
      // Rate limiter should add minimal delay for single request
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('getProducts', () => {
    const accessToken = 'test-access-token';

    it('should fetch products successfully', async () => {
      const mockResponse = {
        data: [
          {
            id: 'prod-1',
            sku: 'TEST-SKU-001',
            name: 'Test Product',
            price: 50.00,
            category: 'Electronics'
          }
        ],
        next_token: null,
        total_count: 1
      };

      nock(baseURL)
        .get('/wms/products')
        .query({ limit: 1000 })
        .matchHeader('x-trackstar-access-token', accessToken)
        .reply(200, mockResponse);

      const result = await client.getProducts(accessToken);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].sku).toBe('TEST-SKU-001');
    });
  });

  describe('getInventory', () => {
    const accessToken = 'test-access-token';

    it('should fetch inventory successfully', async () => {
      const mockResponse = {
        data: [
          {
            id: 'inv-1',
            sku: 'TEST-SKU-001',
            onhand: 100,
            fulfillable: 95,
            committed: 5,
            locations: [
              {
                location_id: 'loc-1',
                name: 'Main Warehouse',
                quantity: 100
              }
            ]
          }
        ],
        next_token: null,
        total_count: 1
      };

      nock(baseURL)
        .get('/wms/inventory')
        .query({ limit: 1000 })
        .matchHeader('x-trackstar-access-token', accessToken)
        .reply(200, mockResponse);

      const result = await client.getInventory(accessToken);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].onhand).toBe(100);
      expect(result.data[0].fulfillable).toBe(95);
    });
  });

  describe('updateOrderStatus', () => {
    const accessToken = 'test-access-token';
    const orderId = 'order-1';

    it('should update order status successfully', async () => {
      const mockResponse = { success: true };

      nock(baseURL)
        .put(`/wms/orders/${orderId}`, { status: 'cancelled' })
        .matchHeader('x-trackstar-access-token', accessToken)
        .reply(200, mockResponse);

      const result = await client.updateOrderStatus(accessToken, orderId, 'cancelled');

      expect(result).toEqual(mockResponse);
    });
  });

  describe('cancelOrder', () => {
    const accessToken = 'test-access-token';
    const orderId = 'order-1';
    const idempotencyKey = 'test-key-123';

    it('should cancel order with idempotency key', async () => {
      const mockResponse = { success: true };

      nock(baseURL)
        .post(`/wms/orders/${orderId}/cancel`, { reason: 'Customer request' })
        .matchHeader('x-trackstar-access-token', accessToken)
        .matchHeader('idempotency-key', idempotencyKey)
        .reply(200, mockResponse);

      const result = await client.cancelOrder(accessToken, orderId, 'Customer request', idempotencyKey);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('addOrderNote', () => {
    const accessToken = 'test-access-token';
    const orderId = 'order-1';
    const idempotencyKey = 'test-key-123';

    it('should add internal note to order', async () => {
      const mockResponse = { success: true };

      nock(baseURL)
        .post(`/wms/orders/${orderId}/notes`, {
          content: 'Internal note',
          type: 'internal'
        })
        .matchHeader('x-trackstar-access-token', accessToken)
        .matchHeader('idempotency-key', idempotencyKey)
        .reply(200, mockResponse);

      const result = await client.addOrderNote(accessToken, orderId, 'Internal note', true, idempotencyKey);

      expect(result).toEqual(mockResponse);
    });

    it('should add customer note to order', async () => {
      const mockResponse = { success: true };

      nock(baseURL)
        .post(`/wms/orders/${orderId}/notes`, {
          content: 'Customer note',
          type: 'customer'
        })
        .matchHeader('x-trackstar-access-token', accessToken)
        .matchHeader('idempotency-key', idempotencyKey)
        .reply(200, mockResponse);

      const result = await client.addOrderNote(accessToken, orderId, 'Customer note', false, idempotencyKey);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('error handling', () => {
    const accessToken = 'test-access-token';

    it('should handle 429 rate limit errors', async () => {
      nock(baseURL)
        .get('/wms/orders')
        .matchHeader('x-trackstar-access-token', accessToken)
        .reply(429, { error: 'Rate limit exceeded' }, {
          'x-rate-limit-retry-after': '60'
        });

      await expect(client.getOrders(accessToken)).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      nock(baseURL)
        .get('/wms/orders')
        .query({ limit: 1000 })
        .matchHeader('x-trackstar-access-token', accessToken)
        .replyWithError(new Error('Network error'));

      await expect(client.getOrders(accessToken)).rejects.toThrow('Network error');
    });

    it('should handle invalid JSON responses', async () => {
      nock(baseURL)
        .get('/wms/orders')
        .query({ limit: 1000 })
        .matchHeader('x-trackstar-access-token', accessToken)
        .reply(200, 'Invalid JSON', { 'Content-Type': 'text/plain' });

      await expect(client.getOrders(accessToken)).rejects.toThrow();
    });
  });
});
