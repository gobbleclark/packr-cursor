/**
 * Migration script to move order items from JSON to separate table
 * This will migrate all existing orders to use the new order_items table structure
 */

import { Pool } from '@neondatabase/serverless';
import ws from "ws";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrateOrderItems() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting order items migration...');
    
    // Get all orders with JSON order_items
    const ordersQuery = `
      SELECT id, order_number, order_items 
      FROM orders 
      WHERE order_items IS NOT NULL 
        AND jsonb_array_length(order_items) > 0
    `;
    
    const orders = await client.query(ordersQuery);
    console.log(`📦 Found ${orders.rows.length} orders with line items to migrate`);
    
    let migratedCount = 0;
    let totalItems = 0;
    
    for (const order of orders.rows) {
      try {
        const orderItems = JSON.parse(JSON.stringify(order.order_items));
        
        for (const item of orderItems) {
          const orderItemData = {
            order_id: order.id,
            ship_hero_line_item_id: item.id || null,
            sku: item.sku || '',
            product_name: item.productName || item.title || item.name || 'Unknown Product',
            quantity: parseInt(item.quantity) || 1,
            quantity_allocated: parseInt(item.quantityAllocated) || parseInt(item.quantity_allocated) || 0,
            quantity_shipped: parseInt(item.quantityShipped) || parseInt(item.quantity_shipped) || 0,
            backorder_quantity: parseInt(item.backorderQuantity) || parseInt(item.backorder_quantity) || 0,
            unit_price: parseFloat(item.price) || 0,
            total_price: (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1),
            fulfillment_status: item.fulfillmentStatus || item.fulfillment_status || 'pending',
            warehouse_id: item.warehouseId || null
          };
          
          const insertQuery = `
            INSERT INTO order_items (
              order_id, ship_hero_line_item_id, sku, product_name, quantity,
              quantity_allocated, quantity_shipped, backorder_quantity, 
              unit_price, total_price, fulfillment_status, warehouse_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `;
          
          await client.query(insertQuery, [
            orderItemData.order_id,
            orderItemData.ship_hero_line_item_id,
            orderItemData.sku,
            orderItemData.product_name,
            orderItemData.quantity,
            orderItemData.quantity_allocated,
            orderItemData.quantity_shipped,
            orderItemData.backorder_quantity,
            orderItemData.unit_price,
            orderItemData.total_price,
            orderItemData.fulfillment_status,
            orderItemData.warehouse_id
          ]);
          
          totalItems++;
        }
        
        migratedCount++;
        
        if (migratedCount % 100 === 0) {
          console.log(`📊 Progress: ${migratedCount}/${orders.rows.length} orders migrated (${totalItems} line items)`);
        }
        
      } catch (error) {
        console.error(`❌ Error migrating order ${order.order_number}:`, error);
      }
    }
    
    console.log(`✅ Migration complete!`);
    console.log(`📊 Summary:`);
    console.log(`   - Orders migrated: ${migratedCount}/${orders.rows.length}`);
    console.log(`   - Total line items created: ${totalItems}`);
    
    // Verify the migration
    const verifyQuery = `
      SELECT 
        COUNT(DISTINCT order_id) as orders_with_items,
        COUNT(*) as total_line_items
      FROM order_items
    `;
    
    const verification = await client.query(verifyQuery);
    console.log(`🔍 Verification:`);
    console.log(`   - Orders with line items in new table: ${verification.rows[0].orders_with_items}`);
    console.log(`   - Total line items in new table: ${verification.rows[0].total_line_items}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
migrateOrderItems();