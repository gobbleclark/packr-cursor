/**
 * 30-Day Historical Sync for Mabē Orders
 * Fetches all orders from last 30 days to resolve data discrepancy
 */

const { storage } = require('./server/storage.js');
const ShipHeroService = require('./server/services/shipHeroApiFixed.js');

async function run30DayHistoricalSync() {
  console.log('🔄 Starting 30-day historical sync for Mabē...');
  
  // Calculate 30 days ago
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  console.log(`📅 Sync period: ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  try {
    // Get Mabē brand
    const brands = await storage.getBrandsByThreePL('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    const mabeBrand = brands.find(b => b.name.toLowerCase().includes('mabē') || b.name.toLowerCase().includes('mabe'));
    
    if (!mabeBrand) {
      console.error('❌ Mabē brand not found');
      return;
    }
    
    console.log(`🏢 Found Mabē brand: ${mabeBrand.name} (${mabeBrand.id})`);
    
    // Get ShipHero credentials
    if (!mabeBrand.shipHeroUsername || !mabeBrand.shipHeroPassword) {
      console.error('❌ ShipHero credentials not found for Mabē');
      return;
    }
    
    const credentials = {
      username: mabeBrand.shipHeroUsername,
      password: mabeBrand.shipHeroPassword
    };
    
    console.log(`🔐 Using credentials: ${credentials.username}`);
    
    // Initialize ShipHero service
    const shipHeroService = new ShipHeroService();
    
    // Fetch orders with smart pagination and credit management
    console.log('📦 Fetching 30-day order history from ShipHero...');
    const orders = await shipHeroService.getOrders(startDate, endDate, credentials);
    
    console.log(`📊 Retrieved ${orders.length} orders from ShipHero`);
    
    // Process and sync orders
    let newOrders = 0;
    let updatedOrders = 0;
    let statusCounts = {};
    
    for (const shipHeroOrder of orders) {
      try {
        // Map ShipHero status to our internal status
        const mappedStatus = mapShipHeroStatus(shipHeroOrder.fulfillment_status);
        
        // Count statuses
        statusCounts[mappedStatus] = (statusCounts[mappedStatus] || 0) + 1;
        
        // Check if order exists
        const existingOrder = await storage.getOrderByShipHeroId(shipHeroOrder.id);
        
        const orderData = {
          orderNumber: shipHeroOrder.order_number,
          brandId: mabeBrand.id,
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
    
    console.log('✅ 30-day historical sync complete!');
    console.log(`📊 Summary:`);
    console.log(`   - Total orders processed: ${orders.length}`);
    console.log(`   - New orders: ${newOrders}`);
    console.log(`   - Updated orders: ${updatedOrders}`);
    console.log(`   - Status breakdown:`, statusCounts);
    
    // Check final database counts
    const finalStats = await storage.getDashboardStatsWithDateRange(
      '41977719', // Your user ID
      { start: startDate, end: endDate },
      mabeBrand.id
    );
    
    console.log(`📈 Final 30-day stats for Mabē:`);
    console.log(`   - Shipped Orders: ${finalStats.shippedOrders}`);
    console.log(`   - Unfulfilled Orders: ${finalStats.unfulfilledOrders}`);
    console.log(`   - Orders on Hold: ${finalStats.ordersOnHold}`);
    console.log(`   - Total Orders: ${finalStats.totalOrders}`);
    
  } catch (error) {
    console.error('❌ 30-day historical sync failed:', error);
  }
}

function mapShipHeroStatus(shipHeroStatus) {
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
    'Urgent': 'pending', // Map unknown statuses to pending
  };
  
  return statusMap[shipHeroStatus] || 'pending';
}

// Run the sync
run30DayHistoricalSync().catch(console.error);