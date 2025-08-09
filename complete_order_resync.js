/**
 * Complete order resync to get all 18,603 missing orders into the database
 * This will properly sync all orders using the fixed pagination
 */

const { TrackstarSyncService } = await import('./server/services/trackstarSync.ts');

async function completeResync() {
  console.log('🔄 Starting complete order resync with fixed pagination...');
  
  try {
    const syncService = new TrackstarSyncService();
    
    // Sync all brands (which will now use the fixed pagination)
    await syncService.syncAllTrackstarBrands();
    
    console.log('✅ Complete resync finished!');
    
  } catch (error) {
    console.error('❌ Complete resync failed:', error);
  }
}

// Run the complete resync
completeResync().then(() => {
  console.log('🎉 Complete resync completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});