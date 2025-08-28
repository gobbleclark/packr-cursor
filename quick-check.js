const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function quickCheck() {
  try {
    // Check inbound shipments
    const inboundCount = await prisma.inboundShipment.count();
    console.log(`📦 Inbound shipments: ${inboundCount}`);
    
    if (inboundCount > 0) {
      const recent = await prisma.inboundShipment.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: {
          brand: { select: { name: true } },
          _count: { select: { items: true } }
        }
      });
      
      console.log('\n📋 Recent inbound shipments:');
      recent.forEach(ship => {
        console.log(`  ${ship.brand?.name}: ${ship.trackingNumber || ship.id.slice(0, 8)} - ${ship.status} (${ship._count.items} items)`);
      });
    }
    
    // Check recent job runs
    const jobCount = await prisma.jobRun.count();
    console.log(`\n🔄 Total job runs: ${jobCount}`);
    
    if (jobCount > 0) {
      const recentJobs = await prisma.jobRun.findMany({
        take: 5,
        orderBy: { startedAt: 'desc' }
      });
      
      console.log('\n📋 Recent jobs:');
      recentJobs.forEach(job => {
        console.log(`  ${job.jobType} - ${job.status} - ${new Date(job.startedAt).toLocaleTimeString()}`);
      });
    }
    
    // Check webhook events for inbound shipments
    const webhookCount = await prisma.webhookEventV2.count({
      where: {
        eventType: { contains: 'inbound' }
      }
    });
    console.log(`\n🔗 Inbound webhook events: ${webhookCount}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

quickCheck();
