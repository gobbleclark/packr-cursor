/**
 * Manual 30-day historical sync for Mabē
 * Run this script to trigger a comprehensive sync
 */

import { DatabaseStorage } from './server/storage.js';
import ShipHeroService from './server/services/shipHeroApiFixed.js';

const storage = new DatabaseStorage();

async function run30DaySync() {
  console.log('🔄 Starting manual 30-day sync for Mabē...');
  
  try {
    // Get Mabē brand
    const brand = await storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    
    if (!brand) {
      console.error('❌ Mabē brand not found');
      return;
    }
    
    console.log(`🏢 Found brand: ${brand.name}`);
    
    if (!brand.shipHeroUsername || !brand.shipHeroPassword) {
      console.error('❌ ShipHero credentials not found');
      return;
    }
    
    const credentials = {
      username: brand.shipHeroUsername,
      password: brand.shipHeroPassword
    };
    
    // Calculate 30-day range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    console.log(`📅 Sync range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Get orders from ShipHero
    const shipHeroService = new ShipHeroService();
    const orders = await shipHeroService.getOrders(startDate, endDate, credentials);
    
    console.log(`📦 Retrieved ${orders.length} orders from ShipHero`);
    
    // Process orders
    let newOrders = 0;
    let updatedOrders = 0;
    const statusCounts = {};
    
    for (const shipHeroOrder of orders) {
      try {
        const mappedStatus = mapShipHeroStatus(shipHeroOrder.fulfillment_status);
        statusCounts[mappedStatus] = (statusCounts[mappedStatus] || 0) + 1;
        
        const existingOrder = await storage.getOrderByShipHeroId(shipHeroOrder.id);
        
        const orderData = {
          orderNumber: shipHeroOrder.order_number,
          brandId: brand.id,
          customerName: shipHeroOrder.profile?.name || null,
          customerEmail: shipHeroOrder.email || null,
          shippingAddress: shipHeroOrder.shipping_address || {},
          status: mappedStatus,
          totalAmount: shipHeroOrder.total_price || "0.00",
          orderItems: shipHeroOrder.line_items?.map(item => ({
            id: item.id,
            sku: item.sku,
            quantity: item.quantity,
            quantityAllocated: item.quantity_allocated || 0,
            quantityShipped: item.quantity_shipped || 0,
            backorder_quantity: item.backorder_quantity || 0,
            productName: item.title,
            price: item.price,
            fulfillmentStatus: item.fulfillment_status || 'pending'
          })) || [],
          shipHeroOrderId: shipHeroOrder.id,
          backorderQuantity: shipHeroOrder.total_backorder_quantity || 0,
          orderCreatedAt: new Date(shipHeroOrder.order_date),
          allocatedAt: shipHeroOrder.allocated_at ? new Date(shipHeroOrder.allocated_at) : null,
          shippedAt: shipHeroOrder.shipped_at ? new Date(shipHeroOrder.shipped_at) : null,
          priorityFlag: shipHeroOrder.priority_flag || false,
          tags: shipHeroOrder.tags || [],
          lastSyncAt: new Date()
        };
        
        if (existingOrder) {
          await storage.updateOrder(existingOrder.id, orderData);
          updatedOrders++;
        } else {
          await storage.createOrder(orderData);
          newOrders++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing order ${shipHeroOrder.order_number}:`, error);
      }
    }
    
    console.log(`✅ 30-day sync complete!`);
    console.log(`📊 Summary: ${newOrders} new, ${updatedOrders} updated`);
    console.log(`📈 Status counts:`, statusCounts);
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
}

function mapShipHeroStatus(status) {
  const statusMap = {
    'fulfilled': 'fulfilled',
    'unfulfilled': 'unfulfilled',
    'partially_fulfilled': 'partially_fulfilled',
    'pending': 'pending',
    'processing': 'processing',
    'shipped': 'shipped',
    'delivered': 'delivered',
    'cancelled': 'cancelled',
    'allocated': 'allocated',
    'on_hold': 'on_hold',
    'Urgent': 'pending'
  };
  
  return statusMap[status] || 'pending';
}

run30DaySync();