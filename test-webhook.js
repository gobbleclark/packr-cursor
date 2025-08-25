const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testWebhookSetup() {
  try {
    console.log('🔍 Checking webhook setup...\n');

    // Check if we have any brands with Trackstar integrations
    const integrations = await prisma.brandIntegration.findMany({
      where: { provider: 'TRACKSTAR' },
      include: {
        brand: {
          select: {
            name: true,
            id: true
          }
        }
      }
    });

    console.log(`📊 Found ${integrations.length} Trackstar integrations:`);
    integrations.forEach(integration => {
      console.log(`  - ${integration.brand.name} (${integration.brand.id})`);
      console.log(`    Status: ${integration.status}`);
      console.log(`    Last sync: ${integration.lastSyncedAt || 'Never'}`);
      console.log(`    Webhook subscribed: ${integration.webhookSubscribed ? 'Yes' : 'No'}\n`);
    });

    // Check recent webhook events
    const recentWebhooks = await prisma.trackstarWebhookEvent.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        eventType: true,
        createdAt: true,
        status: true,
        signatureValid: true
      }
    });

    console.log(`📨 Recent webhook events (${recentWebhooks.length}):`);
    if (recentWebhooks.length === 0) {
      console.log('  No webhook events received yet');
    } else {
      recentWebhooks.forEach(webhook => {
        console.log(`  - ${webhook.eventType} at ${webhook.createdAt}`);
        console.log(`    Status: ${webhook.status}, Signature: ${webhook.signatureValid ? 'Valid' : 'Invalid'}`);
      });
    }

    // Check inventory data freshness
    const inventoryStats = await prisma.inventoryItem.groupBy({
      by: ['lastTrackstarUpdateAt'],
      _count: true,
      orderBy: { lastTrackstarUpdateAt: 'desc' },
      take: 5
    });

    console.log(`\n📦 Inventory data freshness:`);
    if (inventoryStats.length === 0) {
      console.log('  No inventory data found');
    } else {
      inventoryStats.forEach(stat => {
        const age = Date.now() - new Date(stat.lastTrackstarUpdateAt).getTime();
        const ageMinutes = Math.floor(age / (1000 * 60));
        const freshness = ageMinutes <= 2 ? 'Live' : ageMinutes <= 10 ? 'Recent' : 'Stale';
        console.log(`  - ${stat._count} items updated ${ageMinutes}min ago (${freshness})`);
      });
    }

    console.log(`\n🌐 Webhook URL: ${process.env.NGROK_URL || 'Not set'}/api/webhooks/trackstar`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testWebhookSetup();
