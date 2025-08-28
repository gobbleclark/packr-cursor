import request from 'supertest';
import { app } from '../../index';
import { prisma } from '@packr/database';
import TestDataFactory from '../factories';

describe('Sync Health API', () => {
  let threepl: any;
  let brand: any;
  let integration: any;
  let user: any;
  let adminUser: any;

  beforeEach(async () => {
    await TestDataFactory.cleanup();
    
    threepl = await TestDataFactory.createThreePL();
    brand = await TestDataFactory.createBrand(threepl.id);
    integration = await TestDataFactory.createBrandIntegration(brand.id, {
      connectionId: 'test-connection-id',
      accessToken: 'test-access-token',
      status: 'ACTIVE',
      lastSyncedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      lastWebhookAt: new Date(Date.now() - 2 * 60 * 1000)  // 2 minutes ago
    });
    
    user = await TestDataFactory.createUser({
      threeplId: threepl.id,
      role: 'BRAND_USER'
    });

    adminUser = await TestDataFactory.createUser({
      threeplId: threepl.id,
      role: 'THREEPL_ADMIN'
    });
  });

  afterEach(async () => {
    await TestDataFactory.cleanup();
  });

  describe('GET /api/sync/health', () => {
    it('should return health status for authenticated user', async () => {
      // Create some webhook events for testing
      await prisma.webhookEventV2.createMany({
        data: [
          {
            eventId: 'evt_success_1',
            source: 'trackstar',
            eventType: 'inventory.updated',
            tenantId: threepl.id,
            brandId: brand.id,
            payload: { sku: 'TEST-1' },
            status: 'processed',
            processedAt: new Date()
          },
          {
            eventId: 'evt_failed_1',
            source: 'trackstar',
            eventType: 'order.created',
            tenantId: threepl.id,
            brandId: brand.id,
            payload: { order_id: 'ORDER-1' },
            status: 'failed',
            error: 'Test error'
          }
        ]
      });

      const response = await request(app)
        .get('/api/sync/health')
        .set('Authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      
      // Check aggregate stats
      expect(response.body.aggregate).toHaveProperty('totalIntegrations', 1);
      expect(response.body.aggregate).toHaveProperty('healthyIntegrations');
      expect(response.body.aggregate).toHaveProperty('avgSyncLag');
      expect(response.body.aggregate).toHaveProperty('totalRecentFailures', 1);

      // Check integration details
      expect(response.body.integrations).toHaveLength(1);
      const integrationHealth = response.body.integrations[0];
      expect(integrationHealth.brandId).toBe(brand.id);
      expect(integrationHealth.brandName).toBe(brand.name);
      expect(integrationHealth.tenantId).toBe(threepl.id);
      expect(integrationHealth.syncLagMs).toBeGreaterThan(0);
      expect(integrationHealth.recentFailures).toBe(1);
      expect(integrationHealth.recentSuccesses).toBe(1);
      expect(integrationHealth.errorRate).toBe(50); // 1 fail out of 2 total
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/sync/health');

      expect(response.status).toBe(401);
    });

    it('should filter by tenant for non-admin users', async () => {
      // Create another tenant with integration
      const otherThreepl = await TestDataFactory.createThreePL();
      const otherBrand = await TestDataFactory.createBrand(otherThreepl.id);
      await TestDataFactory.createBrandIntegration(otherBrand.id, {
        connectionId: 'other-connection-id',
        accessToken: 'other-access-token',
        status: 'ACTIVE'
      });

      const response = await request(app)
        .get('/api/sync/health')
        .set('Authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(200);
      expect(response.body.integrations).toHaveLength(1);
      expect(response.body.integrations[0].tenantId).toBe(threepl.id);
    });

    it('should classify health status correctly', async () => {
      // Update integration with old sync time (should be degraded)
      await prisma.brandIntegration.update({
        where: { id: integration.id },
        data: {
          lastSyncedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
          lastWebhookAt: new Date(Date.now() - 30 * 1000) // 30 seconds ago
        }
      });

      const response = await request(app)
        .get('/api/sync/health')
        .set('Authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(200);
      const integrationHealth = response.body.integrations[0];
      expect(integrationHealth.status).toBe('degraded'); // Due to sync lag > 5 minutes
    });
  });

  describe('POST /api/sync/replay', () => {
    beforeEach(async () => {
      // Create failed webhook events for replay testing
      await prisma.webhookEventV2.createMany({
        data: [
          {
            eventId: 'evt_failed_1',
            source: 'trackstar',
            eventType: 'inventory.updated',
            tenantId: threepl.id,
            brandId: brand.id,
            payload: { sku: 'TEST-1' },
            status: 'failed',
            error: 'Connection timeout',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
          },
          {
            eventId: 'evt_failed_2',
            source: 'trackstar',
            eventType: 'order.created',
            tenantId: threepl.id,
            brandId: brand.id,
            payload: { order_id: 'ORDER-1' },
            status: 'failed',
            error: 'Invalid payload',
            createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago
          }
        ]
      });
    });

    it('should require admin permissions', async () => {
      const response = await request(app)
        .post('/api/sync/replay')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          type: 'webhook',
          dryRun: true
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions');
    });

    it('should perform dry run for webhook replay', async () => {
      const response = await request(app)
        .post('/api/sync/replay')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          type: 'webhook',
          brandId: brand.id,
          maxAge: 24,
          dryRun: true
        });

      expect(response.status).toBe(200);
      expect(response.body.action).toBe('dry_run');
      expect(response.body.type).toBe('webhook');
      expect(response.body.eventsFound).toBe(2);
      expect(response.body.events).toHaveLength(2);
      expect(response.body.events[0]).toHaveProperty('eventId');
      expect(response.body.events[0]).toHaveProperty('error');
    });

    it('should perform dry run for sync replay', async () => {
      const response = await request(app)
        .post('/api/sync/replay')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          type: 'sync',
          brandId: brand.id,
          dryRun: true
        });

      expect(response.status).toBe(200);
      expect(response.body.action).toBe('dry_run');
      expect(response.body.type).toBe('sync');
      expect(response.body.brandsFound).toBe(1);
      expect(response.body.brands[0].brandId).toBe(brand.id);
    });

    it('should queue webhook events for replay', async () => {
      const response = await request(app)
        .post('/api/sync/replay')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          type: 'webhook',
          brandId: brand.id,
          maxAge: 24,
          dryRun: false
        });

      expect(response.status).toBe(200);
      expect(response.body.action).toBe('replay');
      expect(response.body.eventsFound).toBe(2);
      expect(response.body.eventsQueued).toBe(2);

      // Verify events were marked as pending
      const updatedEvents = await prisma.webhookEventV2.findMany({
        where: {
          status: 'pending',
          eventId: { in: ['evt_failed_1', 'evt_failed_2'] }
        }
      });
      expect(updatedEvents).toHaveLength(2);
    });

    it('should filter events by specific event IDs', async () => {
      const response = await request(app)
        .post('/api/sync/replay')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          type: 'webhook',
          eventIds: ['evt_failed_1'],
          dryRun: true
        });

      expect(response.status).toBe(200);
      expect(response.body.eventsFound).toBe(1);
      expect(response.body.events[0].eventId).toBe('evt_failed_1');
    });

    it('should validate request schema', async () => {
      const response = await request(app)
        .post('/api/sync/replay')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          type: 'invalid_type',
          maxAge: 200 // Over limit
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/sync/lag/:brandId', () => {
    beforeEach(async () => {
      // Create webhook events with processing times
      const now = new Date();
      await prisma.webhookEventV2.createMany({
        data: [
          {
            eventId: 'evt_processed_1',
            source: 'trackstar',
            eventType: 'inventory.updated',
            tenantId: threepl.id,
            brandId: brand.id,
            payload: { sku: 'TEST-1' },
            status: 'processed',
            receivedAt: new Date(now.getTime() - 5000), // 5 seconds processing lag
            processedAt: now
          },
          {
            eventId: 'evt_processed_2',
            source: 'trackstar',
            eventType: 'order.created', 
            tenantId: threepl.id,
            brandId: brand.id,
            payload: { order_id: 'ORDER-1' },
            status: 'processed',
            receivedAt: new Date(now.getTime() - 10000), // 10 seconds processing lag
            processedAt: now
          }
        ]
      });
    });

    it('should return detailed lag metrics for brand', async () => {
      const response = await request(app)
        .get(`/api/sync/lag/${brand.id}`)
        .set('Authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(200);
      expect(response.body.brandId).toBe(brand.id);
      expect(response.body.brandName).toBe(brand.name);
      expect(response.body.tenantId).toBe(threepl.id);
      
      // Check lag metrics structure
      expect(response.body.lag).toHaveProperty('syncLag');
      expect(response.body.lag).toHaveProperty('webhookLag');
      expect(response.body.lag).toHaveProperty('processingLag');
      expect(response.body.lag).toHaveProperty('recentActivity');

      // Check processing lag calculations
      expect(response.body.lag.processingLag.count).toBe(2);
      expect(response.body.lag.processingLag.avgMs).toBe(7500); // Average of 5000 and 10000
      expect(response.body.lag.processingLag.p50Ms).toBeGreaterThan(0);
      expect(response.body.lag.processingLag.maxMs).toBe(10000);
    });

    it('should return 404 for non-existent brand', async () => {
      const response = await request(app)
        .get('/api/sync/lag/non-existent-brand')
        .set('Authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Brand not found');
    });

    it('should enforce tenant isolation', async () => {
      // Create brand in different tenant
      const otherThreepl = await TestDataFactory.createThreePL();
      const otherBrand = await TestDataFactory.createBrand(otherThreepl.id);
      await TestDataFactory.createBrandIntegration(otherBrand.id);

      const response = await request(app)
        .get(`/api/sync/lag/${otherBrand.id}`)
        .set('Authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });

    it('should return empty processing lag for brand with no recent webhooks', async () => {
      // Clean up webhook events
      await prisma.webhookEventV2.deleteMany({
        where: { brandId: brand.id }
      });

      const response = await request(app)
        .get(`/api/sync/lag/${brand.id}`)
        .set('Authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(200);
      expect(response.body.lag.processingLag.count).toBe(0);
      expect(response.body.lag.processingLag.avgMs).toBeNull();
    });
  });
});