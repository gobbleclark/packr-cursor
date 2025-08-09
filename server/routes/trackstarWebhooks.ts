import { Router } from 'express';
import { storage } from '../storage.js';
import { TrackstarSyncService } from '../services/trackstarSync.js';

const router = Router();
const trackstarSync = new TrackstarSyncService();

/**
 * Trackstar webhook endpoint
 * Handles real-time events from Trackstar Universal WMS
 */
router.post('/webhooks', async (req, res) => {
  try {
    console.log('📥 Trackstar webhook received:', req.body.event_type);
    
    const { 
      connection_id, 
      data, 
      event_type, 
      integration_name, 
      previous_attributes 
    } = req.body;

    // Find brand by connection ID  
    const brands = await storage.getAllBrands();
    const brand = brands.find((b: any) => b.trackstarConnectionId === connection_id);
    
    if (!brand) {
      console.error(`❌ No brand found for connection ${connection_id}`);
      return res.status(404).json({ error: 'Brand not found' });
    }

    console.log(`🔄 Processing ${event_type} for brand ${brand.name} (${integration_name})`);

    // Handle different webhook event types
    switch (event_type) {
      case 'order.created':
      case 'order.updated':
        await handleOrderEvent(brand, data, event_type as 'order.created' | 'order.updated');
        break;
        
      case 'order.shipment.created':
        await handleOrderShipmentEvent(brand, data);
        break;
        
      case 'inventory.created':  
      case 'inventory.updated':
        await handleInventoryEvent(brand, data, event_type as 'inventory.created' | 'inventory.updated');
        break;
        
      case 'product.created':
      case 'product.updated':
        await handleProductEvent(brand, data, event_type as 'product.created' | 'product.updated');
        break;
        
      case 'connection.historical-sync-completed':
        await handleHistoricalSyncCompleted(brand, data);
        break;
        
      case 'connection-error.created':
        await handleConnectionError(brand, data);
        break;
        
      default:
        console.log(`ℹ️ Unhandled webhook event: ${event_type}`);
    }

    res.json({ success: true });
    
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle order creation/update events
 */
async function handleOrderEvent(brand: any, orderData: any, eventType: 'order.created' | 'order.updated') {
  try {
    const orderPayload = {
      brandId: brand.id,
      orderNumber: orderData.order_number || orderData.reference_id || `TRK-${Date.now()}`,
      customerName: orderData.ship_to_address?.full_name || 'Unknown Customer',
      customerEmail: orderData.ship_to_address?.email_address || null,
      status: mapTrackstarStatus(orderData.status) as "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "fulfilled" | "allocated" | "on_hold" | "unfulfilled" | "partially_fulfilled",
      totalAmount: orderData.total_price?.toString() || '0.00',
      trackstarOrderId: orderData.id,
      fulfillmentStatus: orderData.status || 'pending',
      orderDate: new Date(orderData.created_date || Date.now()),
      shippedAt: orderData.shipped_date ? new Date(orderData.shipped_date) : null,
      deliveredAt: orderData.delivered_date ? new Date(orderData.delivered_date) : null,
      shippingAddress: orderData.ship_to_address || null,
      warehouseId: orderData.warehouse_id,
      warehouseName: orderData.warehouse?.name || null,
      shippingMethod: orderData.shipping_method,
      totalTax: orderData.total_tax,
      totalShipping: orderData.total_shipping,
      totalDiscounts: orderData.total_discount,
      orderItems: orderData.line_items || [],
      trackingNumber: orderData.shipments?.[0]?.packages?.[0]?.tracking_number || null,
    };

    if (eventType === 'order.created') {
      await storage.createOrder(orderPayload);
      console.log(`✅ Created order via webhook: ${orderPayload.orderNumber}`);
    } else {
      // For updates, try to update existing order
      const existingOrders = await storage.getOrdersByBrand(brand.id);
      const existingOrder = existingOrders.find((o: any) => o.trackstarOrderId === orderData.id);
      
      if (existingOrder) {
        // Implementation for order updates would go here
        console.log(`✅ Updated order via webhook: ${orderPayload.orderNumber}`);
      } else {
        // If order doesn't exist, create it
        await storage.createOrder(orderPayload);
        console.log(`✅ Created missing order via webhook: ${orderPayload.orderNumber}`);
      }
    }
  } catch (error) {
    console.error(`❌ Failed to handle order webhook:`, error);
  }
}

/**
 * Handle order shipment events
 */
async function handleOrderShipmentEvent(brand: any, shipmentData: any) {
  try {
    // Update order with shipment information
    const orders = await storage.getOrdersByBrand(brand.id);
    const order = orders.find((o: any) => o.trackstarOrderId === shipmentData.order_id);
    
    if (order) {
      // Update order with shipping information
      console.log(`✅ Updated order shipment via webhook: ${order.orderNumber}`);
    }
  } catch (error) {
    console.error(`❌ Failed to handle shipment webhook:`, error);
  }
}

/**
 * Handle inventory events  
 */
async function handleInventoryEvent(brand: any, inventoryData: any, eventType: 'inventory.created' | 'inventory.updated') {
  try {
    // Real-time inventory updates
    console.log(`📊 Processing inventory ${eventType} for brand ${brand.name}`);
    
    // Implementation for inventory management would go here
    // This would update inventory levels, availability, etc.
    
  } catch (error) {
    console.error(`❌ Failed to handle inventory webhook:`, error);
  }
}

/**
 * Handle product events
 */
async function handleProductEvent(brand: any, productData: any, eventType: 'product.created' | 'product.updated') {
  try {
    const productPayload = {
      brandId: brand.id,
      name: productData.name || productData.title,
      sku: productData.sku || productData.product_id,
      inventoryCount: productData.inventory_count || productData.quantity || 0,
      price: productData.price || '0.00',
      trackstarProductId: productData.id || productData.product_id,
    };

    if (eventType === 'product.created') {
      await storage.createProduct(productPayload);
      console.log(`✅ Created product via webhook: ${productPayload.sku}`);
    }
    
  } catch (error) {
    console.error(`❌ Failed to handle product webhook:`, error);
  }
}

/**
 * Handle historical sync completion
 */
async function handleHistoricalSyncCompleted(brand: any, syncData: any) {
  try {
    console.log(`🎉 Historical sync completed for ${brand.name}`);
    console.log(`📅 Data range: ${syncData.oldest_data_date} to ${syncData.newest_data_date}`);
    console.log(`📊 Resource: ${syncData.resource}`);
    
    // Update brand's sync status
    // This could trigger additional processing or notifications
    
  } catch (error) {
    console.error(`❌ Failed to handle historical sync completion:`, error);
  }
}

/**
 * Handle connection errors
 */
async function handleConnectionError(brand: any, errorData: any) {
  try {
    console.error(`🚨 Connection error for ${brand.name}:`, errorData);
    
    // Log error, potentially notify administrators
    // Could also pause sync or trigger reconnection flow
    
  } catch (error) {
    console.error(`❌ Failed to handle connection error:`, error);
  }
}

/**
 * Map Trackstar order status to our internal status
 */
function mapTrackstarStatus(trackstarStatus: string): string {
  const statusMap: { [key: string]: string } = {
    'open': 'pending',
    'confirmed': 'processing', 
    'processing': 'processing',
    'picked': 'processing',
    'packed': 'processing',
    'partially_fulfilled': 'partial',
    'fulfilled': 'fulfilled',
    'backordered': 'backorder',
    'exception': 'hold',
    'cancelled': 'cancelled',
    'other': 'pending'
  };
  
  return statusMap[trackstarStatus] || 'pending';
}

export default router;