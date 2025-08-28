const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function finalInboundTest() {
  try {
    console.log('🔍 Testing inbound shipments with correct Trackstar URL...\n');
    
    // Get brand integrations
    const integrations = await prisma.brandIntegration.findMany({
      where: {
        provider: 'TRACKSTAR',
        status: 'ACTIVE'
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            threeplId: true
          }
        }
      }
    });

    console.log(`Found ${integrations.length} active integrations\n`);

    for (const integration of integrations) {
      console.log(`🏢 Testing ${integration.brand.name}:`);
      
      try {
        // Test with correct Trackstar URL and headers
        const response = await axios.get('https://production.trackstarhq.com/wms/inbound-shipments', {
          headers: {
            'x-trackstar-api-key': 'f9bc96aa7e0145b899b713d83a61ad3d',
            'x-trackstar-access-token': integration.accessToken,
            'Content-Type': 'application/json',
          },
          params: {
            limit: 5
          },
          timeout: 30000
        });

        console.log(`   ✅ API Response: ${response.status}`);
        console.log(`   📦 Found ${response.data.data?.length || 0} inbound shipments`);
        
        if (response.data.data && response.data.data.length > 0) {
          console.log(`   📋 Sample shipments:`);
          response.data.data.slice(0, 3).forEach((ship, i) => {
            console.log(`     ${i + 1}. ID: ${ship.id}, Status: ${ship.status}, Tracking: ${ship.tracking_number || 'N/A'}`);
          });
          
          // Process the first shipment
          const shipmentData = response.data.data[0];
          console.log(`   🔄 Processing first shipment...`);
          
          // Check if it already exists
          const existing = await prisma.inboundShipment.findFirst({
            where: {
              threeplId: integration.brand.threeplId,
              externalId: shipmentData.id
            }
          });
          
          if (existing) {
            console.log(`   ℹ️  Shipment already exists in database`);
          } else {
            // Create new shipment
            const statusMapping = {
              'pending': 'PENDING',
              'in_transit': 'IN_TRANSIT', 
              'received': 'RECEIVED',
              'cancelled': 'CANCELLED',
              'partial': 'PARTIAL',
            };
            const status = statusMapping[shipmentData.status?.toLowerCase()] || 'PENDING';
            
            const totalItems = shipmentData.line_items?.reduce((sum, item) => sum + (item.expected_quantity || 0), 0) || 0;
            const receivedItems = shipmentData.line_items?.reduce((sum, item) => sum + (item.received_quantity || 0), 0) || 0;
            
            const inboundShipment = await prisma.inboundShipment.create({
              data: {
                threeplId: integration.brand.threeplId,
                brandId: integration.brand.id,
                externalId: shipmentData.id,
                status: status,
                trackingNumber: shipmentData.tracking_number,
                referenceNumber: shipmentData.reference_number,
                expectedDate: shipmentData.expected_date ? new Date(shipmentData.expected_date) : undefined,
                receivedDate: shipmentData.received_date ? new Date(shipmentData.received_date) : undefined,
                carrierName: shipmentData.carrier_name,
                totalItems,
                receivedItems,
                rawData: shipmentData,
                updatedAtRemote: shipmentData.updated_at ? new Date(shipmentData.updated_at) : undefined,
              },
            });
            
            console.log(`   ✅ Created inbound shipment: ${inboundShipment.id.slice(0, 8)}...`);
            
            // Create line items
            if (shipmentData.line_items && Array.isArray(shipmentData.line_items)) {
              let itemCount = 0;
              for (const lineItem of shipmentData.line_items) {
                await prisma.inboundShipmentItem.create({
                  data: {
                    inboundShipmentId: inboundShipment.id,
                    sku: lineItem.sku,
                    productName: lineItem.product_name,
                    expectedQuantity: lineItem.expected_quantity || 0,
                    receivedQuantity: lineItem.received_quantity || 0,
                    unitCost: lineItem.unit_cost,
                    totalCost: lineItem.total_cost,
                    metadata: lineItem,
                  },
                });
                itemCount++;
              }
              console.log(`   📦 Created ${itemCount} line items`);
            }
          }
          
        } else {
          console.log(`   ℹ️  No inbound shipments found for this brand`);
        }
        
      } catch (error) {
        console.log(`   ❌ API Error: ${error.response?.status || 'Network'} ${error.response?.statusText || error.code}`);
        if (error.response?.data) {
          console.log(`   Error details:`, JSON.stringify(error.response.data).slice(0, 200));
        }
      }
      
      console.log('');
    }
    
    // Final summary
    const finalCount = await prisma.inboundShipment.count();
    console.log(`📊 Total inbound shipments in database: ${finalCount}`);
    
    if (finalCount > 0) {
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
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

finalInboundTest();
