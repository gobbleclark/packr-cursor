const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function directSyncTest() {
  try {
    console.log('🔍 Testing direct Trackstar API calls...\n');
    
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
            slug: true
          }
        }
      }
    });

    console.log(`Found ${integrations.length} active integrations\n`);

    for (const integration of integrations) {
      console.log(`🏢 Testing ${integration.brand.name}:`);
      console.log(`   Brand ID: ${integration.brand.id}`);
      console.log(`   Connection ID: ${integration.connectionId}`);
      
      try {
        // Test direct API call to Trackstar
        const response = await axios.get('https://api.trackstar.com/wms/inbound-shipments', {
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json',
          },
          params: {
            limit: 10
          },
          timeout: 30000
        });

        console.log(`   ✅ API Response: ${response.status} ${response.statusText}`);
        console.log(`   📦 Found ${response.data.data?.length || 0} inbound shipments`);
        
        if (response.data.data && response.data.data.length > 0) {
          console.log(`   📋 Sample shipment:`, {
            id: response.data.data[0].id,
            status: response.data.data[0].status,
            tracking_number: response.data.data[0].tracking_number,
            expected_date: response.data.data[0].expected_date,
            line_items_count: response.data.data[0].line_items?.length || 0
          });
          
          // If we found shipments, let's try to process one manually
          const shipmentData = response.data.data[0];
          console.log(`   🔄 Processing shipment manually...`);
          
          // Map status
          const statusMapping = {
            'pending': 'PENDING',
            'in_transit': 'IN_TRANSIT',
            'received': 'RECEIVED',
            'cancelled': 'CANCELLED',
            'partial': 'PARTIAL',
          };
          const status = statusMapping[shipmentData.status?.toLowerCase()] || 'PENDING';
          
          // Find warehouse
          let warehouseId;
          if (shipmentData.destination_location_id) {
            const warehouse = await prisma.warehouse.findFirst({
              where: {
                tenantId: integration.brand.threeplId || integration.threeplId,
                externalId: shipmentData.destination_location_id,
              },
            });
            warehouseId = warehouse?.id;
            console.log(`   🏭 Warehouse: ${warehouse ? warehouse.name : 'Not found'}`);
          }
          
          // Calculate totals
          const totalItems = shipmentData.line_items?.reduce((sum, item) => sum + (item.expected_quantity || 0), 0) || 0;
          const receivedItems = shipmentData.line_items?.reduce((sum, item) => sum + (item.received_quantity || 0), 0) || 0;
          
          // Create the shipment
          const inboundShipment = await prisma.inboundShipment.create({
            data: {
              threeplId: integration.brand.threeplId || integration.threeplId,
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
          
          console.log(`   ✅ Created inbound shipment: ${inboundShipment.id}`);
          
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
            console.log(`   📦 Created ${shipmentData.line_items.length} line items`);
          }
          
        } else {
          console.log(`   ℹ️  No inbound shipments found for this brand`);
        }
        
      } catch (error) {
        console.log(`   ❌ API Error: ${error.response?.status} ${error.response?.statusText}`);
        if (error.response?.data) {
          console.log(`   Error details:`, error.response.data);
        } else {
          console.log(`   Error message:`, error.message);
        }
      }
      
      console.log(''); // Empty line between brands
    }
    
    // Final count
    const finalCount = await prisma.inboundShipment.count();
    console.log(`\n📊 Final inbound shipments count: ${finalCount}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

directSyncTest();
