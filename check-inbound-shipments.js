const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔍 Checking for inbound shipments...\n');
    
    // Get total count
    const totalCount = await prisma.inboundShipment.count();
    console.log(`📦 Total inbound shipments: ${totalCount}`);
    
    if (totalCount === 0) {
      console.log('❌ No inbound shipments found in database');
      console.log('\n💡 This could mean:');
      console.log('   1. Manual sync hasn\'t been triggered yet');
      console.log('   2. Trackstar doesn\'t have inbound shipments for these brands');
      console.log('   3. The sync failed (check API logs)');
      console.log('   4. The inbound shipments endpoint might not be available in Trackstar');
      return;
    }
    
    // Get shipments by brand
    const shipmentsByBrand = await prisma.inboundShipment.findMany({
      include: {
        brand: {
          select: {
            name: true,
            slug: true
          }
        },
        items: {
          select: {
            sku: true,
            expectedQuantity: true,
            receivedQuantity: true
          }
        },
        _count: {
          select: {
            items: true,
            receipts: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log('\n📋 Inbound shipments by brand:');
    
    const brandGroups = {};
    shipmentsByBrand.forEach(shipment => {
      const brandName = shipment.brand?.name || 'Unknown Brand';
      if (!brandGroups[brandName]) {
        brandGroups[brandName] = [];
      }
      brandGroups[brandName].push(shipment);
    });
    
    Object.entries(brandGroups).forEach(([brandName, shipments]) => {
      console.log(`\n🏢 ${brandName}: ${shipments.length} shipments`);
      
      shipments.slice(0, 5).forEach(shipment => { // Show first 5
        console.log(`  📦 ${shipment.trackingNumber || shipment.id.slice(0, 8)} - ${shipment.status}`);
        console.log(`     Items: ${shipment._count.items}, Receipts: ${shipment._count.receipts}`);
        console.log(`     Expected: ${shipment.expectedDate ? new Date(shipment.expectedDate).toLocaleDateString() : 'N/A'}`);
      });
      
      if (shipments.length > 5) {
        console.log(`     ... and ${shipments.length - 5} more`);
      }
    });
    
    // Check recent webhook events
    console.log('\n🔗 Recent webhook events:');
    const recentWebhooks = await prisma.webhookEventV2.findMany({
      where: {
        eventType: {
          contains: 'inbound'
        }
      },
      orderBy: {
        processedAt: 'desc'
      },
      take: 5,
      include: {
        brand: {
          select: {
            name: true
          }
        }
      }
    });
    
    if (recentWebhooks.length === 0) {
      console.log('   No inbound shipment webhook events found');
    } else {
      recentWebhooks.forEach(webhook => {
        console.log(`   ${webhook.eventType} - ${webhook.brand?.name} - ${webhook.status} - ${new Date(webhook.processedAt).toLocaleString()}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
