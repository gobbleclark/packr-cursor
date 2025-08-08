/**
 * ShipHero Webhook Endpoints
 * 
 * Handles all ShipHero webhooks as specified in user requirements:
 * - Order allocation/deallocation webhooks  
 * - Shipment updates
 * - Order cancellation
 * - Purchase Order updates
 */

import { Router } from 'express';
import crypto from 'crypto';
import { IStorage } from '../storage';

export function createShipHeroWebhookRoutes(storage: IStorage): Router {
  const router = Router();

  // Webhook signature verification middleware
  const verifyWebhookSignature = (req: any, res: any, next: any) => {
    const signature = req.get('X-ShipHero-Hmac-Sha256');
    const webhookSecret = process.env.SHIPHERO_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.warn('⚠️ SHIPHERO_WEBHOOK_SECRET not configured - skipping signature verification');
      return next();
    }
    
    if (!signature) {
      console.error('❌ Missing webhook signature');
      return res.status(400).json({ error: 'Missing signature' });
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');
    
    if (signature !== expectedSignature) {
      console.error('❌ Invalid webhook signature');
      return res.status(403).json({ error: 'Invalid signature' });
    }
    
    next();
  };

  /**
   * Order Allocation Webhook - CRITICAL for late shipment tracking
   */
  router.post('/allocation', verifyWebhookSignature, async (req, res) => {
    try {
      const { order_id, allocated_at, line_items } = req.body;
      
      console.log(`📦 Order allocated webhook: ${order_id} at ${allocated_at}`);
      
      // Find order by ShipHero ID
      const order = await storage.getOrderByShipHeroId?.(order_id);
      
      if (!order) {
        console.warn(`⚠️ Order not found for allocation webhook: ${order_id}`);
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Update order allocation timestamp - THIS IS CRITICAL for late order logic
      await storage.updateOrder?.(order.id, {
        allocatedAt: new Date(allocated_at),
        lastSyncAt: new Date()
      });
      
      // Update line item allocation quantities
      if (line_items) {
        for (const item of line_items) {
          await storage.updateOrderItemByShipHeroId?.(item.id, {
            quantityAllocated: item.quantity_allocated || 0,
            fulfillmentStatus: 'allocated'
          });
        }
      }
      
      console.log(`✅ Order ${order.orderNumber} allocation timestamp updated`);
      res.json({ success: true, message: 'Allocation processed' });
      
    } catch (error) {
      console.error('❌ Allocation webhook error:', error);
      res.status(500).json({ error: 'Allocation processing failed' });
    }
  });

  /**
   * Order Deallocation Webhook
   */
  router.post('/deallocation', verifyWebhookSignature, async (req, res) => {
    try {
      const { order_id, deallocated_at, line_items } = req.body;
      
      console.log(`📦 Order deallocated webhook: ${order_id} at ${deallocated_at}`);
      
      const order = await storage.getOrderByShipHeroId?.(order_id);
      
      if (!order) {
        console.warn(`⚠️ Order not found for deallocation webhook: ${order_id}`);
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Clear allocation timestamp since inventory was deallocated
      await storage.updateOrder?.(order.id, {
        allocatedAt: null,
        lastSyncAt: new Date()
      });
      
      // Update line item allocation quantities
      if (line_items) {
        for (const item of line_items) {
          await storage.updateOrderItemByShipHeroId?.(item.id, {
            quantityAllocated: 0,
            fulfillmentStatus: 'pending'
          });
        }
      }
      
      console.log(`✅ Order ${order.orderNumber} deallocation processed`);
      res.json({ success: true, message: 'Deallocation processed' });
      
    } catch (error) {
      console.error('❌ Deallocation webhook error:', error);
      res.status(500).json({ error: 'Deallocation processing failed' });
    }
  });

  /**
   * Shipment Webhook - Updates tracking info and carrier
   */
  router.post('/shipment', verifyWebhookSignature, async (req, res) => {
    try {
      const { 
        shipment_id, 
        order_id, 
        tracking_number, 
        carrier, 
        service_method,
        status,
        shipped_at,
        delivered_at,
        estimated_delivery_date 
      } = req.body;
      
      console.log(`🚚 Shipment webhook: ${shipment_id} for order ${order_id}`);
      
      // Find the order
      const order = await storage.getOrderByShipHeroId?.(order_id);
      
      if (!order) {
        console.warn(`⚠️ Order not found for shipment webhook: ${order_id}`);
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Update or create shipment record
      let shipment = await storage.getShipmentByShipHeroId?.(shipment_id);
      
      if (shipment) {
        // Update existing shipment
        await storage.updateShipment?.(shipment.id, {
          trackingNumber: tracking_number,
          carrier,
          service: service_method,
          status,
          shippedAt: shipped_at ? new Date(shipped_at) : null,
          actualDelivery: delivered_at ? new Date(delivered_at) : null,
          estimatedDelivery: estimated_delivery_date ? new Date(estimated_delivery_date) : null,
          updatedAt: new Date()
        });
      } else {
        // Create new shipment
        await storage.createShipment?.({
          orderId: order.id,
          brandId: order.brandId,
          shipHeroShipmentId: shipment_id,
          trackingNumber: tracking_number,
          carrier,
          service: service_method,
          status,
          shippedAt: shipped_at ? new Date(shipped_at) : null,
          actualDelivery: delivered_at ? new Date(delivered_at) : null,
          estimatedDelivery: estimated_delivery_date ? new Date(estimated_delivery_date) : null
        });
      }
      
      // Update order status if shipped
      if (status === 'shipped' || shipped_at) {
        await storage.updateOrder?.(order.id, {
          status: 'shipped',
          shippedAt: shipped_at ? new Date(shipped_at) : new Date(),
          trackingNumber: tracking_number,
          shippingCarrier: carrier,
          shippingService: service_method,
          lastSyncAt: new Date()
        });
      }
      
      // Update order status if delivered
      if (status === 'delivered' || delivered_at) {
        await storage.updateOrder?.(order.id, {
          status: 'delivered',
          deliveredAt: delivered_at ? new Date(delivered_at) : new Date(),
          lastSyncAt: new Date()
        });
      }
      
      console.log(`✅ Shipment ${tracking_number} processed for order ${order.orderNumber}`);
      res.json({ success: true, message: 'Shipment processed' });
      
    } catch (error) {
      console.error('❌ Shipment webhook error:', error);
      res.status(500).json({ error: 'Shipment processing failed' });
    }
  });

  /**
   * Order Cancellation Webhook
   */
  router.post('/order-canceled', verifyWebhookSignature, async (req, res) => {
    try {
      const { order_id, cancelled_at, cancellation_reason } = req.body;
      
      console.log(`❌ Order cancelled webhook: ${order_id} at ${cancelled_at}`);
      
      const order = await storage.getOrderByShipHeroId?.(order_id);
      
      if (!order) {
        console.warn(`⚠️ Order not found for cancellation webhook: ${order_id}`);
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Update order status to cancelled
      await storage.updateOrder?.(order.id, {
        status: 'cancelled',
        cancelledAt: cancelled_at ? new Date(cancelled_at) : new Date(),
        lastSyncAt: new Date()
      });
      
      // Cancel all related order items
      const orderItems = await storage.getOrderItemsByOrderId?.(order.id) || [];
      for (const item of orderItems) {
        await storage.updateOrderItem?.(item.id, {
          fulfillmentStatus: 'cancelled'
        });
      }
      
      console.log(`✅ Order ${order.orderNumber} marked as cancelled`);
      res.json({ success: true, message: 'Order cancellation processed' });
      
    } catch (error) {
      console.error('❌ Order cancellation webhook error:', error);
      res.status(500).json({ error: 'Cancellation processing failed' });
    }
  });

  /**
   * Purchase Order Update Webhook
   */
  router.post('/po-update', verifyWebhookSignature, async (req, res) => {
    try {
      const { 
        po_id, 
        po_number,
        status, 
        updated_at,
        received_at,
        expected_date,
        line_items 
      } = req.body;
      
      console.log(`📋 Purchase Order update webhook: ${po_number} status: ${status}`);
      
      // Find PO by ShipHero ID
      let purchaseOrder = await storage.getPurchaseOrderByShipHeroId?.(po_id);
      
      if (!purchaseOrder) {
        console.warn(`⚠️ Purchase Order not found: ${po_id}`);
        return res.status(404).json({ error: 'Purchase Order not found' });
      }
      
      // Update PO status and timestamps
      await storage.updatePurchaseOrder?.(purchaseOrder.id, {
        status,
        receivedAt: received_at ? new Date(received_at) : null,
        expectedDate: expected_date ? new Date(expected_date) : null,
        shipHeroUpdatedAt: updated_at ? new Date(updated_at) : new Date(),
        lastSyncAt: new Date()
      });
      
      // Update line items if provided
      if (line_items) {
        for (const item of line_items) {
          await storage.updatePurchaseOrderItemByShipHeroId?.(item.id, {
            quantityReceived: item.quantity_received || 0,
            status: item.status || 'pending'
          });
        }
      }
      
      console.log(`✅ Purchase Order ${po_number} updated to status: ${status}`);
      res.json({ success: true, message: 'Purchase Order update processed' });
      
    } catch (error) {
      console.error('❌ Purchase Order webhook error:', error);
      res.status(500).json({ error: 'Purchase Order update processing failed' });
    }
  });

  /**
   * Generic webhook endpoint for testing/debugging
   */
  router.post('/debug', async (req, res) => {
    console.log('🔍 ShipHero webhook debug payload:', JSON.stringify(req.body, null, 2));
    console.log('🔍 Headers:', req.headers);
    res.json({ success: true, message: 'Debug webhook received' });
  });

  // Health check endpoint
  router.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      service: 'ShipHero Webhooks',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}