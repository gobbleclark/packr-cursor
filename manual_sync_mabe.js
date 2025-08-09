#!/usr/bin/env node

// Direct manual sync for Mabē using the Trackstar service
import { TrackstarSyncService } from './server/services/trackstarSync.js';

async function syncMabe() {
  console.log('🔄 Starting manual Mabē sync...');
  
  try {
    const syncService = new TrackstarSyncService();
    await syncService.syncBrandData('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    console.log('✅ Manual sync completed');
  } catch (error) {
    console.error('❌ Manual sync failed:', error.message);
  }
}

syncMabe();