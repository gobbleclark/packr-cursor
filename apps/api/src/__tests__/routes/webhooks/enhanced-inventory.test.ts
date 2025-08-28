import request from 'supertest';
import crypto from 'crypto';
import { app } from '../../../index';
import { prisma } from '@packr/database';
import TestDataFactory from '../../factories';

describe('Enhanced Trackstar Inventory Webhook', () => {
  let threepl: any;
  let brand: any;
  let integration: any;

  const webhookSecret = 'test-webhook-secret';
  const originalSecret = process.env.TRACKSTAR_WEBHOOK_SECRET;
  const originalSkipValidation = process.env.SKIP_WEBHOOK_SIGNATURE_VALIDATION;

  beforeAll(async () => {
    // Set webhook secret for testing
    process.env.TRACKSTAR_WEBHOOK_SECRET = webhookSecret;
    process.env.SKIP_WEBHOOK_SIGNATURE_VALIDATION = 'false';
  });

  afterAll(async () => {
    // Restore environment
    if (originalSecret !== undefined) {
      process.env.TRACKSTAR_WEBHOOK_SECRET = originalSecret;
    } else {
      delete process.env.TRACKSTAR_WEBHOOK_SECRET;
    }

    if (originalSkipValidation !== undefined) {
      process.env.SKIP_WEBHOOK_SIGNATURE_VALIDATION = originalSkipValidation;
    } else {
      delete process.env.SKIP_WEBHOOK_SIGNATURE_VALIDATION;
    }
  });

  beforeEach(async () => {
    await TestDataFactory.cleanup();
    
    threepl = await TestDataFactory.createThreePL();
    brand = await TestDataFactory.createBrand(threepl.id);
    integration = await TestDataFactory.createBrandIntegration(brand.id, {
      connectionId: 'test-connection-id',
      accessToken: 'test-access-token'
    });
  });

  afterEach(async () => {
    await TestDataFactory.cleanup();
  });

  const createValidWebhookPayload = () => ({
    event_id: `evt_${Date.now()}`,
    event_type: 'inventory.updated',
    connection_id: integration.connectionId,
    integration_name: 'Test Integration',
    data: {
      id: 'inv_123',
      warehouse_customer_id: 'wh_customer_456',
      created_date: '2024-01-15T10:00:00Z',
      updated_date: '2024-01-15T11:00:00Z',
      name: 'Test Product',
      sku: 'TEST-SKU-001',
      unit_cost: 25.50,
      active: true,
      awaiting: 0,
      onhand: 100,
      committed: 20,
      unfulfillable: 5,
      fulfillable: 75,
      unsellable: 0,
      sellable: 95,
      substitute_skus: [],
      inventory_by_warehouse_id: {
        'wh_123': {
          awaiting: 0,
          committed: 20,
          fulfillable: 75,
          onhand: 100,
          sellable: 95,
          unfulfillable: 5,
          unsellable: 0
        }
      },
      locations: [{
        location_id: 'loc_123',
        quantity: 100,
        warehouse_id: 'wh_123'
      }],
      external_system_url: 'https://wms.example.com/inventory/inv_123'
    }
  });

  const signPayload = (payload: any): string => {
    const payloadStr = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadStr)
      .digest('hex');
  };

  describe('signature validation', () => {
    it('should accept valid webhook with correct signature', async () => {
      const payload = createValidWebhookPayload();
      const signature = signPayload(payload);

      const response = await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .set('x-trackstar-signature', `sha256=${signature}`)
        .set('x-correlation-id', 'test-correlation-123')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify inventory item was created
      const inventoryItem = await prisma.inventoryItem.findFirst({
        where: { sku: 'TEST-SKU-001' }
      });
      expect(inventoryItem).toBeTruthy();
      expect(inventoryItem?.onHand).toBe(100);
      expect(inventoryItem?.available).toBe(75);
    });

    it('should accept signature without sha256 prefix', async () => {
      const payload = createValidWebhookPayload();
      const signature = signPayload(payload);

      const response = await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .set('x-trackstar-signature', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject webhook with invalid signature', async () => {
      const payload = createValidWebhookPayload();

      const response = await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .set('x-trackstar-signature', 'invalid-signature-123')
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid signature');
    });

    it('should reject webhook with missing signature', async () => {
      const payload = createValidWebhookPayload();

      const response = await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid signature');
    });
  });

  describe('enhanced idempotency', () => {
    it('should prevent duplicate processing of same event', async () => {
      const payload = createValidWebhookPayload();
      const signature = signPayload(payload);

      // First request
      const response1 = await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .set('x-trackstar-signature', `sha256=${signature}`)
        .send(payload);

      expect(response1.status).toBe(200);

      // Second request with same event_id
      const response2 = await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .set('x-trackstar-signature', `sha256=${signature}`)
        .send(payload);

      expect(response2.status).toBe(200);
      expect(response2.body.message).toContain('already processed');

      // Verify only one inventory item was created
      const inventoryItems = await prisma.inventoryItem.findMany({
        where: { sku: 'TEST-SKU-001' }
      });
      expect(inventoryItems).toHaveLength(1);
    });

    it('should store correlation ID in webhook event metadata', async () => {
      const payload = createValidWebhookPayload();
      const signature = signPayload(payload);
      const correlationId = 'test-correlation-456';

      await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .set('x-trackstar-signature', `sha256=${signature}`)
        .set('x-correlation-id', correlationId)
        .send(payload);

      const webhookEvent = await prisma.webhookEventV2.findUnique({
        where: { eventId: payload.event_id }
      });

      expect(webhookEvent).toBeTruthy();
      expect(webhookEvent?.payload).toHaveProperty('_metadata');
      expect((webhookEvent?.payload as any)?._metadata?.correlationId).toBe(correlationId);
    });

    it('should generate content-based idempotency keys', async () => {
      const payload = createValidWebhookPayload();
      const signature = signPayload(payload);

      await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .set('x-trackstar-signature', `sha256=${signature}`)
        .send(payload);

      const webhookEvent = await prisma.webhookEventV2.findUnique({
        where: { eventId: payload.event_id }
      });

      const metadata = (webhookEvent?.payload as any)?._metadata;
      expect(metadata?.idempotencyKey).toBeTruthy();
      expect(metadata?.idempotencyKey).toContain(threepl.id);
      expect(metadata?.idempotencyKey).toContain(brand.id);
      expect(metadata?.idempotencyKey).toContain('inventory');
      expect(metadata?.idempotencyKey).toContain('inventory.updated');
    });
  });

  describe('processing metrics', () => {
    it('should record processing time in webhook event', async () => {
      const payload = createValidWebhookPayload();
      const signature = signPayload(payload);

      await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .set('x-trackstar-signature', `sha256=${signature}`)
        .send(payload);

      const webhookEvent = await prisma.webhookEventV2.findUnique({
        where: { eventId: payload.event_id }
      });

      const metadata = (webhookEvent?.payload as any)?._metadata;
      expect(metadata?.processingTimeMs).toBeDefined();
      expect(typeof metadata?.processingTimeMs).toBe('number');
      expect(metadata?.processingTimeMs).toBeGreaterThan(0);
    });

    it('should record failure details for processing errors', async () => {
      // Create payload with invalid connection_id to trigger failure
      const payload = createValidWebhookPayload();
      payload.connection_id = 'invalid-connection-id';
      const signature = signPayload(payload);

      await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .set('x-trackstar-signature', `sha256=${signature}`)
        .send(payload);

      const webhookEvent = await prisma.webhookEventV2.findUnique({
        where: { eventId: payload.event_id }
      });

      expect(webhookEvent?.status).toBe('failed');
      expect(webhookEvent?.error).toContain('No active Trackstar integration found');
      
      const metadata = (webhookEvent?.payload as any)?._metadata;
      expect(metadata?.failedAt).toBeDefined();
    });
  });

  describe('bypass signature validation in development', () => {
    beforeEach(() => {
      process.env.SKIP_WEBHOOK_SIGNATURE_VALIDATION = 'true';
    });

    afterEach(() => {
      process.env.SKIP_WEBHOOK_SIGNATURE_VALIDATION = 'false';
    });

    it('should accept webhook without signature when validation disabled', async () => {
      const payload = createValidWebhookPayload();

      const response = await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});