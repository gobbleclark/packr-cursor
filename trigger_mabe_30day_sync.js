/**
 * Manual 30-day historical sync for Mabē brand
 * This script triggers a comprehensive historical backpull
 */

const { BackgroundJobService } = require('./server/services/backgroundJobs');
const { storage } = require('./server/storage');

async function triggerMabe30DaySync() {
  console.log('🚀 Starting 30-day historical sync for Mabē...');
  
  try {
    const backgroundJobService = new BackgroundJobService(storage);
    
    // Get Mabē brand
    const mabeId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
    const brand = await storage.getBrand(mabeId);
    
    if (!brand) {
      console.error('❌ Mabē brand not found');
      return;
    }
    
    if (!brand.shipHeroApiKey || !brand.shipHeroPassword) {
      console.error('❌ ShipHero credentials not configured for Mabē');
      return;
    }
    
    console.log(`✅ Found brand: ${brand.name}`);
    console.log(`🔑 Using credentials: ${brand.shipHeroApiKey}`);
    
    // Trigger 30-day historical sync
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    console.log(`📅 Syncing from: ${thirtyDaysAgo.toISOString()}`);
    
    await backgroundJobService.syncBrandOrdersHistorical(brand, thirtyDaysAgo);
    
    console.log('✅ 30-day historical sync completed successfully!');
    
  } catch (error) {
    console.error('❌ 30-day sync failed:', error);
  }
  
  process.exit(0);
}

triggerMabe30DaySync();