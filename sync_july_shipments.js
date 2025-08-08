/**
 * Emergency July shipment sync to match ShipHero's 14,710 shipped orders
 * This will do a comprehensive pull of all July 2025 shipments from ShipHero
 */

import { shipHeroApiFixed } from './server/services/shipHeroApiFixed.js';
import { storage } from './server/storage.js';

async function syncJulyShipments() {
  console.log('🚨 EMERGENCY: Syncing July 2025 shipments to match ShipHero data...');
  console.log('🎯 Target: 14,710 orders shipped in July 2025');
  
  try {
    const mabeId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
    const credentials = {
      username: 'gavin+mabe@boxioship.com',
      password: process.env.MABE_SHIPHERO_PASSWORD || 'packr2024!'
    };
    
    // July 2025 date range
    const julyStart = new Date('2025-07-01T00:00:00.000Z');
    const julyEnd = new Date('2025-07-31T23:59:59.999Z');
    
    console.log(`📅 Fetching ALL shipments for July 2025: ${julyStart.toISOString()} to ${julyEnd.toISOString()}`);
    
    // Get shipments from ShipHero for July
    const shipments = await shipHeroApiFixed.getShipments(credentials, julyStart, julyEnd);
    
    console.log(`📦 CRITICAL: Found ${shipments.length} shipments from ShipHero for July 2025`);
    
    if (shipments.length < 10000) {
      console.warn(`⚠️ WARNING: Only found ${shipments.length} shipments, expected ~14,710`);
      console.log('🔍 This might indicate:');
      console.log('  1. API pagination issue');
      console.log('  2. Date range problem');
      console.log('  3. Authentication issue');
      console.log('  4. ShipHero API filtering');
    }
    
    // Analyze shipment data
    const uniqueOrders = new Set();
    const dailyBreakdown = {};
    
    shipments.forEach(shipment => {
      if (shipment.order_number) {
        uniqueOrders.add(shipment.order_number);
      }
      
      const shippedDate = new Date(shipment.shipped_date || shipment.created_at);
      const dateKey = shippedDate.toISOString().split('T')[0];
      
      if (!dailyBreakdown[dateKey]) {
        dailyBreakdown[dateKey] = 0;
      }
      dailyBreakdown[dateKey]++;
    });
    
    console.log(`📊 ANALYSIS:`);
    console.log(`  Total shipment records: ${shipments.length}`);
    console.log(`  Unique orders shipped: ${uniqueOrders.size}`);
    
    // Show daily breakdown
    console.log('📅 Daily breakdown:');
    Object.keys(dailyBreakdown)
      .sort()
      .forEach(date => {
        if (dailyBreakdown[date] > 0) {
          console.log(`  ${date}: ${dailyBreakdown[date]} shipments`);
        }
      });
    
    return {
      totalShipments: shipments.length,
      uniqueOrders: uniqueOrders.size,
      expectedOrders: 14710,
      gap: 14710 - uniqueOrders.size
    };
    
  } catch (error) {
    console.error('❌ July shipment sync failed:', error);
    throw error;
  }
}

syncJulyShipments().then(results => {
  console.log('\n🎯 JULY SYNC RESULTS:');
  console.log(`Expected: ${results.expectedOrders} shipped orders`);
  console.log(`Found: ${results.uniqueOrders} unique orders`);
  console.log(`Gap: ${results.gap} orders missing`);
  
  if (results.gap > 1000) {
    console.log('\n🚨 CRITICAL GAP DETECTED - Need to investigate:');
    console.log('1. Check if we need to query orders instead of shipments');
    console.log('2. Verify date range interpretation');
    console.log('3. Check if multiple shipments per order');
    console.log('4. Verify ShipHero API pagination limits');
  }
  
  process.exit(0);
}).catch(error => {
  console.error('❌ Critical sync failure:', error);
  process.exit(1);
});