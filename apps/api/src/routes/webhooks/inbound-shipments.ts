import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/database';
import { logger } from '../../utils/logger';
import { createTrackstarWebhookValidator, webhookValidationMiddleware } from '../../lib/webhook-validation';

const router = Router();

// Initialize webhook validator
const webhookValidator = createTrackstarWebhookValidator();

// Validation schema for Trackstar inbound shipment webhook
const trackstarInboundShipmentWebhookSchema = z.object({
  event_id: z.string(),
  event_type: z.string(),
  connection_id: z.string(),
  integration_name: z.string(),
  data: z.object({
    id: z.string(),
    tracking_number: z.string().optional(),
    reference_number: z.string().optional(),
    status: z.string(),
    expected_date: z.string().optional(),
    received_date: z.string().optional(),
    carrier_name: z.string().optional(),
    tracking_url: z.string().optional(),
    destination_location_id: z.string().optional(),
    destination_address: z.object({
      name: z.string().optional(),
      address1: z.string().optional(),
      address2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
    }).optional(),
    line_items: z.array(z.object({
      sku: z.string(),
      product_name: z.string().optional(),
      expected_quantity: z.number(),
      received_quantity: z.number().default(0),
      unit_cost: z.number().optional(),
      total_cost: z.number().optional(),
    })).optional(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
});

// Validation schema for Trackstar inbound shipment receipt webhook
const trackstarInboundShipmentReceiptWebhookSchema = z.object({
  event_id: z.string(),
  event_type: z.string(),
  connection_id: z.string(),
  integration_name: z.string(),
  data: z.object({
    id: z.string(),
    inbound_shipment_id: z.string(),
    received_date: z.string(),
    received_by: z.string().optional(),
    notes: z.string().optional(),
    line_items: z.array(z.object({
      sku: z.string(),
      received_quantity: z.number(),
      unit_cost: z.number().optional(),
    })).optional(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
});

// Inbound Shipment Created/Updated Webhook
router.post('/trackstar/inbound-shipments', 
  webhookValidationMiddleware(webhookValidator),
  async (req, res) => {
    try {
      logger.info('Received inbound shipment webhook:', {
        event_type: req.body.event_type,
        event_id: req.body.event_id,
        connection_id: req.body.connection_id,
      });

      // Validate the webhook payload
      const validatedData = trackstarInboundShipmentWebhookSchema.parse(req.body);
      const { event_type, connection_id, data: shipmentData } = validatedData;

      // Find the brand integration by connection_id
      const integration = await prisma.brandIntegration.findFirst({
        where: {
          connectionId: connection_id,
          provider: 'TRACKSTAR',
        },
        include: {
          brand: {
            include: {
              threepl: true,
            },
          },
        },
      });

      if (!integration || !integration.brand) {
        logger.warn(`No integration found for connection_id: ${connection_id}`);
        return res.status(200).json({ 
          success: true, 
          message: 'No matching integration found' 
        });
      }

      const brand = integration.brand;
      logger.info(`Processing inbound shipment webhook for brand: ${brand.name} (${brand.id})`);

      // Map Trackstar status to our enum
      const statusMapping: { [key: string]: string } = {
        'pending': 'PENDING',
        'in_transit': 'IN_TRANSIT',
        'received': 'RECEIVED',
        'cancelled': 'CANCELLED',
        'partial': 'PARTIAL',
      };

      const status = statusMapping[shipmentData.status?.toLowerCase()] || 'PENDING';

      // Find or create warehouse if location is provided
      let warehouseId: string | undefined;
      if (shipmentData.destination_location_id) {
        const warehouse = await prisma.warehouse.findFirst({
          where: {
            tenantId: brand.threeplId,
            externalId: shipmentData.destination_location_id,
          },
        });
        warehouseId = warehouse?.id;
      }

      // Calculate total items from line items
      const totalItems = shipmentData.line_items?.reduce((sum, item) => sum + item.expected_quantity, 0) || 0;
      const receivedItems = shipmentData.line_items?.reduce((sum, item) => sum + item.received_quantity, 0) || 0;

      // Upsert the inbound shipment
      const inboundShipment = await prisma.inboundShipment.upsert({
        where: {
          threeplId_externalId: {
            threeplId: brand.threeplId,
            externalId: shipmentData.id,
          },
        },
        update: {
          status: status as any,
          trackingNumber: shipmentData.tracking_number,
          referenceNumber: shipmentData.reference_number,
          expectedDate: shipmentData.expected_date ? new Date(shipmentData.expected_date) : undefined,
          receivedDate: shipmentData.received_date ? new Date(shipmentData.received_date) : undefined,
          carrierName: shipmentData.carrier_name,
          trackingUrl: shipmentData.tracking_url,
          warehouseId,
          totalItems,
          receivedItems,
          destinationAddress: shipmentData.destination_address || undefined,
          rawData: shipmentData,
          updatedAtRemote: new Date(shipmentData.updated_at),
        },
        create: {
          threeplId: brand.threeplId,
          brandId: brand.id,
          externalId: shipmentData.id,
          status: status as any,
          trackingNumber: shipmentData.tracking_number,
          referenceNumber: shipmentData.reference_number,
          expectedDate: shipmentData.expected_date ? new Date(shipmentData.expected_date) : undefined,
          receivedDate: shipmentData.received_date ? new Date(shipmentData.received_date) : undefined,
          carrierName: shipmentData.carrier_name,
          trackingUrl: shipmentData.tracking_url,
          warehouseId,
          totalItems,
          receivedItems,
          destinationAddress: shipmentData.destination_address || undefined,
          rawData: shipmentData,
          updatedAtRemote: new Date(shipmentData.updated_at),
        },
      });

      // Process line items
      if (shipmentData.line_items && Array.isArray(shipmentData.line_items)) {
        for (const lineItem of shipmentData.line_items) {
          await prisma.inboundShipmentItem.upsert({
            where: {
              inboundShipmentId_sku: {
                inboundShipmentId: inboundShipment.id,
                sku: lineItem.sku,
              },
            },
            update: {
              productName: lineItem.product_name,
              expectedQuantity: lineItem.expected_quantity,
              receivedQuantity: lineItem.received_quantity,
              unitCost: lineItem.unit_cost,
              totalCost: lineItem.total_cost,
              metadata: lineItem,
            },
            create: {
              inboundShipmentId: inboundShipment.id,
              sku: lineItem.sku,
              productName: lineItem.product_name,
              expectedQuantity: lineItem.expected_quantity,
              receivedQuantity: lineItem.received_quantity,
              unitCost: lineItem.unit_cost,
              totalCost: lineItem.total_cost,
              metadata: lineItem,
            },
          });
        }
      }

      // Log the webhook event
      await prisma.webhookEventV2.create({
        data: {
          threeplId: brand.threeplId,
          brandId: brand.id,
          eventId: validatedData.event_id,
          eventType: event_type,
          provider: 'TRACKSTAR',
          connectionId: connection_id,
          integrationName: validatedData.integration_name,
          status: 'SUCCESS',
          payload: validatedData,
          processedAt: new Date(),
        },
      });

      logger.info(`Successfully processed inbound shipment webhook: ${event_type} for shipment ${shipmentData.id}`);

      res.json({ 
        success: true, 
        message: 'Inbound shipment webhook processed successfully',
        shipmentId: inboundShipment.id,
      });
    } catch (error) {
      logger.error('Failed to process inbound shipment webhook:', error);

      // Try to log the failed webhook event if we have enough info
      try {
        if (req.body?.connection_id) {
          const integration = await prisma.brandIntegration.findFirst({
            where: {
              connectionId: req.body.connection_id,
              provider: 'TRACKSTAR',
            },
            include: { brand: true },
          });

          if (integration?.brand) {
            await prisma.webhookEventV2.create({
              data: {
                threeplId: integration.brand.threeplId,
                brandId: integration.brand.id,
                eventId: req.body.event_id || 'unknown',
                eventType: req.body.event_type || 'inbound-shipment.webhook',
                provider: 'TRACKSTAR',
                connectionId: req.body.connection_id,
                integrationName: req.body.integration_name || 'unknown',
                status: 'FAILED',
                payload: req.body,
                error: error instanceof Error ? error.message : 'Unknown error',
                processedAt: new Date(),
              },
            });
          }
        }
      } catch (logError) {
        logger.error('Failed to log webhook error:', logError);
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to process inbound shipment webhook',
      });
    }
  }
);

// Inbound Shipment Receipt Created Webhook
router.post('/trackstar/inbound-shipment-receipts', 
  webhookValidationMiddleware(webhookValidator),
  async (req, res) => {
    try {
      logger.info('Received inbound shipment receipt webhook:', {
        event_type: req.body.event_type,
        event_id: req.body.event_id,
        connection_id: req.body.connection_id,
      });

      // Validate the webhook payload
      const validatedData = trackstarInboundShipmentReceiptWebhookSchema.parse(req.body);
      const { event_type, connection_id, data: receiptData } = validatedData;

      // Find the brand integration by connection_id
      const integration = await prisma.brandIntegration.findFirst({
        where: {
          connectionId: connection_id,
          provider: 'TRACKSTAR',
        },
        include: {
          brand: {
            include: {
              threepl: true,
            },
          },
        },
      });

      if (!integration || !integration.brand) {
        logger.warn(`No integration found for connection_id: ${connection_id}`);
        return res.status(200).json({ 
          success: true, 
          message: 'No matching integration found' 
        });
      }

      const brand = integration.brand;
      logger.info(`Processing inbound shipment receipt webhook for brand: ${brand.name} (${brand.id})`);

      // Find the inbound shipment
      const inboundShipment = await prisma.inboundShipment.findFirst({
        where: {
          threeplId: brand.threeplId,
          externalId: receiptData.inbound_shipment_id,
        },
      });

      if (!inboundShipment) {
        logger.warn(`Inbound shipment not found: ${receiptData.inbound_shipment_id}`);
        return res.status(200).json({ 
          success: true, 
          message: 'Inbound shipment not found' 
        });
      }

      // Create the receipt record
      const receipt = await prisma.inboundShipmentReceipt.upsert({
        where: {
          inboundShipmentId_externalId: {
            inboundShipmentId: inboundShipment.id,
            externalId: receiptData.id,
          },
        },
        update: {
          receivedDate: new Date(receiptData.received_date),
          receivedBy: receiptData.received_by,
          notes: receiptData.notes,
          rawData: receiptData,
        },
        create: {
          inboundShipmentId: inboundShipment.id,
          externalId: receiptData.id,
          receivedDate: new Date(receiptData.received_date),
          receivedBy: receiptData.received_by,
          notes: receiptData.notes,
          rawData: receiptData,
        },
      });

      // Update received quantities on the shipment items if provided
      if (receiptData.line_items && Array.isArray(receiptData.line_items)) {
        for (const lineItem of receiptData.line_items) {
          await prisma.inboundShipmentItem.updateMany({
            where: {
              inboundShipmentId: inboundShipment.id,
              sku: lineItem.sku,
            },
            data: {
              receivedQuantity: lineItem.received_quantity,
              unitCost: lineItem.unit_cost || undefined,
            },
          });
        }

        // Recalculate total received items for the shipment
        const updatedItems = await prisma.inboundShipmentItem.findMany({
          where: {
            inboundShipmentId: inboundShipment.id,
          },
        });

        const totalReceivedItems = updatedItems.reduce((sum, item) => sum + item.receivedQuantity, 0);
        const totalExpectedItems = updatedItems.reduce((sum, item) => sum + item.expectedQuantity, 0);

        // Update shipment status based on received quantities
        let newStatus = inboundShipment.status;
        if (totalReceivedItems === 0) {
          newStatus = 'PENDING';
        } else if (totalReceivedItems >= totalExpectedItems) {
          newStatus = 'RECEIVED';
        } else {
          newStatus = 'PARTIAL';
        }

        await prisma.inboundShipment.update({
          where: { id: inboundShipment.id },
          data: {
            receivedItems: totalReceivedItems,
            status: newStatus as any,
            receivedDate: new Date(receiptData.received_date),
          },
        });
      }

      // Log the webhook event
      await prisma.webhookEventV2.create({
        data: {
          threeplId: brand.threeplId,
          brandId: brand.id,
          eventId: validatedData.event_id,
          eventType: event_type,
          provider: 'TRACKSTAR',
          connectionId: connection_id,
          integrationName: validatedData.integration_name,
          status: 'SUCCESS',
          payload: validatedData,
          processedAt: new Date(),
        },
      });

      logger.info(`Successfully processed inbound shipment receipt webhook: ${event_type} for receipt ${receiptData.id}`);

      res.json({ 
        success: true, 
        message: 'Inbound shipment receipt webhook processed successfully',
        receiptId: receipt.id,
      });
    } catch (error) {
      logger.error('Failed to process inbound shipment receipt webhook:', error);

      // Try to log the failed webhook event
      try {
        if (req.body?.connection_id) {
          const integration = await prisma.brandIntegration.findFirst({
            where: {
              connectionId: req.body.connection_id,
              provider: 'TRACKSTAR',
            },
            include: { brand: true },
          });

          if (integration?.brand) {
            await prisma.webhookEventV2.create({
              data: {
                threeplId: integration.brand.threeplId,
                brandId: integration.brand.id,
                eventId: req.body.event_id || 'unknown',
                eventType: req.body.event_type || 'inbound-shipment-receipt.webhook',
                provider: 'TRACKSTAR',
                connectionId: req.body.connection_id,
                integrationName: req.body.integration_name || 'unknown',
                status: 'FAILED',
                payload: req.body,
                error: error instanceof Error ? error.message : 'Unknown error',
                processedAt: new Date(),
              },
            });
          }
        }
      } catch (logError) {
        logger.error('Failed to log webhook error:', logError);
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to process inbound shipment receipt webhook',
      });
    }
  }
);

export default router;
