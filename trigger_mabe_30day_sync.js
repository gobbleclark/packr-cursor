/**
 * Emergency: Directly modify the ShipHero integration to force July sync
 * Uses the working API service to specifically target July 2025
 */

import { shipHeroApiFixed } from './server/services/shipHeroApiFixed.js';
import { drizzleDb } from './server/storage.js';
import { orders, orderItems } from './shared/schema.js';

async function forceMabeJulySync() {
  console.log('🚨 EMERGENCY MABE JULY SYNC');
  console.log('🎯 Direct ShipHero API call for July 1-31, 2025');
  console.log('📊 Target: Capture 14,710+ shipped orders');
  
  try {
    const credentials = {
      username: 'gavin+mabe@boxioship.com',
      password: 'packr2024!'
    };
    
    // Specific July date range
    const julyStart = new Date('2025-07-01T00:00:00.000Z');
    const julyEnd = new Date('2025-07-31T23:59:59.999Z');
    
    console.log(`📅 JULY RANGE: ${julyStart.toISOString()} to ${julyEnd.toISOString()}`);
    
    // Use the working getOrders method but with July start date
    console.log('🔄 Calling ShipHero API for all orders since July 1...');
    const allOrders = await shipHeroApiFixed.getOrders(credentials, julyStart);
    
    console.log(`📦 Retrieved ${allOrders.length} total orders from ShipHero since July 1`);
    
    // Filter specifically for July orders
    const julyOrders = allOrders.filter(order => {
      const orderDate = new Date(order.order_date);
      return orderDate >= julyStart && orderDate <= julyEnd;
    });
    
    console.log(`🎯 July orders found: ${julyOrders.length}`);
    
    const julyShipped = julyOrders.filter(o => o.fulfillment_status === 'fulfilled');
    console.log(`🚢 July shipped: ${julyShipped.length}`);
    
    console.log('\n📋 Sample July orders:');
    julyOrders.slice(0, 10).forEach(order => {
      console.log(`   ${order.order_number} - ${order.order_date} - ${order.fulfillment_status} - $${order.total_price}`);
    });
    
    if (julyShipped.length > 10000) {
      console.log('✅ SUCCESS: Found substantial July shipped orders');
      console.log('🎯 This confirms the 14,710 target is achievable');
    } else {
      console.log('⚠️ Fewer shipped orders than expected');
      console.log('🔍 May need to verify fulfillment status mapping or date range');
    }
    
    // Now process these orders into the database
    console.log('\n💾 Processing July orders into database...');
    
    let processedCount = 0;
    const brandId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
    
    for (const order of julyOrders) {
      try {
        // Check if order already exists
        const existing = await drizzleDb
          .select()
          .from(orders)
          .where(eq(orders.orderNumber, order.order_number))
          .limit(1);
        
        if (existing.length === 0) {
          // Create new order
          const orderData = {
            orderNumber: order.order_number,
            brandId,
            customerName: order.shipping_address ? 
              `${order.shipping_address.first_name || ''} ${order.shipping_address.last_name || ''}`.trim() : 'Unknown',
            customerEmail: order.email || '',
            shippingAddress: order.shipping_address || {},
            status: order.fulfillment_status === 'fulfilled' ? 'shipped' : 'pending',
            totalAmount: order.total_price || '0',
            shipHeroOrderId: order.id,
            shipHeroLegacyId: order.legacy_id,
            shopName: order.shop_name,
            fulfillmentStatus: order.fulfillment_status,
            subtotal: order.subtotal || '0',
            totalTax: order.total_tax || '0',
            totalShipping: '0',
            totalDiscounts: '0',
            profile: order.profile || 'default',
            orderDate: new Date(order.order_date),
            shipHeroUpdatedAt: new Date(order.updated_at || order.order_date),
            lastSyncAt: new Date()
          };
          
          const [newOrder] = await drizzleDb.insert(orders).values(orderData).returning();
          
          // Process line items if any
          if (order.line_items?.edges?.length > 0) {
            const lineItems = order.line_items.edges.map(edge => ({
              orderId: newOrder.id,
              sku: edge.node.sku,
              quantity: edge.node.quantity,
              quantityShipped: edge.node.quantity_shipped || 0,
              quantityAllocated: edge.node.quantity_allocated || 0,
              backorderQuantity: edge.node.backorder_quantity || 0,
              productName: edge.node.product_name,
              price: edge.node.price || '0',
              fulfillmentStatus: edge.node.fulfillment_status || order.fulfillment_status
            }));
            
            await drizzleDb.insert(orderItems).values(lineItems);
          }
          
          processedCount++;
        }
      } catch (error) {
        console.error(`Failed to process order ${order.order_number}:`, error);
      }
    }
    
    console.log(`✅ Processed ${processedCount} new July orders into database`);
    
    return {
      totalOrders: allOrders.length,
      julyOrders: julyOrders.length,
      julyShipped: julyShipped.length,
      processedCount,
      target: 14710,
      gap: 14710 - julyShipped.length
    };
    
  } catch (error) {
    console.error('❌ Emergency July sync failed:', error);
    throw error;
  }
}

forceMabeJulySync().then(results => {
  console.log('\n🎯 EMERGENCY JULY SYNC COMPLETE');
  console.log(`Total orders retrieved: ${results.totalOrders}`);
  console.log(`July orders found: ${results.julyOrders}`);
  console.log(`July shipped: ${results.julyShipped}`);
  console.log(`Processed into DB: ${results.processedCount}`);
  console.log(`Target: ${results.target}`);
  console.log(`Gap: ${results.gap}`);
  
  if (results.julyShipped > 10000) {
    console.log('✅ MAJOR SUCCESS: Substantial July data captured');
  } else {
    console.log('⚠️ May need additional investigation');
  }
  
  process.exit(0);
}).catch(error => {
  console.error('❌ Emergency sync failed:', error);
  process.exit(1);
});