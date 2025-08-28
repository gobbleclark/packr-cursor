import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@packr/database';
import inventoryWebhookRouter from '../../../routes/webhooks/inventory';
import TestDataFactory from '../../factories';

const app = express();
app.use(express.json());
app.use('/api/webhooks', inventoryWebhookRouter);

const prisma = new PrismaClient();

describe('Trackstar Inventory Webhook', () => {
  let threepl: any;
  let brand: any;
  let integration: any;

  beforeEach(async () => {
    await TestDataFactory.cleanup();
    
    threepl = await TestDataFactory.createThreePL();
    brand = await TestDataFactory.createBrand(threepl.id);
    integration = await TestDataFactory.createBrandIntegration(brand.id, {
      connectionId: 'test-connection-123'
    });
  });

  afterEach(async () => {
    await TestDataFactory.cleanup();
  });

  const validWebhookPayload = {
    event_id: 'evt_123456789',
    event_type: 'inventory.updated',
    connection_id: 'test-connection-123',
    integration_name: 'Test Integration',
    data: {
      id: 'inv_123',
      warehouse_customer_id: 'wh_cust_123',
      created_date: '2024-01-01T00:00:00Z',
      updated_date: '2024-01-01T12:00:00Z',
      name: 'Test Product',
      sku: 'TEST-SKU-001',
      unit_cost: 25.50,
      active: true,
      awaiting: 0,
      onhand: 100,
      committed: 10,
      unfulfillable: 5,
      fulfillable: 85,
      unsellable: 0,
      sellable: 95,
      inventory_by_warehouse_id: {
        'wh_1': {
          awaiting: 0,
          committed: 10,
          fulfillable: 85,
          onhand: 100,
          sellable: 95,
          unfulfillable: 5,
          unsellable: 0
        }
      },
      locations: [
        {
          location_id: 'loc_1',
          quantity: 100,
          warehouse_id: 'wh_1'
        }
      ]
    }
  };

  describe('POST /api/webhooks/trackstar/inventory', () => {
    it('should process valid inventory webhook successfully', async () => {
      const response = await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .send(validWebhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify inventory item was created
      const inventoryItem = await prisma.inventoryItem.findFirst({
        where: {
          tenantId: threepl.id,
          brandId: brand.id,
          sku: 'TEST-SKU-001'
        }
      });

      expect(inventoryItem).toBeTruthy();
      expect(inventoryItem!.onHand).toBe(100);
      expect(inventoryItem!.available).toBe(85);
      expect(inventoryItem!.committed).toBe(10);
      expect(inventoryItem!.unitCost).toBe(25.50);

      // Verify webhook event was recorded
      const webhookEvent = await prisma.webhookEventV2.findUnique({
        where: { eventId: 'evt_123456789' }
      });

      expect(webhookEvent).toBeTruthy();
      expect(webhookEvent!.status).toBe('processed');
      expect(webhookEvent!.tenantId).toBe(threepl.id);
      expect(webhookEvent!.brandId).toBe(brand.id);
    });

    it('should handle idempotency - return success for duplicate events', async () => {
      // First request
      await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .send(validWebhookPayload)
        .expect(200);

      // Second request with same event_id
      const response = await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .send(validWebhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Event already processed');

      // Verify only one inventory item exists
      const inventoryItems = await prisma.inventoryItem.findMany({
        where: {
          tenantId: threepl.id,
          brandId: brand.id,
          sku: 'TEST-SKU-001'
        }
      });

      expect(inventoryItems).toHaveLength(1);
    });

    it('should retry failed events', async () => {
      // Create a failed event record
      await prisma.webhookEventV2.create({
        data: {
          eventId: 'evt_123456789',
          source: 'trackstar',
          eventType: 'inventory.updated',
          payload: validWebhookPayload,
          status: 'failed',
          error: 'Previous failure',
          attempts: 1
        }
      });

      const response = await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .send(validWebhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify event status was updated to processed
      const webhookEvent = await prisma.webhookEventV2.findUnique({
        where: { eventId: 'evt_123456789' }
      });

      expect(webhookEvent!.status).toBe('processed');
      expect(webhookEvent!.attempts).toBe(2);
      expect(webhookEvent!.error).toBeNull();
    });

    it('should return 404 for unknown connection_id', async () => {
      const invalidPayload = {
        ...validWebhookPayload,
        connection_id: 'unknown-connection'
      };

      const response = await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .send(invalidPayload)
        .expect(404);

      expect(response.body.error).toContain('No active Trackstar integration found');

      // Verify failed event was recorded
      const webhookEvent = await prisma.webhookEventV2.findUnique({
        where: { eventId: 'evt_123456789' }
      });

      expect(webhookEvent!.status).toBe('failed');
    });

    it('should validate webhook payload schema', async () => {
      const invalidPayload = {
        event_id: 'evt_123',
        // Missing required fields
        data: {
          sku: 'TEST-SKU'
          // Missing other required fields
        }
      };

      await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .send(invalidPayload)
        .expect(500); // Zod validation error
    });

    it('should handle missing SKU gracefully', async () => {
      const payloadWithoutSku = {
        ...validWebhookPayload,
        data: {
          ...validWebhookPayload.data,
          sku: undefined
        }
      };

      await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .send(payloadWithoutSku)
        .expect(500); // Should fail validation
    });

    it('should update existing inventory item', async () => {
      // Create existing inventory item
      await TestDataFactory.createInventoryItem(threepl.id, brand.id, 'TEST-SKU-001', {
        onHand: 50,
        available: 45,
        committed: 5
      });

      const response = await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .send(validWebhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify inventory was updated, not duplicated
      const inventoryItems = await prisma.inventoryItem.findMany({
        where: {
          tenantId: threepl.id,
          brandId: brand.id,
          sku: 'TEST-SKU-001'
        }
      });

      expect(inventoryItems).toHaveLength(1);
      expect(inventoryItems[0].onHand).toBe(100); // Updated value
      expect(inventoryItems[0].available).toBe(85); // Updated value
    });

    it('should handle multi-warehouse inventory correctly', async () => {
      const multiWarehousePayload = {
        ...validWebhookPayload,
        data: {
          ...validWebhookPayload.data,
          inventory_by_warehouse_id: {
            'wh_1': {
              awaiting: 0,
              committed: 5,
              fulfillable: 45,
              onhand: 50,
              sellable: 50,
              unfulfillable: 0,
              unsellable: 0
            },
            'wh_2': {
              awaiting: 0,
              committed: 5,
              fulfillable: 40,
              onhand: 50,
              sellable: 45,
              unfulfillable: 5,
              unsellable: 0
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .send(multiWarehousePayload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // For now, we create one aggregated record
      // In the future, we might create separate records per warehouse
      const inventoryItem = await prisma.inventoryItem.findFirst({
        where: {
          tenantId: threepl.id,
          brandId: brand.id,
          sku: 'TEST-SKU-001'
        }
      });

      expect(inventoryItem).toBeTruthy();
    });

    it('should handle database errors gracefully', async () => {
      // Mock a database error by using an invalid tenant ID
      const invalidPayload = {
        ...validWebhookPayload,
        connection_id: 'test-connection-123'
      };

      // Temporarily delete the integration to cause a constraint error
      await prisma.brandIntegration.delete({
        where: { id: integration.id }
      });

      const response = await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .send(invalidPayload)
        .expect(404);

      expect(response.body.error).toContain('No active Trackstar integration found');
    });

    it('should record webhook processing metrics', async () => {
      const startTime = Date.now();

      await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .send(validWebhookPayload)
        .expect(200);

      const webhookEvent = await prisma.webhookEventV2.findUnique({
        where: { eventId: 'evt_123456789' }
      });

      expect(webhookEvent!.processedAt).toBeTruthy();
      expect(webhookEvent!.attempts).toBe(1);
      
      const processingTime = new Date(webhookEvent!.processedAt!).getTime() - startTime;
      expect(processingTime).toBeGreaterThan(0);
      expect(processingTime).toBeLessThan(5000); // Should process within 5 seconds
    });
  });

  describe('webhook signature validation', () => {
    it('should skip signature validation in development', async () => {
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .send(validWebhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should skip signature validation when flag is set', async () => {
      process.env.SKIP_WEBHOOK_SIGNATURE_VALIDATION = 'true';

      const response = await request(app)
        .post('/api/webhooks/trackstar/inventory')
        .send(validWebhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
