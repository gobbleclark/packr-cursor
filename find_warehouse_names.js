/**
 * Search for warehouse names in Trackstar API endpoints
 */

const { TrackstarService } = await import('./server/services/trackstar.ts');
const { storage } = await import('./server/storage.ts');

async function findWarehouseNames() {
  console.log('🔍 Searching for warehouse names in Trackstar API...');
  
  try {
    const trackstarService = new TrackstarService();
    const mabeBrand = await storage.getBrand('dce4813e-aeb7-41fe-bb00-a36e314288f3');
    
    const warehouseIds = ['V2FyZWhvdXNlOjEwMDE0MQ==', 'V2FyZWhvdXNlOjEwMDE3OQ=='];
    
    // 1. Test different warehouse-related endpoints
    const endpoints = [
      '/wms/warehouses',
      '/wms/warehouse',
      '/wms/locations', 
      '/wms/facilities',
      '/mgmt/warehouses',
      '/mgmt/connections/warehouses',
      '/warehouses',
      '/locations'
    ];
    
    console.log('\n🏭 Testing warehouse endpoints...');
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${trackstarService.baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'x-trackstar-api-key': trackstarService.apiKey,
            'x-trackstar-access-token': mabeBrand.trackstarAccessToken,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ ${endpoint}: ${JSON.stringify(data).substring(0, 200)}...`);
          
          if (data.data && data.data.length > 0) {
            console.log(`   Found ${data.data.length} items`);
            data.data.slice(0, 3).forEach(item => {
              console.log(`   - ${JSON.stringify(item)}`);
            });
          }
        } else if (response.status !== 404) {
          console.log(`⚠️ ${endpoint}: ${response.status}`);
        }
      } catch (error) {
        // Ignore errors for exploratory testing
      }
    }
    
    // 2. Test individual warehouse lookup by ID
    console.log('\n🏗️ Testing individual warehouse lookups...');
    
    for (const warehouseId of warehouseIds) {
      const testEndpoints = [
        `/wms/warehouses/${warehouseId}`,
        `/wms/warehouse/${warehouseId}`,
        `/warehouses/${warehouseId}`,
        `/locations/${warehouseId}`
      ];
      
      for (const endpoint of testEndpoints) {
        try {
          const response = await fetch(`${trackstarService.baseUrl}${endpoint}`, {
            method: 'GET',
            headers: {
              'x-trackstar-api-key': trackstarService.apiKey,
              'x-trackstar-access-token': mabeBrand.trackstarAccessToken,
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log(`✅ ${endpoint}: ${JSON.stringify(data)}`);
          } else if (response.status !== 404) {
            console.log(`⚠️ ${endpoint}: ${response.status}`);
          }
        } catch (error) {
          // Ignore errors
        }
      }
    }
    
    // 3. Check if warehouse info is in connection details
    console.log('\n🔗 Checking connection details for warehouse info...');
    
    try {
      const response = await fetch(`${trackstarService.baseUrl}/mgmt/connections/${mabeBrand.trackstarConnectionId}`, {
        method: 'GET',
        headers: {
          'x-trackstar-api-key': trackstarService.apiKey,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const connectionData = await response.json();
        console.log('Connection data:', JSON.stringify(connectionData, null, 2));
        
        // Look for warehouse info in connection
        if (connectionData.warehouses) {
          console.log('Found warehouses in connection:', connectionData.warehouses);
        }
        if (connectionData.facilities) {
          console.log('Found facilities in connection:', connectionData.facilities);
        }
        if (connectionData.locations) {
          console.log('Found locations in connection:', connectionData.locations);
        }
      }
    } catch (error) {
      console.log('❌ Connection lookup failed:', error.message);
    }
    
    // 4. Check orders for warehouse name patterns
    console.log('\n📦 Analyzing orders for warehouse name clues...');
    
    const sampleOrders = await storage.getOrdersByBrand(mabeBrand.id, 50);
    const shippingMethods = new Set();
    const warehousePatterns = new Map();
    
    sampleOrders.forEach(order => {
      if (order.shippingMethod) {
        shippingMethods.add(order.shippingMethod);
      }
      
      if (order.warehouseId) {
        const existing = warehousePatterns.get(order.warehouseId) || { count: 0, methods: new Set(), dates: [] };
        existing.count++;
        existing.methods.add(order.shippingMethod);
        existing.dates.push(order.orderDate);
        warehousePatterns.set(order.warehouseId, existing);
      }
    });
    
    console.log('\nWarehouse usage patterns:');
    warehousePatterns.forEach((info, warehouseId) => {
      const decoded = Buffer.from(warehouseId, 'base64').toString('utf-8');
      console.log(`\n${decoded}:`);
      console.log(`  Orders: ${info.count}`);
      console.log(`  Shipping methods: ${Array.from(info.methods).join(', ')}`);
      console.log(`  Date range: ${info.dates.sort()[0]} to ${info.dates.sort().pop()}`);
    });
    
    console.log('\nAll shipping methods used:');
    Array.from(shippingMethods).sort().forEach(method => {
      console.log(`  - ${method}`);
    });
    
  } catch (error) {
    console.error('❌ Warehouse name search failed:', error);
  }
}

// Run the search
findWarehouseNames().then(() => {
  console.log('\n✅ Warehouse name search completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});