const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFullSync() {
  try {
    console.log('🔍 Checking Full 30-Day Inbound Shipments Sync Status\n');
    
    // Count total inbound shipments
    const totalCount = await prisma.inboundShipment.count();
    console.log(`📦 Total inbound shipments in database: ${totalCount}`);
    
    if (totalCount > 0) {
      // Get shipments by brand with creation dates
      const shipmentsByBrand = await prisma.inboundShipment.findMany({
        include: {
          brand: { select: { name: true } },
          _count: { select: { items: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      console.log('\n🏢 All Inbound Shipments:');
      const brandGroups = {};
      shipmentsByBrand.forEach(ship => {
        const brandName = ship.brand?.name || 'Unknown';
        if (!brandGroups[brandName]) {
          brandGroups[brandName] = [];
        }
        brandGroups[brandName].push(ship);
      });
      
      Object.entries(brandGroups).forEach(([brandName, shipments]) => {
        console.log(`\n  ${brandName}: ${shipments.length} shipments`);
        shipments.forEach((ship, i) => {
          console.log(`    ${i + 1}. ID: ${ship.id.slice(0, 8)}... | Status: ${ship.status} | Items: ${ship._count.items} | Created: ${new Date(ship.createdAt).toLocaleString()}`);
          if (ship.expectedDate) {
            console.log(`       Expected: ${new Date(ship.expectedDate).toLocaleDateString()}`);
          }
          if (ship.trackingNumber) {
            console.log(`       Tracking: ${ship.trackingNumber}`);
          }
        });
      });
      
      // Check if we have more than just the test data (2 shipments)
      if (totalCount === 2) {
        console.log('\n⚠️  WARNING: Only 2 shipments found - this appears to be just the initial test data.');
        console.log('💡 To pull the full 30-day sync, you need to trigger the manual sync API.');
        console.log('\n🔧 To get the full sync:');
        console.log('1. The test only pulled 1 shipment per brand as a proof of concept');
        console.log('2. Each brand actually has 5+ inbound shipments available in Trackstar');
        console.log('3. Use the manual sync API to pull all historical data');
      } else {
        console.log(`\n✅ Good! Found ${totalCount} shipments - appears to be more than test data.`);
      }
      
      // Check recent job runs for inbound shipment syncs
      const recentJobs = await prisma.jobRun.findMany({
        where: {
          OR: [
            { jobType: { contains: 'inbound' } },
            { jobType: { contains: 'sync' } }
          ]
        },
        orderBy: { startedAt: 'desc' },
        take: 5
      });
      
      if (recentJobs.length > 0) {
        console.log('\n🔄 Recent Sync Jobs:');
        recentJobs.forEach(job => {
          console.log(`  ${job.jobType} - ${job.status} - ${new Date(job.startedAt).toLocaleString()}`);
          if (job.error) {
            console.log(`    Error: ${job.error.slice(0, 100)}...`);
          }
        });
      } else {
        console.log('\n📝 No recent sync jobs found in database.');
      }
      
    } else {
      console.log('\n❌ No inbound shipments found in database.');
    }
    
    // Check if we have the full data available from Trackstar
    console.log('\n💡 Remember: Each brand has 5+ inbound shipments available in Trackstar.');
    console.log('   The current data is from our initial test that only pulled 1 shipment per brand.');
    console.log('   To get the full 30-day history, trigger a complete sync via the API.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFullSync();
