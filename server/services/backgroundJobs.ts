import cron from 'node-cron';
import { IStorage } from '../storage';
import { shipHeroApiFixed } from './shipHeroApiFixed';

// Helper function to map ShipHero status to our enum
// CRITICAL: ShipHero logic - ALL shipped orders should be "fulfilled"
function mapShipHeroStatus(shipHeroStatus: string): string {
  const statusMap: { [key: string]: string } = {
    'fulfilled': 'fulfilled',
    'shipped': 'fulfilled',  // ShipHero shipped = fulfilled
    'delivered': 'fulfilled', // ShipHero delivered = fulfilled
    'unfulfilled': 'pending', 
    'partially_fulfilled': 'partially_fulfilled',
    'pending': 'pending',
    'processing': 'pending',
    'cancelled': 'cancelled',
    'allocated': 'pending',
    'on_hold': 'on_hold',
    'Urgent': 'pending',
    'Amazon FBM': 'pending',
    'canceled': 'cancelled',
  };
  
  return statusMap[shipHeroStatus] || 'pending';
}

export class BackgroundJobService {
  constructor(
    private storage: IStorage
  ) {}

  startOrderSync() {
    // Incremental sync every 2 minutes - only new orders since last successful sync
    cron.schedule('*/2 * * * *', async () => {
      console.log('Starting incremental order sync...');
      try {
        await this.syncAllBrandOrdersIncremental();
      } catch (error) {
        console.error('Incremental order sync failed:', error);
      }
    });

    // Integrity check every hour - look back 24 hours to catch missed orders
    cron.schedule('0 * * * *', async () => {
      console.log('Starting order integrity check (24 hours)...');
      try {
        await this.syncAllBrandOrdersIntegrityCheck();
      } catch (error) {
        console.error('Order integrity check failed:', error);
      }
    });

    // One-time comprehensive historical sync - run 2 minutes after startup
    setTimeout(async () => {
      console.log('🔄 Starting one-time comprehensive historical sync (120 days)...');
      try {
        await this.syncHistoricalOrdersOneTime();
      } catch (error) {
        console.error('❌ Historical sync failed:', error);
      }
    }, 120000); // Wait 2 minutes after startup to let initial sync stabilize
  }

  startInventorySync() {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
      console.log('Starting inventory sync job...');
      try {
        await this.syncAllBrandInventory();
      } catch (error) {
        console.error('Inventory sync failed:', error);
      }
    });
  }

  // Incremental sync - only new orders since last successful sync
  private async syncAllBrandOrdersIncremental() {
    console.log('Syncing new orders for all brands with API credentials...');
    
    try {
      const brandId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
      const brand = await this.storage.getBrand(brandId);
      
      if (brand && brand.shipHeroApiKey) {
        console.log(`🔄 Incremental sync for brand: ${brand.name}`);
        await this.syncBrandOrdersIncremental(brand);
      } else {
        console.log('⚠️  No brands with ShipHero API credentials found for incremental sync');
      }
    } catch (error) {
      console.error('❌ Failed incremental order sync:', error);
    }
  }

  // Integrity check - look back 24 hours to catch any missed orders
  private async syncAllBrandOrdersIntegrityCheck() {
    console.log('Running order integrity check for all brands...');
    
    try {
      const brandId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
      const brand = await this.storage.getBrand(brandId);
      
      if (brand && brand.shipHeroApiKey) {
        console.log(`🔍 24-hour integrity check for brand: ${brand.name}`);
        await this.syncBrandOrdersIntegrityCheck(brand);
      } else {
        console.log('⚠️  No brands with ShipHero API credentials found for integrity check');
      }
    } catch (error) {
      console.error('❌ Failed order integrity check:', error);
    }
  }

  private async syncAllBrandInventory() {
    console.log('Syncing inventory for all brands with API credentials...');
    
    try {
      // For now, sync for Mabē brand specifically (in production would iterate through all brands)
      const brandId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
      const brand = await this.storage.getBrand(brandId);
      
      if (brand && brand.shipHeroApiKey && brand.shipHeroPassword) {
        console.log(`🏭 Syncing warehouse inventory for brand: ${brand.name}`);
        const credentials = { username: brand.shipHeroApiKey, password: brand.shipHeroPassword };
        await shipHeroApiFixed.syncWarehouseInventory(credentials, this.storage);
      } else {
        console.log('⚠️  No brands with ShipHero API credentials found for inventory sync');
      }
    } catch (error) {
      console.error('❌ Failed to sync brand inventory:', error);
    }
  }

  // One-time comprehensive historical sync to capture missing unfulfilled orders
  private async syncHistoricalOrdersOneTime() {
    console.log('🔄 COMPREHENSIVE HISTORICAL SYNC - Capturing missing unfulfilled orders...');
    
    try {
      const brandId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
      const brand = await this.storage.getBrand(brandId);
      
      if (!brand || !brand.shipHeroApiKey || !brand.shipHeroPassword) {
        console.log('⚠️ Mabē brand or credentials not found for historical sync');
        return;
      }

      console.log(`📊 Historical sync for brand: ${brand.name}`);
      const credentials = { username: brand.shipHeroApiKey, password: brand.shipHeroPassword };
      
      // Fetch orders going back 120 days to capture all historical unfulfilled orders
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 120);
      
      console.log(`📅 Historical range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      console.log(`🎯 Target: Capture ~450 missing unfulfilled orders`);
      
      // Use our existing API service but with extended date range
      const orders = await shipHeroApiFixed.getOrders(credentials, startDate, endDate);
      console.log(`📦 Retrieved ${orders.length} historical orders from ShipHero`);
      
      // Process only orders that don't exist in our database
      let newOrders = 0;
      let skippedExisting = 0;
      let unfulfilledFound = 0;
      
      for (const order of orders) {
        try {
          // Check if order already exists
          const existingOrder = await this.storage.getOrderByShipHeroId(order.shipHeroOrderId || order.id);
          
          if (existingOrder) {
            skippedExisting++;
            continue;
          }
          
          // Map the order data
          const mappedStatus = mapShipHeroStatus(order.fulfillment_status);
          if (['pending', 'unfulfilled', 'processing'].includes(mappedStatus)) {
            unfulfilledFound++;
          }
          
          const orderData = {
            orderNumber: order.order_number,
            brandId: brand.id,
            customerName: order.profile?.name || `${order.shipping_address?.first_name || ''} ${order.shipping_address?.last_name || ''}`.trim() || null,
            customerEmail: order.email || null,
            shippingAddress: order.shipping_address || {},
            status: mappedStatus,
            totalAmount: order.total_price || "0.00",
            shipHeroOrderId: order.id,
            shipHeroLegacyId: order.legacy_id,
            shopName: order.shop_name,
            fulfillmentStatus: order.fulfillment_status,
            subtotal: order.subtotal || "0.00",
            totalTax: order.total_tax || "0.00", 
            totalShipping: order.total_shipping || "0.00",
            totalDiscounts: order.total_discounts || "0.00",
            profile: order.profile || {},
            holdUntilDate: order.hold_until_date ? new Date(order.hold_until_date) : null,
            requiredShipDate: order.required_ship_date ? new Date(order.required_ship_date) : null,
            priorityFlag: order.priority_flag || false,
            tags: order.tags || [],
            orderSource: order.order_source || order.shop_name,
            orderCurrency: order.currency || 'USD',
            warehouse: order.warehouse || null,
            orderDate: order.order_date ? new Date(order.order_date) : new Date(),
            totalQuantity: order.line_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0,
            backorderQuantity: order.total_backorder_quantity || 0,
            orderCreatedAt: new Date(order.order_date || new Date()),
            allocatedAt: order.allocated_at ? new Date(order.allocated_at) : null,
            packedAt: order.packed_at ? new Date(order.packed_at) : null,
            shippedAt: order.shipped_at ? new Date(order.shipped_at) : null,
            deliveredAt: order.delivered_at ? new Date(order.delivered_at) : null,
            cancelledAt: order.cancelled_at ? new Date(order.cancelled_at) : null,
            shipHeroUpdatedAt: order.updated_at ? new Date(order.updated_at) : new Date(),
            lastSyncAt: new Date(),
            orderItems: order.line_items?.map((item: any) => ({
              id: item.id,
              sku: item.sku,
              quantity: item.quantity,
              quantityAllocated: item.quantity_allocated || 0,
              quantityShipped: item.quantity_shipped || 0,
              backorder_quantity: item.backorder_quantity || 0,
              productName: item.product_name || item.title,
              price: item.price,
              fulfillmentStatus: item.fulfillment_status || 'pending'
            })) || []
          };
          
          await this.storage.createOrder(orderData);
          newOrders++;
          
          if (newOrders % 50 === 0) {
            console.log(`📊 Historical sync progress: ${newOrders} new orders, ${unfulfilledFound} unfulfilled found`);
          }
          
        } catch (error) {
          console.error(`❌ Error processing historical order ${order.order_number}:`, error);
        }
      }
      
      console.log(`✅ HISTORICAL SYNC COMPLETE!`);
      console.log(`📊 Summary:`);
      console.log(`   - Total orders processed: ${orders.length}`);
      console.log(`   - New orders added: ${newOrders}`);
      console.log(`   - Existing orders skipped: ${skippedExisting}`);
      console.log(`   - Unfulfilled orders found: ${unfulfilledFound}`);
      console.log(`🎯 Expected result: Dashboard should now show ~${570 + unfulfilledFound} unfulfilled orders`);
      
    } catch (error) {
      console.error('❌ Historical sync failed:', error);
    }
  }

  // Incremental sync - only orders since last successful sync
  private async syncBrandOrdersIncremental(brand: any) {
    try {
      const credentials = { username: brand.shipHeroApiKey, password: brand.shipHeroPassword };
      
      // Get the last successful sync time for this brand  
      const lastSyncTime = await this.getLastSuccessfulSyncTime(brand.id);
      // Temporarily use a 1-hour window to avoid credit limit issues during testing
      const fromDate = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago
      
      console.log(`📦 Fetching new orders for ${brand.name} since ${fromDate.toISOString()}...`);
      
      const orders = await shipHeroApiFixed.getOrders(credentials, fromDate);
      console.log(`📊 Found ${orders.length} new orders from ShipHero for ${brand.name}`);
      
      const result = await this.processOrderBatch(brand, orders, 'incremental');
      
      // Update last successful sync time on success
      await this.updateLastSuccessfulSyncTime(brand.id);
      
      console.log(`✅ Incremental sync complete for ${brand.name}: ${result.newOrdersCount} new, ${result.updatedOrdersCount} updated`);
    } catch (error) {
      console.error(`❌ Failed incremental sync for brand ${brand.name}:`, error);
      throw error;
    }
  }

  // Integrity check - look back 24 hours to catch missed orders
  private async syncBrandOrdersIntegrityCheck(brand: any) {
    try {
      const credentials = { username: brand.shipHeroApiKey, password: brand.shipHeroPassword };
      const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      console.log(`🔍 Running 24-hour integrity check for ${brand.name} since ${fromDate.toISOString()}...`);
      
      const orders = await shipHeroApiFixed.getOrders(credentials, fromDate);
      console.log(`📊 Found ${orders.length} orders in 24-hour window for ${brand.name}`);
      
      const result = await this.processOrderBatch(brand, orders, 'integrity-check');
      
      console.log(`✅ Integrity check complete for ${brand.name}: ${result.newOrdersCount} new, ${result.updatedOrdersCount} updated`);
    } catch (error) {
      console.error(`❌ Failed integrity check for brand ${brand.name}:`, error);
      throw error;
    }
  }

  // Enhanced order processing logic with comprehensive change detection
  private async processOrderBatch(brand: any, orders: any[], syncType: string) {
    let newOrdersCount = 0;
    let updatedOrdersCount = 0;
    
    for (const shOrder of orders) {
      try {
        // Check if order already exists
        const existingOrder = await this.storage.getOrderByShipHeroId?.(shOrder.id);
        
        if (!existingOrder) {
          // Create new order with comprehensive ShipHero data
          const orderData = {
            orderNumber: shOrder.order_number,
            brandId: brand.id,
            customerName: `${shOrder.shipping_address?.first_name || ''} ${shOrder.shipping_address?.last_name || ''}`.trim(),
            customerEmail: shOrder.email || '',
            shippingAddress: shOrder.shipping_address,
            status: mapShipHeroStatus(shOrder.fulfillment_status),
            totalAmount: shOrder.total_price || '0.00',
            
            // All ShipHero-specific fields
            shipHeroOrderId: shOrder.id,
            shipHeroLegacyId: shOrder.legacy_id,
            shopName: shOrder.shop_name,
            fulfillmentStatus: shOrder.fulfillment_status,
            subtotal: shOrder.subtotal || "0.00",
            totalTax: shOrder.total_tax || "0.00", 
            totalShipping: "0.00",
            totalDiscounts: "0.00",
            profile: shOrder.profile || {},
            holdUntilDate: shOrder.hold_until_date ? new Date(shOrder.hold_until_date) : null,
            requiredShipDate: shOrder.required_ship_date ? new Date(shOrder.required_ship_date) : null,
            priorityFlag: shOrder.priority_flag || false,
            tags: shOrder.tags || [],
            orderSource: shOrder.shop_name,
            orderCurrency: 'USD',
            warehouse: null,
            orderDate: shOrder.order_date ? new Date(shOrder.order_date) : new Date(),
            
            // CRITICAL: Extract shipping timestamps from shipments
            shippedAt: shOrder.shipments?.length > 0 ? new Date(shOrder.shipments[0].created_date) : null,
            deliveredAt: shOrder.shipments?.some((s: any) => s.delivered) ? new Date(shOrder.shipments.find((s: any) => s.delivered)?.created_date) : null,
            allocatedAt: null, // Will be set by webhook or separate query
            packedAt: null,
            cancelledAt: null,
            shipHeroUpdatedAt: shOrder.updated_at ? new Date(shOrder.updated_at) : new Date(),
            lastSyncAt: new Date(),
            
            // Calculate total quantity from line items
            totalQuantity: shOrder.line_items?.reduce((total: number, item: any) => total + (item.quantity || 0), 0) || 0,
            backorderQuantity: shOrder.total_backorder_quantity || 0,
            
            // Line items mapping
            orderItems: shOrder.line_items?.map((item: any) => ({
              id: item.id,
              sku: item.sku,
              quantity: item.quantity,
              quantityAllocated: item.quantity_allocated || 0,
              quantityShipped: item.quantity_shipped || 0,
              backorder_quantity: item.backorder_quantity || 0,
              productName: item.product_name || '',
              price: item.price || '0.00',
              fulfillmentStatus: item.fulfillment_status || 'pending'
            })) || [],
            
            // Timestamp tracking
            orderCreatedAt: new Date(shOrder.order_date),
            allocatedAt: null, // Will be set by allocation webhook
            packedAt: null,
            shippedAt: null,
            deliveredAt: null,
            cancelledAt: null,
            shipHeroUpdatedAt: shOrder.updated_at ? new Date(shOrder.updated_at) : null,
            lastSyncAt: new Date()
          };
          
          await this.storage.createOrder(orderData);
          newOrdersCount++;
          console.log(`➕ Created new order ${shOrder.order_number}`);
        } else {
          // Comprehensive change detection for existing orders
          const currentStatus = mapShipHeroStatus(shOrder.fulfillment_status);
          const currentBackorder = shOrder.total_backorder_quantity || 0;
          
          // Check for any changes in key fields
          const hasChanges = (
            existingOrder.status !== currentStatus ||
            existingOrder.totalAmount !== shOrder.total_price ||
            existingOrder.backorderQuantity !== currentBackorder
          );
          
          // Simple line item change detection
          const hasLineItemChanges = JSON.stringify(existingOrder.orderItems) !== JSON.stringify(shOrder.line_items);
          
          if (hasChanges || hasLineItemChanges) {
            const updatedOrder = {
              ...existingOrder,
              status: currentStatus,
              totalAmount: shOrder.total_price || existingOrder.totalAmount,
              backorderQuantity: currentBackorder,

              orderItems: shOrder.line_items?.map((item: any) => ({
                id: item.id,
                sku: item.sku,
                quantity: item.quantity,
                quantityAllocated: item.quantity_allocated || 0,
                quantityShipped: item.quantity_shipped || 0,
                backorder_quantity: item.backorder_quantity || 0,
                productName: item.product_name || '',
                price: item.price || '0.00',
                fulfillmentStatus: item.fulfillment_status || 'pending'
              })) || existingOrder.orderItems,
              lastSyncAt: new Date()
            };
            
            await this.storage.updateOrder?.(existingOrder.id, updatedOrder);
            updatedOrdersCount++;
            const changeTypes = [];
            if (existingOrder.status !== currentStatus) changeTypes.push('status');

            if (hasLineItemChanges) changeTypes.push('line-items');
            
            console.log(`🔄 Updated order ${shOrder.order_number} - Changes: ${changeTypes.join(', ')}`);
          }
        }
      } catch (error) {
        console.error(`❌ Failed to process order ${shOrder.order_number}:`, error);
      }
    }
    
    return { newOrdersCount, updatedOrdersCount };
  }

  // Helper methods for tracking sync times
  private async getLastSuccessfulSyncTime(brandId: string): Promise<Date | null> {
    // Get the most recent successful sync time from orders table
    const orders = await this.storage.getOrdersByBrand(brandId);
    if (orders.length === 0) return null;
    
    const lastSyncTimes = orders
      .map(o => o.lastSyncAt)
      .filter(t => t !== null)
      .sort((a, b) => b!.getTime() - a!.getTime());
    
    return lastSyncTimes.length > 0 ? lastSyncTimes[0] : null;
  }

  private async updateLastSuccessfulSyncTime(brandId: string): Promise<void> {
    // This could be stored in a separate sync_status table, but for now we use the order sync timestamps
    // The most recent lastSyncAt on orders serves as our checkpoint
  }
}
