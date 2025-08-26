import { TrackstarIntegrationService } from '../../../integrations/trackstar/service';
import { trackstarClient } from '../../../integrations/trackstar/client';

// Mock the trackstar client
jest.mock('../../../integrations/trackstar/client');

// Mock Prisma
jest.mock('@packr/database', () => ({
  prisma: {
    brand: {
      findUnique: jest.fn(),
    },
    brandIntegration: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    product: {
      create: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    order: {
      create: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    inventoryItem: {
      create: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Get the mocked prisma for use in tests
const { prisma: mockPrisma } = require('@packr/database');

const mockTrackstarClient = trackstarClient.instance as jest.Mocked<typeof trackstarClient.instance>;

describe('TrackstarIntegrationService (Unit Tests)', () => {
  let service: TrackstarIntegrationService;

  beforeEach(() => {
    service = new TrackstarIntegrationService();
    jest.clearAllMocks();
  });

  describe('createLinkToken', () => {
    it('should create link token for valid brand', async () => {
      const mockBrand = {
        id: 'brand-1',
        name: 'Test Brand',
        threeplId: 'threepl-1',
        threepl: { id: 'threepl-1', name: 'Test 3PL' }
      };

      const mockResponse = {
        link_token: 'test-link-token',
        expires_at: '2024-12-31T23:59:59Z'
      };

      mockPrisma.brand.findUnique.mockResolvedValue(mockBrand);
      mockTrackstarClient.createLinkToken.mockResolvedValue(mockResponse);

      const result = await service.createLinkToken('brand-1');

      expect(result.linkToken).toBe('test-link-token');
      expect(mockTrackstarClient.createLinkToken).toHaveBeenCalledWith();
      expect(mockPrisma.brand.findUnique).toHaveBeenCalledWith({
        where: { id: 'brand-1' },
        include: { threepl: true }
      });
    });

    it('should throw error for non-existent brand', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue(null);

      await expect(service.createLinkToken('non-existent-brand')).rejects.toThrow('Brand not found');
    });
  });

  describe('exchangeAuthCode', () => {
    it('should exchange auth code and create integration', async () => {
      const mockBrand = {
        id: 'brand-1',
        name: 'Test Brand',
        threeplId: 'threepl-1',
        threepl: { id: 'threepl-1', slug: 'test-3pl' }
      };

      const mockResponse = {
        access_token: 'test-access-token',
        connection_id: 'test-connection-id',
        integration_name: 'Test Integration',
        available_actions: ['get_orders', 'get_products']
      };

      const mockIntegration = {
        id: 'integration-1',
        brandId: 'brand-1',
        provider: 'TRACKSTAR',
        accessToken: 'test-access-token',
        connectionId: 'test-connection-id',
        status: 'ACTIVE'
      };

      mockPrisma.brand.findUnique.mockResolvedValue(mockBrand);
      mockTrackstarClient.exchangeAuthCode.mockResolvedValue(mockResponse);
      mockPrisma.brandIntegration.upsert.mockResolvedValue(mockIntegration);

      await service.exchangeAuthCode('brand-1', 'test-auth-code');

      expect(mockTrackstarClient.exchangeAuthCode).toHaveBeenCalledWith({
        auth_code: 'test-auth-code',
        customer_id: 'test-3pl'
      });

      expect(mockPrisma.brandIntegration.upsert).toHaveBeenCalledWith({
        where: {
          brandId_provider: {
            brandId: 'brand-1',
            provider: 'TRACKSTAR'
          }
        },
        update: expect.objectContaining({
          accessToken: 'test-access-token',
          connectionId: 'test-connection-id',
          status: 'ACTIVE'
        }),
        create: expect.objectContaining({
          brandId: 'brand-1',
          provider: 'TRACKSTAR',
          accessToken: 'test-access-token',
          connectionId: 'test-connection-id',
          status: 'ACTIVE'
        })
      });
    });
  });

  describe('order status mapping', () => {
    it('should map Trackstar statuses to internal statuses', () => {
      // Access the private method through bracket notation for testing
      const mapOrderStatus = (service as any).mapOrderStatus.bind(service);

      expect(mapOrderStatus('open')).toBe('PENDING');
      expect(mapOrderStatus('allocated')).toBe('PROCESSING');
      expect(mapOrderStatus('picked')).toBe('PROCESSING');
      expect(mapOrderStatus('packed')).toBe('PROCESSING');
      expect(mapOrderStatus('fulfilled')).toBe('SHIPPED');
      expect(mapOrderStatus('complete')).toBe('DELIVERED');
      expect(mapOrderStatus('cancelled')).toBe('CANCELLED');
      expect(mapOrderStatus('unknown_status')).toBe('PENDING');
    });

    it('should prefer raw_status over status', () => {
      const mapOrderStatus = (service as any).mapOrderStatus.bind(service);

      expect(mapOrderStatus('open', 'allocated')).toBe('PROCESSING');
      expect(mapOrderStatus('complete', 'shipped')).toBe('SHIPPED');
    });
  });

  describe('webhook processing', () => {
    it('should process order webhook data correctly', async () => {
      const mockBrand = {
        id: 'brand-1',
        threeplId: 'threepl-1'
      };

      const webhookData = {
        id: 'order-1',
        order_number: 'ORD-001',
        status: 'shipped',
        total: 100.00,
        customer_email: 'test@example.com',
        customer_name: 'Test Customer'
      };

      const mockOrder = {
        id: 'order-db-1',
        externalId: 'order-1',
        orderNumber: 'ORD-001',
        status: 'SHIPPED'
      };

      mockPrisma.brand.findUnique.mockResolvedValue(mockBrand);
      mockPrisma.order.upsert.mockResolvedValue(mockOrder);

      await service['handleOrderWebhook']('brand-1', webhookData);

      expect(mockPrisma.order.upsert).toHaveBeenCalledWith({
        where: {
          brandId_externalId: {
            brandId: 'brand-1',
            externalId: 'order-1'
          }
        },
        update: expect.objectContaining({
          orderNumber: 'ORD-001',
          status: 'SHIPPED',
          customerEmail: 'test@example.com',
          customerName: 'Test Customer'
        }),
        create: expect.objectContaining({
          threeplId: 'threepl-1',
          brandId: 'brand-1',
          externalId: 'order-1',
          orderNumber: 'ORD-001',
          status: 'SHIPPED'
        })
      });
    });
  });

  describe('error handling', () => {
    it('should handle Trackstar API errors gracefully', async () => {
      mockTrackstarClient.createLinkToken.mockRejectedValue(new Error('Trackstar API Error'));

      const mockBrand = {
        id: 'brand-1',
        threepl: { id: 'threepl-1' }
      };
      mockPrisma.brand.findUnique.mockResolvedValue(mockBrand);

      await expect(service.createLinkToken('brand-1')).rejects.toThrow('Trackstar API Error');
    });

    it('should handle database errors', async () => {
      const mockBrand = {
        id: 'brand-1',
        threepl: { id: 'threepl-1', slug: 'test' }
      };

      mockPrisma.brand.findUnique.mockResolvedValue(mockBrand);
      mockTrackstarClient.exchangeAuthCode.mockResolvedValue({
        access_token: 'token',
        connection_id: 'conn',
        integration_name: 'test',
        available_actions: []
      });
      mockPrisma.brandIntegration.upsert.mockRejectedValue(new Error('Database constraint error'));

      await expect(service.exchangeAuthCode('brand-1', 'auth-code')).rejects.toThrow('Database constraint error');
    });
  });

  describe('data validation', () => {
    it('should validate required fields in sync operations', async () => {
      const mockProducts = {
        data: [
          {
            id: 'prod-1',
            sku: 'TEST-SKU-001',
            name: 'Test Product',
            price: 50.00
          },
          {
            id: 'prod-2',
            // Missing required SKU field
            name: 'Invalid Product'
          }
        ]
      };

      mockTrackstarClient.getProducts.mockResolvedValue(mockProducts);

      const mockBrand = {
        id: 'brand-1',
        threeplId: 'threepl-1'
      };

      const mockIntegration = {
        id: 'integration-1',
        accessToken: 'test-token',
        status: 'ACTIVE'
      };

      mockPrisma.brandIntegration.findUnique.mockResolvedValue(mockIntegration);
      mockPrisma.brand.findUnique.mockResolvedValue(mockBrand);
      mockPrisma.product.upsert.mockImplementation((data) => {
        if (!data.create.sku) {
          throw new Error('SKU is required');
        }
        return Promise.resolve({ id: 'created-product' });
      });

      // Should handle the error gracefully and continue processing valid products
      await expect(service.triggerManualSync('brand-1', ['products'])).rejects.toThrow();
      
      // Verify that at least one valid product was attempted to be created
      expect(mockPrisma.product.upsert).toHaveBeenCalled();
    });
  });
});
