/**
 * Webhook handlers for real-time Trackstar updates
 */

import { Router } from 'express';
import { storage } from '../storage.ts';
import { productInventorySync } from '../services/productInventorySync.ts';

const router = Router();

/**
 * Trackstar webhook handler for real-time inventory and product updates
 */
router.post('/trackstar', async (req, res) => {
  try {
    console.log('🔔 Received Trackstar webhook:', req.body);
    
    const { event_type, data, connection_id } = req.body;
    
    if (!event_type || !data) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }
    
    // Find brand by connection ID
    const brands = await storage.getBrandsWithTrackstarConnections();
    const brand = brands.find(b => b.trackstarConnectionId === connection_id);
    
    if (!brand) {
      console.log(`⚠️ No brand found for connection ${connection_id}`);
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    console.log(`📨 Processing ${event_type} webhook for ${brand.name}`);
    
    // Handle different webhook types
    switch (event_type) {
      case 'inventory.updated':
        await handleInventoryUpdate(brand, data);
        break;
        
      case 'product.created':
      case 'product.updated':
        await handleProductUpdate(brand, data);
        break;
        
      case 'order.created':
      case 'order.updated':
        await handleOrderUpdate(brand, data);
        break;
        
      case 'shipment.created':
      case 'shipment.updated':
        await handleShipmentUpdate(brand, data);
        break;
        
      default:
        console.log(`⚠️ Unhandled webhook type: ${event_type}`);
    }
    
    res.status(200).json({ success: true, message: 'Webhook processed' });
    
  } catch (error) {
    console.error('❌ Webhook processing failed:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Handle inventory update webhooks
 */
async function handleInventoryUpdate(brand: any, data: any): Promise<void> {
  try {
    console.log(`📊 Processing inventory update for ${brand.name}`);
    
    const sku = data.sku || data.product_sku || data.product_id;
    if (!sku) {
      console.log('⚠️ No SKU found in inventory webhook data');
      return;
    }
    
    // Find product by SKU
    const product = await storage.getProductBySku(brand.id, sku);
    if (!product) {
      console.log(`⚠️ Product not found for SKU: ${sku}`);
      return;
    }
    
    // Extract inventory count from webhook data
    const inventoryCount = extractInventoryCount(data);
    
    if (inventoryCount !== null) {
      await storage.updateProduct(product.id, {
        inventoryCount: inventoryCount,
        lastSyncAt: new Date()
      });
      
      console.log(`✅ Updated inventory for ${sku}: ${inventoryCount}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to process inventory update:', error.message);
  }
}

/**
 * Handle product update webhooks
 */
async function handleProductUpdate(brand: any, data: any): Promise<void> {
  try {
    console.log(`🏷️ Processing product update for ${brand.name}`);
    
    const trackstarProductId = data.id || data.product_id;
    if (!trackstarProductId) {
      console.log('⚠️ No product ID found in webhook data');
      return;
    }
    
    // Find existing product
    const existingProduct = await storage.getProductByTrackstarId(trackstarProductId);
    
    const productData = {
      brandId: brand.id,
      sku: data.sku || data.product_id,
      name: data.name || data.title || data.description,
      description: data.description || null,
      price: data.price || data.unit_price || null,
      trackstarProductId: trackstarProductId,
      inventoryCount: extractInventoryCount(data),
      lastSyncAt: new Date(),
    };
    
    if (existingProduct) {
      await storage.updateProduct(existingProduct.id, productData);
      console.log(`✅ Updated product: ${productData.sku}`);
    } else {
      await storage.createProduct(productData);
      console.log(`✅ Created product: ${productData.sku}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to process product update:', error.message);
  }
}

/**
 * Handle order update webhooks
 */
async function handleOrderUpdate(brand: any, data: any): Promise<void> {
  try {
    console.log(`📦 Processing order update for ${brand.name}`);
    
    // Trigger a targeted order sync for this specific order
    // This could be implemented to sync just the updated order
    console.log(`📦 Order ${data.order_number || data.id} updated via webhook`);
    
  } catch (error) {
    console.error('❌ Failed to process order update:', error.message);
  }
}

/**
 * Handle shipment update webhooks
 */
async function handleShipmentUpdate(brand: any, data: any): Promise<void> {
  try {
    console.log(`🚚 Processing shipment update for ${brand.name}`);
    
    // Handle shipment status changes, tracking updates, etc.
    console.log(`🚚 Shipment ${data.shipment_id || data.id} updated via webhook`);
    
  } catch (error) {
    console.error('❌ Failed to process shipment update:', error.message);
  }
}

/**
 * Extract inventory count from webhook data
 */
function extractInventoryCount(data: any): number | null {
  const possibleFields = [
    'inventory_count', 'inventory', 'stock', 'quantity', 'available_quantity',
    'on_hand', 'sellable', 'available', 'qty_available', 'total_quantity'
  ];
  
  for (const field of possibleFields) {
    if (data[field] !== undefined && data[field] !== null) {
      const count = parseInt(data[field]);
      if (!isNaN(count)) {
        return count;
      }
    }
  }
  
  return 0;
}

export default router;