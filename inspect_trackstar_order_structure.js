/**
 * Inspect the actual structure of Trackstar orders to understand why we're not seeing recent data
 * This will show us exactly what fields are available and what the data looks like
 */

const { TrackstarService } = await import('./server/services/trackstar.ts');
const { storage } = await import('./server/storage.ts');

async function inspectOrderStructure() {
  console.log('🔍 Inspecting Trackstar order structure...');
  
  try {
    const trackstarService = new TrackstarService();
    const mabeBrand = await storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    
    console.log(`✅ Getting orders from connection: ${mabeBrand.trackstarConnectionId}`);
    
    // Get orders from Trackstar
    const orders = await trackstarService.getOrdersWithToken(
      mabeBrand.trackstarConnectionId,
      mabeBrand.trackstarAccessToken
    );
    
    console.log(`📦 Retrieved ${orders.length} orders`);
    
    if (orders.length > 0) {
      // Show structure of first few orders
      console.log('\n📊 First 3 orders structure:');
      orders.slice(0, 3).forEach((order, index) => {
        console.log(`\n--- Order ${index + 1} ---`);
        console.log('All fields:');
        Object.keys(order).forEach(key => {
          const value = order[key];
          console.log(`  ${key}: ${typeof value} = ${JSON.stringify(value).substring(0, 100)}${JSON.stringify(value).length > 100 ? '...' : ''}`);
        });
      });
      
      // Look for date-related fields
      console.log('\n📅 Date analysis across all orders:');
      const dateFields = [];
      orders.forEach(order => {
        Object.keys(order).forEach(key => {
          if (key.toLowerCase().includes('date') || 
              key.toLowerCase().includes('time') || 
              key.toLowerCase().includes('created') ||
              key.toLowerCase().includes('updated')) {
            if (!dateFields.includes(key)) {
              dateFields.push(key);
            }
          }
        });
      });
      
      console.log(`Date-related fields found: ${dateFields.join(', ')}`);
      
      // Show sample values for each date field
      dateFields.forEach(field => {
        const sampleValues = orders
          .map(o => o[field])
          .filter(v => v != null)
          .slice(0, 5);
        console.log(`${field}: ${JSON.stringify(sampleValues)}`);
      });
      
      // Try to find the most recent orders by trying different date fields
      console.log('\n🔍 Trying different date fields to find recent orders:');
      
      for (const dateField of dateFields) {
        const ordersWithDates = orders
          .filter(o => o[dateField])
          .map(o => ({
            id: o.id || o.order_id || o.order_number || 'unknown',
            date: o[dateField],
            status: o.status || o.fulfillment_status || 'unknown'
          }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 3);
          
        if (ordersWithDates.length > 0) {
          console.log(`\n📅 Most recent by ${dateField}:`);
          ordersWithDates.forEach(order => {
            console.log(`  ${order.id} - ${order.date} - ${order.status}`);
          });
        }
      }
      
      // Check if there are any orders from July/August 2025
      console.log('\n🔍 Checking for July/August 2025 orders:');
      const julyAugOrders = orders.filter(order => {
        const possibleDates = dateFields
          .map(field => order[field])
          .filter(date => date)
          .map(date => new Date(date))
          .filter(date => !isNaN(date.getTime()))
          .filter(date => date.getFullYear() === 2025 && (date.getMonth() === 6 || date.getMonth() === 7)); // July=6, Aug=7
        return possibleDates.length > 0;
      });
      
      console.log(`Found ${julyAugOrders.length} orders from July/August 2025`);
      if (julyAugOrders.length > 0) {
        console.log('July/August orders:', julyAugOrders.slice(0, 5).map(o => ({
          id: o.id || o.order_id,
          dates: dateFields.reduce((acc, field) => {
            if (o[field]) acc[field] = o[field];
            return acc;
          }, {})
        })));
      }
    }
    
  } catch (error) {
    console.error('❌ Inspection failed:', error);
    console.error(error.stack);
  }
}

// Run the inspection
inspectOrderStructure().then(() => {
  console.log('\n🎉 Order structure inspection completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});