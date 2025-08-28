import { TrackstarIntegrationService } from '../../../integrations/trackstar/service';
import { trackstarClient } from '../../../integrations/trackstar/client';
import TestDataFactory from '../../factories';
import { PrismaClient } from '@packr/database';

// Mock the trackstar client
jest.mock('../../../integrations/trackstar/client');

const prisma = new PrismaClient();
const mockTrackstarClient = trackstarClient.instance as jest.Mocked<typeof trackstarClient.instance>;

describe('TrackstarIntegrationService', () => {
  let service: TrackstarIntegrationService;
  let threepl: any;
  let brand: any;

  beforeEach(async () => {
    await TestDataFactory.cleanup();
    
    threepl = await TestDataFactory.createThreePL();
    brand = await TestDataFactory.createBrand(threepl.id);
    
    service = new TrackstarIntegrationService();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await TestDataFactory.cleanup();
  });

  describe('createLinkToken', () => {
    it('should create link token for valid brand', async () => {
      const mockResponse = {
        link_token: 'test-link-token',
        expires_at: '2024-12-31T23:59:59Z'
      };

      mockTrackstarClient.createLinkToken.mockResolvedValue(mockResponse);

      const result = await service.createLinkToken(brand.id);

      expect(result.linkToken).toBe('test-link-token');
      expect(mockTrackstarClient.createLinkToken).toHaveBeenCalledWith();
    });

    it('should throw error for non-existent brand', async () => {
      await expect(service.createLinkToken('non-existent-brand')).rejects.toThrow('Brand not found');
    });
  });

  describe('exchangeAuthCode', () => {
    it('should exchange auth code and create integration', async () => {
      const mockResponse = {
        access_token: 'test-access-token',
        connection_id: 'test-connection-id',
        integration_name: 'Test Integration',
        available_actions: ['get_orders', 'get_products']
      };

      mockTrackstarClient.exchangeAuthCode.mockResolvedValue(mockResponse);

      await service.exchangeAuthCode(brand.id, 'test-auth-code');

      // Verify integration was created
      const integration = await prisma.brandIntegration.findUnique({
        where: {
          brandId_provider: {
            brandId: brand.id,
            provider: 'TRACKSTAR'
          }
        }
      });

      expect(integration).toBeTruthy();
      expect(integration!.accessToken).toBe('test-access-token');
      expect(integration!.connectionId).toBe('test-connection-id');
      expect(integration!.status).toBe('ACTIVE');
    });

    it('should update existing integration', async () => {
      // Create existing integration
      await TestDataFactory.createBrandIntegration(brand.id, {
        accessToken: 'old-token',
        connectionId: 'old-connection'
      });

      const mockResponse = {
        access_token: 'new-access-token',
        connection_id: 'new-connection-id',
        integration_name: 'Updated Integration',
        available_actions: ['get_orders', 'get_products', 'get_inventory']
      };

      mockTrackstarClient.exchangeAuthCode.mockResolvedValue(mockResponse);

      await service.exchangeAuthCode(brand.id, 'new-auth-code');

      // Verify integration was updated, not duplicated
      const integrations = await prisma.brandIntegration.findMany({
        where: {
          brandId: brand.id,
          provider: 'TRACKSTAR'
        }
      });

      expect(integrations).toHaveLength(1);
      expect(integrations[0].accessToken).toBe('new-access-token');
      expect(integrations[0].connectionId).toBe('new-connection-id');
    });
  });

  describe('syncProducts', () => {
    let integration: any;

    beforeEach(async () => {
      integration = await TestDataFactory.createBrandIntegration(brand.id);
    });

    it('should sync products from Trackstar', async () => {
      const mockProducts = {
        data: [
          {
            id: 'prod-1',
            sku: 'TEST-SKU-001',
            name: 'Test Product 1',
            price: 50.00,
            category: 'Electronics'
          },
          {
            id: 'prod-2',
            sku: 'TEST-SKU-002',
            name: 'Test Product 2',
            price: 75.00,
            category: 'Accessories'
          }
        ],
        next_token: null,
        total_count: 2
      };

      mockTrackstarClient.getProducts.mockResolvedValue(mockProducts);

      await service.triggerManualSync(brand.id, ['products']);

      // Verify products were created
      const products = await prisma.product.findMany({
        where: { brandId: brand.id }
      });

      expect(products).toHaveLength(2);
      expect(products[0].sku).toBe('TEST-SKU-001');
      expect(products[0].name).toBe('Test Product 1');
      expect(products[1].sku).toBe('TEST-SKU-002');
      expect(products[1].name).toBe('Test Product 2');
    });

    it('should update existing products', async () => {
      // Create existing product
      await TestDataFactory.createProduct(threepl.id, brand.id, {
        externalId: 'prod-1',
        sku: 'TEST-SKU-001',
        name: 'Old Product Name',
        price: 25.00
      });

      const mockProducts = {
        data: [
          {
            id: 'prod-1',
            sku: 'TEST-SKU-001',
            name: 'Updated Product Name',
            price: 60.00,
            category: 'Electronics'
          }
        ],
        next_token: null,
        total_count: 1
      };

      mockTrackstarClient.getProducts.mockResolvedValue(mockProducts);

      await service.triggerManualSync(brand.id, ['products']);

      // Verify product was updated, not duplicated
      const products = await prisma.product.findMany({
        where: { brandId: brand.id }
      });

      expect(products).toHaveLength(1);
      expect(products[0].name).toBe('Updated Product Name');
      expect(products[0].price).toBe(60.00);
    });
  });

  describe('syncOrders', () => {
    let integration: any;

    beforeEach(async () => {
      integration = await TestDataFactory.createBrandIntegration(brand.id);
    });

    it('should sync orders with line items and shipments', async () => {
      const mockOrders = {
        data: [
          {
            id: 'order-1',
            order_number: 'ORD-001',
            status: 'open',
            total_price: 100.00,
            total_tax: 8.00,
            total_shipping: 12.00,
            ship_to_address: {
              full_name: 'John Doe',
              email_address: 'john@example.com'
            },
            line_items: [
              {
                id: 'item-1',
                sku: 'TEST-SKU-001',
                quantity: 2,
                unit_price: 40.00,
                product_id: 'prod-1'
              }
            ],
            shipments: [
              {
                shipment_id: 'ship-1',
                status: 'shipped',
                shipped_date: '2024-01-01T12:00:00Z',
                tracking_number: 'TRACK123',
                carrier: 'UPS'
              }
            ]
          }
        ],
        next_token: null,
        total_count: 1
      };

      mockTrackstarClient.getOrders.mockResolvedValue(mockOrders);

      await service.triggerManualSync(brand.id, ['orders']);

      // Verify order was created
      const orders = await prisma.order.findMany({
        where: { brandId: brand.id },
        include: { orderItems: true, shipments: true }
      });

      expect(orders).toHaveLength(1);
      expect(orders[0].orderNumber).toBe('ORD-001');
      expect(orders[0].total).toBe(100.00);
      expect(orders[0].customerName).toBe('John Doe');
      expect(orders[0].customerEmail).toBe('john@example.com');

      // Verify order items were created
      expect(orders[0].orderItems).toHaveLength(1);

      // Verify shipments were created
      expect(orders[0].shipments).toHaveLength(1);
      expect(orders[0].shipments[0].trackingNumber).toBe('TRACK123');
      expect(orders[0].shipments[0].carrier).toBe('UPS');
    });

    it('should handle incremental sync with lookback', async () => {
      const mockOrders = {
        data: [],
        next_token: null,
        total_count: 0
      };

      mockTrackstarClient.getOrders.mockResolvedValue(mockOrders);

      // Test incremental sync with 2-hour lookback
      await service['processIncrementalSync'](brand.id, 2);

      // Verify API was called with date filter
      expect(mockTrackstarClient.getOrders).toHaveBeenCalledWith(
        integration.accessToken,
        expect.objectContaining({
          updated_date: expect.objectContaining({
            gte: expect.any(String)
          })
        })
      );
    });
  });

  describe('syncInventory', () => {
    let integration: any;
    let warehouse: any;

    beforeEach(async () => {
      integration = await TestDataFactory.createBrandIntegration(brand.id);
      warehouse = await TestDataFactory.createWarehouse(threepl.id);
    });

    it('should sync inventory items', async () => {
      const mockInventory = {
        data: [
          {
            id: 'inv-1',
            sku: 'TEST-SKU-001',
            onhand: 100,
            fulfillable: 95,
            committed: 5,
            unfulfillable: 0,
            locations: [
              {
                location_id: warehouse.externalId,
                name: 'Main Warehouse',
                quantity: 100
              }
            ]
          }
        ],
        next_token: null,
        total_count: 1
      };

      mockTrackstarClient.getInventory.mockResolvedValue(mockInventory);

      await service.triggerManualSync(brand.id, ['inventory']);

      // Verify inventory item was created
      const inventoryItems = await prisma.inventoryItem.findMany({
        where: { brandId: brand.id }
      });

      expect(inventoryItems).toHaveLength(1);
      expect(inventoryItems[0].sku).toBe('TEST-SKU-001');
      expect(inventoryItems[0].onHand).toBe(100);
      expect(inventoryItems[0].available).toBe(95);
      expect(inventoryItems[0].committed).toBe(5);
    });

    it('should create warehouses from inventory locations', async () => {
      const mockInventory = {
        data: [
          {
            id: 'inv-1',
            sku: 'TEST-SKU-001',
            onhand: 50,
            fulfillable: 45,
            locations: [
              {
                location_id: 'new-warehouse-123',
                name: 'New Warehouse',
                address: '123 Main St',
                city: 'Test City',
                state: 'TS',
                zip_code: '12345',
                quantity: 50
              }
            ]
          }
        ],
        next_token: null,
        total_count: 1
      };

      mockTrackstarClient.getInventory.mockResolvedValue(mockInventory);

      await service.triggerManualSync(brand.id, ['inventory']);

      // Verify new warehouse was created
      const newWarehouse = await prisma.warehouse.findUnique({
        where: {
          tenantId_externalId: {
            tenantId: threepl.id,
            externalId: 'new-warehouse-123'
          }
        }
      });

      expect(newWarehouse).toBeTruthy();
      expect(newWarehouse!.name).toBe('New Warehouse');
      expect(newWarehouse!.address).toBe('123 Main St');
      expect(newWarehouse!.city).toBe('Test City');
    });
  });

  describe('webhook processing', () => {
    let integration: any;

    beforeEach(async () => {
      integration = await TestDataFactory.createBrandIntegration(brand.id, {
        connectionId: 'test-connection-123'
      });
    });

    it('should process order webhook', async () => {
      const webhookData = {
        id: 'order-1',
        order_number: 'ORD-001',
        status: 'shipped',
        total: 100.00,
        customer_email: 'test@example.com',
        customer_name: 'Test Customer'
      };

      await service['handleOrderWebhook'](brand.id, webhookData);

      // Verify order was created/updated
      const order = await prisma.order.findUnique({
        where: {
          brandId_externalId: {
            brandId: brand.id,
            externalId: 'order-1'
          }
        }
      });

      expect(order).toBeTruthy();
      expect(order!.orderNumber).toBe('ORD-001');
      expect(order!.status).toBe('SHIPPED');
      expect(order!.customerEmail).toBe('test@example.com');
    });

    it('should process inventory webhook', async () => {
      // Create a product first
      const product = await TestDataFactory.createProduct(threepl.id, brand.id, {
        externalId: 'prod-1',
        sku: 'TEST-SKU-001'
      });

      const webhookData = {
        product_id: 'prod-1',
        sku: 'TEST-SKU-001',
        onhand: 75,
        fulfillable: 70,
        committed: 5,
        location_id: 'loc-1',
        location_name: 'Main Warehouse'
      };

      await service['handleInventoryWebhook'](brand.id, webhookData);

      // Verify inventory was updated
      const inventoryItem = await prisma.inventoryItem.findFirst({
        where: {
          brandId: brand.id,
          sku: 'TEST-SKU-001'
        }
      });

      expect(inventoryItem).toBeTruthy();
      expect(inventoryItem!.onHand).toBe(75);
      expect(inventoryItem!.available).toBe(70);
      expect(inventoryItem!.committed).toBe(5);
    });
  });

  describe('error handling', () => {
    it('should handle Trackstar API errors gracefully', async () => {
      mockTrackstarClient.getOrders.mockRejectedValue(new Error('Trackstar API Error'));

      await expect(service.triggerManualSync('non-existent-brand', ['orders']))
        .rejects.toThrow('Trackstar integration not found');
    });

    it('should handle database constraint errors', async () => {
      const integration = await TestDataFactory.createBrandIntegration(brand.id);

      // Mock successful API call but create constraint violation
      mockTrackstarClient.getProducts.mockResolvedValue({
        data: [
          {
            id: 'prod-1',
            sku: '', // Empty SKU should cause constraint error
            name: 'Test Product'
          }
        ],
        next_token: null,
        total_count: 1
      });

      await expect(service.triggerManualSync(brand.id, ['products']))
        .rejects.toThrow();
    });
  });

  describe('multitenancy isolation', () => {
    let otherThreepl: any;
    let otherBrand: any;

    beforeEach(async () => {
      otherThreepl = await TestDataFactory.createThreePL({ name: 'Other 3PL', slug: 'other-3pl' });
      otherBrand = await TestDataFactory.createBrand(otherThreepl.id, { name: 'Other Brand', slug: 'other-brand' });
    });

    it('should not sync data across different tenants', async () => {
      const integration1 = await TestDataFactory.createBrandIntegration(brand.id);
      const integration2 = await TestDataFactory.createBrandIntegration(otherBrand.id);

      const mockProducts = {
        data: [
          {
            id: 'prod-1',
            sku: 'TEST-SKU-001',
            name: 'Test Product',
            price: 50.00
          }
        ],
        next_token: null,
        total_count: 1
      };

      mockTrackstarClient.getProducts.mockResolvedValue(mockProducts);

      // Sync for first brand
      await service.triggerManualSync(brand.id, ['products']);

      // Verify product was created for correct tenant only
      const brand1Products = await prisma.product.findMany({
        where: { brandId: brand.id }
      });
      const brand2Products = await prisma.product.findMany({
        where: { brandId: otherBrand.id }
      });

      expect(brand1Products).toHaveLength(1);
      expect(brand2Products).toHaveLength(0);
      expect(brand1Products[0].threeplId).toBe(threepl.id);
    });
  });
});
