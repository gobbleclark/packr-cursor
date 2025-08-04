/**
 * Trigger sync for specific date range to capture order 650411765 from 07/30/2025
 */

import { syncOrdersForBrand } from './server/services/shipHeroApiFixed.js';

async function syncSpecificDateRange() {
  try {
    console.log('🎯 Syncing orders from July 30, 2025 to capture order 650411765...');
    
    // Set date range from July 30, 2025 to August 1, 2025
    const startDate = new Date('2025-07-30T00:00:00Z');
    const endDate = new Date('2025-08-01T23:59:59Z');
    
    console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    const brandId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3'; // Mabē brand ID
    const credentials = {
      username: 'gavin+mabe@boxioship.com',
      password: 'Packr1234!'
    };
    
    console.log('🔄 Starting targeted sync...');
    const result = await syncOrdersForBrand(brandId, credentials, startDate, endDate);
    
    console.log('✅ Sync completed:');
    console.log(`- New orders: ${result.newOrders}`);
    console.log(`- Updated orders: ${result.updatedOrders}`);
    console.log(`- Total processed: ${result.totalProcessed}`);
    
    // Now check if order 650411765 was captured
    console.log('\n🔍 Checking if order 650411765 was captured...');
    
  } catch (error) {
    console.error('❌ Error in targeted sync:', error);
  }
}

syncSpecificDateRange();