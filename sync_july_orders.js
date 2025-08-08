/**
 * Direct July sync using the working ShipHero integration service
 * Forces the system to capture July 2025 data using existing authentication
 */

import { shipHeroIntegrationService } from './server/services/shipHeroIntegrationService.js';
import { drizzleStorage } from './server/storage.js';

async function syncJulyOrders() {
  console.log('🚨 JULY ORDER SYNC: Using working integration service');
  console.log('🎯 Target: 14,710 shipped orders from July 2025');
  
  try {
    const brandId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
    
    // Check current state
    const currentOrders = await drizzleStorage.getOrders(brandId);
    const julyOrders = currentOrders.filter(order => {
      const orderDate = new Date(order.orderDate);
      return orderDate >= new Date('2025-07-01') && orderDate < new Date('2025-08-01');
    });
    
    console.log(`📊 Current state: ${currentOrders.length} total orders, ${julyOrders.length} July orders`);
    
    if (julyOrders.length === 0) {
      console.log('🚨 CONFIRMED: No July data in database');
      console.log('💡 Solution: Force historical sync with July start date');
      
      // Force a historical sync starting from July 1
      console.log('🔄 Triggering historical sync from July 1, 2025...');
      
      await shipHeroIntegrationService.performHistoricalBackpull(brandId, {
        username: 'gavin+mabe@boxioship.com',
        password: 'packr2024!'
      });
      
      console.log('✅ Historical sync triggered');
      
      // Wait and check results
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
      
      const updatedOrders = await drizzleStorage.getOrders(brandId);
      const updatedJulyOrders = updatedOrders.filter(order => {
        const orderDate = new Date(order.orderDate);
        return orderDate >= new Date('2025-07-01') && orderDate < new Date('2025-08-01');
      });
      
      console.log(`📈 Updated state: ${updatedOrders.length} total orders, ${updatedJulyOrders.length} July orders`);
      
      const julyShipped = updatedJulyOrders.filter(order => 
        order.fulfillmentStatus === 'fulfilled' || order.status === 'shipped'
      );
      
      console.log(`🚢 July shipped orders: ${julyShipped.length}`);
      console.log(`🎯 Target: 14,710`);
      console.log(`📊 Gap: ${14710 - julyShipped.length}`);
      
      return {
        totalOrders: updatedOrders.length,
        julyOrders: updatedJulyOrders.length,
        julyShipped: julyShipped.length,
        gap: 14710 - julyShipped.length
      };
    } else {
      console.log(`✅ July data exists: ${julyOrders.length} orders found`);
      
      const julyShipped = julyOrders.filter(order => 
        order.fulfillmentStatus === 'fulfilled' || order.status === 'shipped'
      );
      
      console.log(`🚢 July shipped: ${julyShipped.length}`);
      console.log(`🎯 Target: 14,710`);
      console.log(`📊 Gap: ${14710 - julyShipped.length}`);
      
      return {
        totalOrders: currentOrders.length,
        julyOrders: julyOrders.length,
        julyShipped: julyShipped.length,
        gap: 14710 - julyShipped.length
      };
    }
    
  } catch (error) {
    console.error('❌ July sync failed:', error);
    throw error;
  }
}

// Execute the sync
syncJulyOrders().then(results => {
  console.log('\n🎯 JULY SYNC RESULTS:');
  console.log(`Total orders: ${results.totalOrders}`);
  console.log(`July orders: ${results.julyOrders}`);
  console.log(`July shipped: ${results.julyShipped}`);
  console.log(`Gap: ${results.gap}`);
  
  if (results.julyShipped > 10000) {
    console.log('✅ MAJOR SUCCESS: Substantial July shipment data captured');
  } else if (results.julyOrders > 5000) {
    console.log('⚠️ PARTIAL: Good July data but may need fulfillment verification');
  } else {
    console.log('❌ CRITICAL: Still missing July data - system needs deeper fix');
  }
  
  process.exit(0);
}).catch(error => {
  console.error('❌ July sync process failed:', error);
  process.exit(1);
});