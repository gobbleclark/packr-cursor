const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function fullInboundSync() {
  try {
    console.log('🚀 Pulling ALL remaining inbound shipments from last 30 days...\n');
    
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
      console.log(`🏢 Syncing ALL inbound shipments for ${integration.brand.name}...`);
      
      try {
        // Get ALL inbound shipments (not just the first 5)
        const response = await axios.get('https://production.trackstarhq.com/wms/inbound-shipments', {
          headers: {
            'x-trackstar-api-key': 'f9bc96aa7e0145b899b713d83a61ad3d',
            'x-trackstar-access-token': integration.accessToken,
            'Content-Type': 'application/json',
          },
          params: {
            limit: 50 // Get up to 50 shipments
          },
          timeout: 30000
        });

        console.log(`   ✅ API Response: ${response.status}`);
        console.log(`   📦 Found ${response.data.data?.length || 0} total inbound shipments`);
        
        if (response.data.data && response.data.data.length > 0) {
          let processedCount = 0;
          let skippedCount = 0;
          
          for (const shipmentData of response.data.data) {
            // Check if shipment already exists
            const existing = await prisma.inboundShipment.findFirst({
              where: {
                threeplId: integration.brand.threeplId,
                externalId: shipmentData.id
              }
            });
            
            if (existing) {
              skippedCount++;
              continue; // Skip if already exists
            }
            
            // Map status
            const statusMapping = {
              'pending': 'PENDING',
              'in_transit': 'IN_TRANSIT',
              'received': 'RECEIVED',
              'cancelled': 'CANCELLED',
              'partial': 'PARTIAL',
              'open': 'PENDING', // Map 'open' to 'PENDING'
            };
            const status = statusMapping[shipmentData.status?.toLowerCase()] || 'PENDING';
            
            // Find warehouse if available
            let warehouseId;
            if (shipmentData.destination_location_id) {
              const warehouse = await prisma.warehouse.findFirst({
                where: {
                  tenantId: integration.brand.threeplId,
                  externalId: shipmentData.destination_location_id,
                },
              });
              warehouseId = warehouse?.id;
            }
            
            // Calculate totals
            const totalItems = shipmentData.line_items?.reduce((sum, item) => sum + (item.expected_quantity || 0), 0) || 0;
            const receivedItems = shipmentData.line_items?.reduce((sum, item) => sum + (item.received_quantity || 0), 0) || 0;
            
            // Create the shipment
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
                trackingUrl: shipmentData.tracking_url,
                warehouseId,
                totalItems,
                receivedItems,
                destinationAddress: shipmentData.destination_address || undefined,
                rawData: shipmentData,
                updatedAtRemote: shipmentData.updated_at ? new Date(shipmentData.updated_at) : undefined,
              },
            });
            
            // Create line items
            if (shipmentData.line_items && Array.isArray(shipmentData.line_items)) {
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
              }
            }
            
            processedCount++;
          }
          
          console.log(`   ✅ Processed ${processedCount} new shipments`);
          console.log(`   ℹ️  Skipped ${skippedCount} existing shipments`);
          
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
    console.log(`📊 Total inbound shipments after full sync: ${finalCount}`);
    
    if (finalCount > 2) {
      const recent = await prisma.inboundShipment.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          brand: { select: { name: true } },
          _count: { select: { items: true } }
        }
      });
      
      console.log('\n📋 All Inbound Shipments by Brand:');
      const brandGroups = {};
      recent.forEach(ship => {
        const brandName = ship.brand?.name || 'Unknown';
        if (!brandGroups[brandName]) {
          brandGroups[brandName] = [];
        }
        brandGroups[brandName].push(ship);
      });
      
      Object.entries(brandGroups).forEach(([brandName, shipments]) => {
        console.log(`\n  ${brandName}: ${shipments.length} shipments`);
        shipments.forEach((ship, i) => {
          const createdToday = new Date(ship.createdAt).toDateString() === new Date().toDateString();
          const marker = createdToday ? '🆕' : '  ';
          console.log(`  ${marker} ${i + 1}. Status: ${ship.status} | Items: ${ship._count.items} | Created: ${new Date(ship.createdAt).toLocaleString()}`);
        });
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fullInboundSync();
