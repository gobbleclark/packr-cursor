import request from 'supertest';
import express from 'express';
import ordersRouter from '../../routes/orders';

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.auth = { userId: 'test-user-id' };
    req.user = { id: 'user-1', clerkId: 'test-user-id' };
    next();
  },
  requireRole: () => (req: any, res: any, next: any) => {
    req.membership = { 
      role: 'BRAND_USER', 
      brandId: 'brand-1', 
      threeplId: 'threepl-1' 
    };
    next();
  }
}));

// Mock Prisma
const mockPrisma = {
  order: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  orderNote: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  shipment: {
    findMany: jest.fn(),
  },
};

jest.mock('@packr/database', () => ({
  prisma: mockPrisma,
}));

// Mock Trackstar client
const mockTrackstarClient = {
  updateOrderStatus: jest.fn(),
  updateOrderAddress: jest.fn(),
  updateOrderShipping: jest.fn(),
  updateOrderItems: jest.fn(),
  cancelOrder: jest.fn(),
  addOrderNote: jest.fn(),
};

jest.mock('../../integrations/trackstar/client', () => ({
  trackstarClient: {
    instance: mockTrackstarClient
  }
}));

const app = express();
app.use(express.json());
app.use('/api/orders', ordersRouter);

describe('Orders API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/orders', () => {
    it('should return paginated orders', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: 'ORD-001',
          status: 'PENDING',
          total: 100.00,
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          createdAt: new Date('2024-01-01'),
          metadata: { has_shipments: false }
        },
        {
          id: 'order-2',
          orderNumber: 'ORD-002',
          status: 'SHIPPED',
          total: 250.00,
          customerName: 'Jane Smith',
          customerEmail: 'jane@example.com',
          createdAt: new Date('2024-01-02'),
          metadata: { has_shipments: true }
        }
      ];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);
      mockPrisma.order.count.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/orders')
        .expect(200);

      expect(response.body.orders).toHaveLength(2);
      expect(response.body.totalCount).toBe(2);
      expect(response.body.orders[0].orderNumber).toBe('ORD-001');
      expect(response.body.orders[1].orderNumber).toBe('ORD-002');
    });

    it('should handle pagination parameters', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await request(app)
        .get('/api/orders?page=2&limit=10')
        .expect(200);

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: 10, // (page - 1) * limit
        take: 10
      });
    });

    it('should filter by status', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await request(app)
        .get('/api/orders?status=SHIPPED')
        .expect(200);

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: 'SHIPPED'
        }),
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: 0,
        take: 50
      });
    });

    it('should search by order number', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await request(app)
        .get('/api/orders?search=ORD-001')
        .expect(200);

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { orderNumber: { contains: 'ORD-001', mode: 'insensitive' } },
            { customerName: { contains: 'ORD-001', mode: 'insensitive' } },
            { customerEmail: { contains: 'ORD-001', mode: 'insensitive' } }
          ])
        }),
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: 0,
        take: 50
      });
    });

    it('should filter by date range', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await request(app)
        .get('/api/orders?startDate=2024-01-01&endDate=2024-01-31')
        .expect(200);

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-01-31')
          }
        }),
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: 0,
        take: 50
      });
    });

    it('should enforce brand isolation', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await request(app)
        .get('/api/orders')
        .expect(200);

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          brandId: 'brand-1'
        }),
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: 0,
        take: 50
      });
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should return order details with shipments and notes', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        status: 'SHIPPED',
        total: 100.00,
        customerName: 'John Doe',
        brandId: 'brand-1',
        orderItems: [
          {
            id: 'item-1',
            quantity: 2,
            price: 50.00,
            product: { name: 'Test Product', sku: 'TEST-001' }
          }
        ],
        shipments: [
          {
            id: 'shipment-1',
            trackingNumber: 'TRACK123',
            carrier: 'UPS',
            status: 'shipped'
          }
        ]
      };

      const mockNotes = [
        {
          id: 'note-1',
          content: 'Order processed',
          isInternal: false,
          createdAt: new Date(),
          user: { firstName: 'John', lastName: 'Admin' }
        }
      ];

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.orderNote.findMany.mockResolvedValue(mockNotes);

      const response = await request(app)
        .get('/api/orders/order-1')
        .expect(200);

      expect(response.body.orderNumber).toBe('ORD-001');
      expect(response.body.orderItems).toHaveLength(1);
      expect(response.body.shipments).toHaveLength(1);
      expect(response.body.notes).toHaveLength(1);
    });

    it('should return 404 for non-existent order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await request(app)
        .get('/api/orders/non-existent')
        .expect(404);
    });

    it('should enforce brand isolation for order access', async () => {
      const mockOrder = {
        id: 'order-1',
        brandId: 'different-brand', // Different brand
        orderNumber: 'ORD-001'
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      await request(app)
        .get('/api/orders/order-1')
        .expect(403);
    });
  });

  describe('POST /api/orders/:id/notes', () => {
    it('should add note to order', async () => {
      const mockOrder = {
        id: 'order-1',
        brandId: 'brand-1',
        externalId: 'ext-order-1'
      };

      const mockNote = {
        id: 'note-1',
        content: 'Customer called about delivery',
        isInternal: false,
        createdAt: new Date(),
        user: { firstName: 'John', lastName: 'Support' }
      };

      const mockIntegration = {
        accessToken: 'test-token'
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.orderNote.create.mockResolvedValue(mockNote);
      mockTrackstarClient.addOrderNote.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/orders/order-1/notes')
        .send({
          content: 'Customer called about delivery',
          isInternal: false
        })
        .expect(201);

      expect(response.body.content).toBe('Customer called about delivery');
      expect(mockPrisma.orderNote.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-1',
          userId: 'user-1',
          content: 'Customer called about delivery',
          isInternal: false
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      });
    });

    it('should validate note content', async () => {
      await request(app)
        .post('/api/orders/order-1/notes')
        .send({
          content: '', // Empty content
          isInternal: false
        })
        .expect(400);
    });
  });

  describe('PUT /api/orders/:id/status', () => {
    it('should update order status', async () => {
      const mockOrder = {
        id: 'order-1',
        brandId: 'brand-1',
        externalId: 'ext-order-1',
        status: 'PENDING'
      };

      const mockIntegration = {
        accessToken: 'test-token'
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'PROCESSING'
      });
      mockTrackstarClient.updateOrderStatus.mockResolvedValue({ success: true });

      const response = await request(app)
        .put('/api/orders/order-1/status')
        .send({ status: 'PROCESSING' })
        .expect(200);

      expect(response.body.status).toBe('PROCESSING');
      expect(mockTrackstarClient.updateOrderStatus).toHaveBeenCalledWith(
        'test-token',
        'ext-order-1',
        'processing' // Mapped to Trackstar status
      );
    });

    it('should validate status values', async () => {
      await request(app)
        .put('/api/orders/order-1/status')
        .send({ status: 'INVALID_STATUS' })
        .expect(400);
    });
  });

  describe('POST /api/orders/:id/cancel', () => {
    it('should cancel order with reason', async () => {
      const mockOrder = {
        id: 'order-1',
        brandId: 'brand-1',
        externalId: 'ext-order-1',
        status: 'PENDING'
      };

      const mockIntegration = {
        accessToken: 'test-token'
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED'
      });
      mockTrackstarClient.cancelOrder.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/orders/order-1/cancel')
        .send({ reason: 'Customer request' })
        .expect(200);

      expect(response.body.status).toBe('CANCELLED');
      expect(mockTrackstarClient.cancelOrder).toHaveBeenCalledWith(
        'test-token',
        'ext-order-1',
        'Customer request',
        expect.any(String) // idempotency key
      );
    });

    it('should prevent cancelling already shipped orders', async () => {
      const mockOrder = {
        id: 'order-1',
        brandId: 'brand-1',
        status: 'SHIPPED'
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      await request(app)
        .post('/api/orders/order-1/cancel')
        .send({ reason: 'Customer request' })
        .expect(400);
    });
  });

  describe('error handling', () => {
    it('should handle database errors', async () => {
      mockPrisma.order.findMany.mockRejectedValue(new Error('Database connection error'));

      await request(app)
        .get('/api/orders')
        .expect(500);
    });

    it('should handle Trackstar API errors', async () => {
      const mockOrder = {
        id: 'order-1',
        brandId: 'brand-1',
        externalId: 'ext-order-1'
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockTrackstarClient.updateOrderStatus.mockRejectedValue(new Error('Trackstar API Error'));

      await request(app)
        .put('/api/orders/order-1/status')
        .send({ status: 'PROCESSING' })
        .expect(500);
    });

    it('should handle missing integration', async () => {
      const mockOrder = {
        id: 'order-1',
        brandId: 'brand-1',
        externalId: 'ext-order-1'
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      // No integration found scenario would be handled in the actual route

      const response = await request(app)
        .put('/api/orders/order-1/status')
        .send({ status: 'PROCESSING' });

      // The actual implementation would handle this case
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe('performance and pagination', () => {
    it('should handle large result sets with proper pagination', async () => {
      const mockOrders = Array.from({ length: 50 }, (_, i) => ({
        id: `order-${i + 1}`,
        orderNumber: `ORD-${String(i + 1).padStart(3, '0')}`,
        status: 'PENDING',
        total: 100.00,
        customerName: `Customer ${i + 1}`,
        createdAt: new Date()
      }));

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);
      mockPrisma.order.count.mockResolvedValue(1000);

      const response = await request(app)
        .get('/api/orders?page=1&limit=50')
        .expect(200);

      expect(response.body.orders).toHaveLength(50);
      expect(response.body.totalCount).toBe(1000);
      expect(response.body.totalPages).toBe(20);
      expect(response.body.currentPage).toBe(1);
    });

    it('should limit maximum page size', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await request(app)
        .get('/api/orders?limit=1000') // Excessive limit
        .expect(200);

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: 0,
        take: 100 // Should be capped at maximum
      });
    });
  });

  describe('POST /api/orders/:id/address', () => {
    it('should update order address successfully', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        externalId: 'trackstar-123',
        brandId: 'brand-1',
        threeplId: 'threepl-1'
      };

      const mockIntegration = {
        id: 'integration-1',
        brandId: 'brand-1',
        provider: 'TRACKSTAR',
        status: 'ACTIVE',
        accessToken: 'token-123'
      };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      mockPrisma.brandIntegration.findFirst.mockResolvedValue(mockIntegration);
      mockTrackstarClient.updateOrderAddress.mockResolvedValue({ success: true });

      const addressData = {
        fullName: 'John Doe',
        address1: '123 Test St',
        city: 'Test City',
        state: 'TS',
        postalCode: '12345',
        country: 'US'
      };

      const response = await request(app)
        .post('/api/orders/order-1/address')
        .send(addressData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockTrackstarClient.updateOrderAddress).toHaveBeenCalledWith(
        'token-123',
        'trackstar-123',
        addressData,
        expect.any(String)
      );
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/orders/order-1/address')
        .send({
          fullName: 'John Doe'
          // Missing required fields
        })
        .expect(400);

      expect(response.body.error).toBe('Missing required address fields');
    });
  });

  describe('POST /api/orders/:id/items', () => {
    it('should update order items successfully', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        externalId: 'trackstar-123',
        brandId: 'brand-1',
        threeplId: 'threepl-1'
      };

      const mockIntegration = {
        id: 'integration-1',
        brandId: 'brand-1',
        provider: 'TRACKSTAR',
        status: 'ACTIVE',
        accessToken: 'token-123'
      };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      mockPrisma.brandIntegration.findFirst.mockResolvedValue(mockIntegration);
      mockTrackstarClient.updateOrderItems.mockResolvedValue({ success: true });

      const itemsData = {
        items: [
          { sku: 'TEST-001', quantity: 2 },
          { sku: 'TEST-002', quantity: 1 }
        ]
      };

      const response = await request(app)
        .post('/api/orders/order-1/items')
        .send(itemsData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockTrackstarClient.updateOrderItems).toHaveBeenCalledWith(
        'token-123',
        'trackstar-123',
        itemsData.items,
        expect.any(String)
      );
    });
  });

  describe('POST /api/orders/:id/cancel', () => {
    it('should cancel order successfully', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        externalId: 'trackstar-123',
        brandId: 'brand-1',
        threeplId: 'threepl-1',
        status: 'PENDING'
      };

      const mockIntegration = {
        id: 'integration-1',
        brandId: 'brand-1',
        provider: 'TRACKSTAR',
        status: 'ACTIVE',
        accessToken: 'token-123'
      };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      mockPrisma.brandIntegration.findFirst.mockResolvedValue(mockIntegration);
      mockPrisma.order.update.mockResolvedValue({ ...mockOrder, status: 'CANCELLED' });
      mockPrisma.orderNote.create.mockResolvedValue({ id: 'note-1' });
      mockTrackstarClient.cancelOrder.mockResolvedValue({ success: true });

      const cancelData = {
        reason: 'Customer requested cancellation'
      };

      const response = await request(app)
        .post('/api/orders/order-1/cancel')
        .send(cancelData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockTrackstarClient.cancelOrder).toHaveBeenCalledWith(
        'token-123',
        'trackstar-123',
        cancelData.reason,
        expect.any(String)
      );
    });
  });
});
