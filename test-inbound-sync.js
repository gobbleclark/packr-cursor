const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testInboundSync() {
  try {
    console.log('🔍 Testing inbound shipments sync...\n');
    
    // Get the brand integrations
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
    
    console.log(`Found ${integrations.length} active Trackstar integrations:`);
    
    for (const integration of integrations) {
      console.log(`\n🏢 ${integration.brand.name}:`);
      console.log(`   Brand ID: ${integration.brand.id}`);
      console.log(`   Connection ID: ${integration.connectionId}`);
      console.log(`   Access Token: ${integration.accessToken ? 'Present' : 'Missing'}`);
      
      // Check if inbound shipments are supported
      const actions = Array.isArray(integration.availableActions) ? integration.availableActions : [];
      const inboundActions = actions.filter(action => action.includes('inbound'));
      console.log(`   Inbound actions: ${inboundActions.join(', ')}`);
      
      if (inboundActions.length > 0) {
        console.log('   ✅ Inbound shipments supported');
        
        // Try to make a direct API call to test the endpoint
        try {
          const axios = require('axios');
          const response = await axios.get('https://api.trackstar.com/wms/inbound-shipments', {
            headers: {
              'Authorization': `Bearer ${integration.accessToken}`,
              'Content-Type': 'application/json',
            },
            params: {
              limit: 5
            }
          });
          
          console.log(`   📦 Found ${response.data.data?.length || 0} inbound shipments`);
          if (response.data.data && response.data.data.length > 0) {
            console.log(`   📋 Sample shipment:`, {
              id: response.data.data[0].id,
              status: response.data.data[0].status,
              tracking_number: response.data.data[0].tracking_number,
              expected_date: response.data.data[0].expected_date
            });
          }
        } catch (apiError) {
          console.log(`   ❌ API call failed: ${apiError.response?.status} ${apiError.response?.statusText}`);
          if (apiError.response?.data) {
            console.log(`   Error details:`, apiError.response.data);
          }
        }
      } else {
        console.log('   ❌ No inbound shipment actions available');
      }
    }
    
    // Show manual sync commands
    console.log('\n🚀 To trigger manual sync, run these commands:');
    console.log('(You need to get an auth token from the browser first)\n');
    
    integrations.forEach(integration => {
      console.log(`# ${integration.brand.name}`);
      console.log(`curl -X POST "http://localhost:4000/api/brands/${integration.brand.id}/integrations/trackstar/sync" \\`);
      console.log(`  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{"functions": ["get_inbound_shipments"]}'`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testInboundSync();
