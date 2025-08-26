import request from 'supertest';
import express from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';

// Mock Clerk
jest.mock('@clerk/express', () => ({
  ClerkExpressRequireAuth: () => (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.auth = {
        userId: 'test-user-id',
        sessionId: 'test-session-id'
      };
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  }
}));

// Mock Prisma
jest.mock('@packr/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    membership: {
      findFirst: jest.fn(),
    },
  },
}));

// Get the mocked prisma for use in tests
const { prisma: mockPrisma } = require('@packr/database');

describe('Auth Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    jest.clearAllMocks();
  });

  describe('requireAuth', () => {
    beforeEach(() => {
      app.get('/protected', requireAuth, (req, res) => {
        res.json({ message: 'Protected route accessed', userId: req.auth?.userId });
      });
    });

    it('should allow access with valid token', async () => {
      const mockUser = {
        id: 'user-1',
        clerkId: 'test-user-id',
        email: 'test@example.com',
        isActive: true
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.message).toBe('Protected route accessed');
      expect(response.body.userId).toBe('test-user-id');
    });

    it('should reject access without token', async () => {
      await request(app)
        .get('/protected')
        .expect(401);
    });

    it('should reject access with invalid token', async () => {
      await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject access for inactive user', async () => {
      const mockUser = {
        id: 'user-1',
        clerkId: 'test-user-id',
        email: 'test@example.com',
        isActive: false
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer valid-token')
        .expect(403);
    });

    it('should reject access for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer valid-token')
        .expect(404);
    });
  });

  describe('requireRole', () => {
    beforeEach(() => {
      // Mock user lookup for all role tests
      const mockUser = {
        id: 'user-1',
        clerkId: 'test-user-id',
        email: 'test@example.com',
        isActive: true
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    });

    it('should allow SUPER_ADMIN access to any route', async () => {
      app.get('/admin-only', requireAuth, requireRole(['THREEPL_ADMIN']), (req, res) => {
        res.json({ message: 'Admin route accessed' });
      });

      const mockMembership = {
        id: 'membership-1',
        userId: 'user-1',
        role: 'SUPER_ADMIN',
        threeplId: 'threepl-1'
      };

      mockPrisma.membership.findFirst.mockResolvedValue(mockMembership);

      await request(app)
        .get('/admin-only')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);
    });

    it('should allow access with correct role', async () => {
      app.get('/threepl-route', requireAuth, requireRole(['THREEPL_ADMIN', 'THREEPL_USER']), (req, res) => {
        res.json({ message: 'ThreePL route accessed' });
      });

      const mockMembership = {
        id: 'membership-1',
        userId: 'user-1',
        role: 'THREEPL_USER',
        threeplId: 'threepl-1'
      };

      mockPrisma.membership.findFirst.mockResolvedValue(mockMembership);

      await request(app)
        .get('/threepl-route')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);
    });

    it('should deny access with incorrect role', async () => {
      app.get('/admin-only', requireAuth, requireRole(['THREEPL_ADMIN']), (req, res) => {
        res.json({ message: 'Admin route accessed' });
      });

      const mockMembership = {
        id: 'membership-1',
        userId: 'user-1',
        role: 'BRAND_USER',
        threeplId: null,
        brandId: 'brand-1'
      };

      mockPrisma.membership.findFirst.mockResolvedValue(mockMembership);

      await request(app)
        .get('/admin-only')
        .set('Authorization', 'Bearer valid-token')
        .expect(403);
    });

    it('should deny access when user has no memberships', async () => {
      app.get('/protected-route', requireAuth, requireRole(['BRAND_USER']), (req, res) => {
        res.json({ message: 'Protected route accessed' });
      });

      mockPrisma.membership.findFirst.mockResolvedValue(null);

      await request(app)
        .get('/protected-route')
        .set('Authorization', 'Bearer valid-token')
        .expect(403);
    });

    it('should handle brand-specific access', async () => {
      app.get('/brand/:brandId/data', requireAuth, requireRole(['BRAND_USER', 'BRAND_ADMIN']), (req, res) => {
        res.json({ message: 'Brand data accessed', brandId: req.params.brandId });
      });

      const mockMembership = {
        id: 'membership-1',
        userId: 'user-1',
        role: 'BRAND_USER',
        brandId: 'brand-1',
        threeplId: null
      };

      mockPrisma.membership.findFirst.mockResolvedValue(mockMembership);

      await request(app)
        .get('/brand/brand-1/data')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);
    });

    it('should deny brand access for wrong brand', async () => {
      app.get('/brand/:brandId/data', requireAuth, requireRole(['BRAND_USER']), (req, res) => {
        res.json({ message: 'Brand data accessed' });
      });

      const mockMembership = {
        id: 'membership-1',
        userId: 'user-1',
        role: 'BRAND_USER',
        brandId: 'brand-1',
        threeplId: null
      };

      mockPrisma.membership.findFirst.mockResolvedValue(mockMembership);

      await request(app)
        .get('/brand/brand-2/data')
        .set('Authorization', 'Bearer valid-token')
        .expect(403);
    });
  });

  describe('multitenancy isolation', () => {
    beforeEach(() => {
      const mockUser = {
        id: 'user-1',
        clerkId: 'test-user-id',
        email: 'test@example.com',
        isActive: true
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    });

    it('should isolate 3PL data access', async () => {
      app.get('/threepl/:threeplId/orders', requireAuth, requireRole(['THREEPL_USER']), (req, res) => {
        res.json({ message: 'Orders accessed', threeplId: req.params.threeplId });
      });

      const mockMembership = {
        id: 'membership-1',
        userId: 'user-1',
        role: 'THREEPL_USER',
        threeplId: 'threepl-1'
      };

      mockPrisma.membership.findFirst.mockResolvedValue(mockMembership);

      // Should allow access to own 3PL
      await request(app)
        .get('/threepl/threepl-1/orders')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      // Should deny access to different 3PL
      await request(app)
        .get('/threepl/threepl-2/orders')
        .set('Authorization', 'Bearer valid-token')
        .expect(403);
    });

    it('should handle mixed role scenarios', async () => {
      app.get('/mixed-access', requireAuth, requireRole(['THREEPL_USER', 'BRAND_ADMIN']), (req, res) => {
        res.json({ message: 'Mixed access granted' });
      });

      // Test with 3PL user
      let mockMembership = {
        id: 'membership-1',
        userId: 'user-1',
        role: 'THREEPL_USER',
        threeplId: 'threepl-1'
      };

      mockPrisma.membership.findFirst.mockResolvedValue(mockMembership);

      await request(app)
        .get('/mixed-access')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      // Test with brand admin
      mockMembership = {
        id: 'membership-2',
        userId: 'user-1',
        role: 'BRAND_ADMIN',
        brandId: 'brand-1',
        threeplId: null
      };

      mockPrisma.membership.findFirst.mockResolvedValue(mockMembership);

      await request(app)
        .get('/mixed-access')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      const mockUser = {
        id: 'user-1',
        clerkId: 'test-user-id',
        email: 'test@example.com',
        isActive: true
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    });

    it('should handle database errors gracefully', async () => {
      app.get('/db-error-route', requireAuth, requireRole(['BRAND_USER']), (req, res) => {
        res.json({ message: 'Should not reach here' });
      });

      mockPrisma.membership.findFirst.mockRejectedValue(new Error('Database connection error'));

      await request(app)
        .get('/db-error-route')
        .set('Authorization', 'Bearer valid-token')
        .expect(500);
    });

    it('should handle missing auth context', async () => {
      app.get('/no-auth-context', (req, res, next) => {
        // Simulate missing auth context
        req.auth = undefined;
        next();
      }, requireRole(['BRAND_USER']), (req, res) => {
        res.json({ message: 'Should not reach here' });
      });

      await request(app)
        .get('/no-auth-context')
        .expect(401);
    });
  });
});
