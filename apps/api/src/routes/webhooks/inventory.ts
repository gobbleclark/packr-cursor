import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/database';
import { logger } from '../../utils/logger';
import { createTrackstarWebhookValidator, webhookValidationMiddleware } from '../../lib/webhook-validation';

const router = Router();

// Initialize webhook validator
const webhookValidator = createTrackstarWebhookValidator();

// Validation schema for Trackstar inventory webhook
const trackstarInventoryWebhookSchema = z.object({
  event_id: z.string(),
  event_type: z.string(),
  connection_id: z.string(),
  integration_name: z.string(),
  data: z.object({
    id: z.string(),
    warehouse_customer_id: z.string(),
    created_date: z.string(),
    updated_date: z.string(),
    name: z.string().optional(),
    sku: z.string(),
    unit_cost: z.number().optional(),
    active: z.boolean().optional(),
    awaiting: z.number().default(0),
    onhand: z.number().default(0),
    committed: z.number().default(0),
    unfulfillable: z.number().default(0),
    fulfillable: z.number().default(0),
    unsellable: z.number().default(0),
    sellable: z.number().default(0),
    substitute_skus: z.array(z.string()).optional(),
    inventory_by_warehouse_id: z.record(z.object({
      awaiting: z.number().default(0),
      committed: z.number().default(0),
      fulfillable: z.number().default(0),
      onhand: z.number().default(0),
      sellable: z.number().default(0),
      unfulfillable: z.number().default(0),
      unsellable: z.number().default(0),
    })).optional(),
    lots: z.array(z.object({
      expiration_date: z.string().optional(),
      lot_id: z.string(),
      onhand: z.number(),
      warehouse_id: z.string(),
    })).optional(),
    measurements: z.object({
      height: z.number().optional(),
      length: z.number().optional(),
      unit: z.string().optional(),
      weight: z.number().optional(),
      weight_unit: z.string().optional(),
      width: z.number().optional(),
    }).optional(),
    locations: z.array(z.object({
      location_id: z.string(),
      quantity: z.number(),
      warehouse_id: z.string(),
    })).optional(),
    external_system_url: z.string().optional(),
    additional_fields: z.record(z.any()).optional(),
  }),
});

/**
 * POST /api/webhooks/trackstar/inventory
 * Webhook receiver for Trackstar inventory updates
 * Implements signature validation and content-based idempotency
 */
router.post('/trackstar/inventory', webhookValidationMiddleware(webhookValidator), async (req, res) => {
  const startTime = Date.now();
  const correlationId = req.correlationId || `inv-${Date.now()}`;
  
  try {
    const payload = trackstarInventoryWebhookSchema.parse(req.body);
    const { event_id, event_type, connection_id, integration_name, data } = payload;

    logger.info('Received Trackstar inventory webhook', {
      event_id,
      event_type,
      connection_id,
      sku: data.sku,
      correlationId,
    });

    // Enhanced idempotency check using both event_id and content-based key
    const existingEvent = await prisma.webhookEventV2.findUnique({
      where: { eventId: event_id },
    });

    if (existingEvent) {
      if (existingEvent.status === 'processed') {
        logger.info('Event already processed, returning success', { event_id });
        return res.status(200).json({ success: true, message: 'Event already processed' });
      } else if (existingEvent.status === 'failed') {
        logger.info('Retrying failed event', { event_id });
        // Continue processing to retry
      }
    }

    // Find the brand integration by connection_id
    const integration = await prisma.brandIntegration.findFirst({
      where: {
        connectionId: connection_id,
        provider: 'TRACKSTAR',
        status: 'ACTIVE',
      },
      include: {
        brand: {
          include: {
            threepl: true,
          },
        },
      },
    });

    if (!integration) {
      const error = `No active Trackstar integration found for connection_id: ${connection_id}`;
      logger.error(error);
      
      // Record the failed event
      await prisma.webhookEventV2.upsert({
        where: { eventId: event_id },
        create: {
          eventId: event_id,
          source: 'trackstar',
          eventType: event_type,
          payload: req.body,
          status: 'failed',
          error,
          attempts: 1,
        },
        update: {
          attempts: { increment: 1 },
          error,
          status: 'failed',
        },
      });

      return res.status(404).json({ error });
    }

    const { brand } = integration;
    const tenantId = brand.threeplId;
    const brandId = brand.id;

    // Generate content-based idempotency key for additional safety
    const idempotencyKey = webhookValidator.generateIdempotencyKey({
      tenantId,
      brandId,
      resource: 'inventory',
      action: event_type,
      payload: data
    });

    // Upsert inventory item
    const inventoryData = {
      tenantId,
      brandId,
      sku: data.sku,
      productName: data.name || null,
      trackstarProductId: data.id,
      trackstarVariantId: null, // Trackstar doesn't seem to have variant concept for inventory
      onHand: data.onhand,
      available: data.fulfillable, // Use fulfillable as available
      incoming: data.awaiting,
      committed: data.committed,
      unfulfillable: data.unfulfillable,
      unsellable: data.unsellable,
      sellable: data.sellable,
      awaiting: data.awaiting,
      unitCost: data.unit_cost || null,
      active: data.active ?? true,
      lastTrackstarUpdateAt: new Date(data.updated_date),
      rawData: data,
    };

    // For multi-warehouse scenarios, we might need to create multiple records
    // For now, create one record per SKU with aggregated quantities
    const warehouseId = Object.keys(data.inventory_by_warehouse_id || {})[0] || null;

    await prisma.inventoryItem.upsert({
      where: {
        tenantId_brandId_sku: {
          tenantId,
          brandId,
          sku: data.sku,
        },
      },
      create: {
        ...inventoryData,
        warehouseId,
      },
      update: {
        ...inventoryData,
        warehouseId,
      },
    });

    const processingTime = Date.now() - startTime;
    
    // Record successful processing with enhanced metadata
    await prisma.webhookEventV2.upsert({
      where: { eventId: event_id },
      create: {
        eventId: event_id,
        source: 'trackstar',
        eventType: event_type,
        tenantId,
        brandId,
        payload: {
          ...req.body,
          _metadata: {
            correlationId,
            idempotencyKey,
            processingTimeMs: processingTime,
            receivedAt: new Date().toISOString()
          }
        },
        status: 'processed',
        processedAt: new Date(),
        attempts: 1,
      },
      update: {
        tenantId,
        brandId,
        status: 'processed',
        processedAt: new Date(),
        attempts: { increment: 1 },
        error: null,
      },
    });

    logger.info('Successfully processed Trackstar inventory webhook', {
      event_id,
      sku: data.sku,
      brandId,
      correlationId,
      idempotencyKey,
      processingTimeMs: processingTime,
      onHand: data.onhand,
      available: data.fulfillable,
    });

    // Emit metrics for monitoring
    // TODO: Replace with actual metrics client
    logger.debug('Webhook metrics', {
      metric: 'webhook.inventory.processed',
      value: 1,
      tags: { tenant: tenantId, brand: brandId, event_type }
    });
    logger.debug('Webhook metrics', {
      metric: 'webhook.processing_latency_ms',
      value: processingTime,
      tags: { tenant: tenantId, brand: brandId, event_type }
    });

    res.status(200).json({ success: true });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('Failed to process Trackstar inventory webhook:', {
      error: error instanceof Error ? error.message : error,
      correlationId,
      processingTimeMs: processingTime
    });

    // Try to record the failed event if we can parse the event_id
    try {
      const eventId = req.body?.event_id;
      if (eventId) {
        await prisma.webhookEventV2.upsert({
          where: { eventId },
          create: {
            eventId,
            source: 'trackstar',
            eventType: req.body?.event_type || 'unknown',
            payload: {
              ...req.body,
              _metadata: {
                correlationId,
                processingTimeMs: Date.now() - startTime,
                failedAt: new Date().toISOString()
              }
            },
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            attempts: 1,
          },
          update: {
            attempts: { increment: 1 },
            error: error instanceof Error ? error.message : 'Unknown error',
            status: 'failed',
          },
        });
      }
    } catch (recordError) {
      logger.error('Failed to record webhook failure:', recordError);
    }

    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
