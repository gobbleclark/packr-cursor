const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔍 Checking sync status...\n');
    
    // Check recent job runs
    const recentJobs = await prisma.jobRun.findMany({
      orderBy: {
        startedAt: 'desc'
      },
      take: 10
    });
    
    console.log(`📋 Recent job runs (last 10):`);
    if (recentJobs.length === 0) {
      console.log('   No job runs found');
    } else {
      recentJobs.forEach(job => {
        console.log(`   ${job.jobType} - ${job.status} - ${new Date(job.startedAt).toLocaleString()}`);
        if (job.error) {
          console.log(`     Error: ${job.error.slice(0, 100)}...`);
        }
      });
    }
    
    // Check brand integrations and last sync times
    console.log('\n🔗 Brand integrations:');
    const integrations = await prisma.brandIntegration.findMany({
      where: {
        provider: 'TRACKSTAR'
      },
      include: {
        brand: {
          select: {
            name: true,
            slug: true
          }
        }
      },
      orderBy: {
        lastSyncedAt: 'desc'
      }
    });
    
    integrations.forEach(integration => {
      console.log(`   ${integration.brand.name}:`);
      console.log(`     Status: ${integration.status}`);
      console.log(`     Last synced: ${integration.lastSyncedAt ? new Date(integration.lastSyncedAt).toLocaleString() : 'Never'}`);
      console.log(`     Connection ID: ${integration.connectionId}`);
      console.log(`     Available actions: ${JSON.stringify(integration.availableActions)}`);
    });
    
    // Check if inbound shipments function is in available actions
    console.log('\n🚢 Checking for inbound shipments support:');
    integrations.forEach(integration => {
      const actions = Array.isArray(integration.availableActions) ? integration.availableActions : [];
      const hasInboundShipments = actions.some(action => 
        action.includes('inbound') || action.includes('shipment') || action.includes('receiving')
      );
      console.log(`   ${integration.brand.name}: ${hasInboundShipments ? '✅ May support inbound shipments' : '❌ No inbound shipment actions found'}`);
      console.log(`     Available actions: ${actions.join(', ') || 'None'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
