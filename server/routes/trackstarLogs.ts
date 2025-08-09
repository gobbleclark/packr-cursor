import { Router } from 'express';
import { storage } from '../storage.js';
import { isAuthenticated } from '../replitAuth.js';

const router = Router();

// Get connection logs for a specific brand
router.get('/logs/:brandId', isAuthenticated, async (req, res) => {
  try {
    const { brandId } = req.params;
    
    const brand = await storage.getBrand(brandId);
    if (!brand) {
      return res.status(404).json({ message: 'Brand not found' });
    }

    if (!brand.trackstarAccessToken || !brand.trackstarConnectionId) {
      return res.json({
        brand: brand.name,
        status: 'not_connected',
        message: 'Brand is not connected to Trackstar',
        logs: []
      });
    }

    console.log(`📋 Fetching Trackstar logs for ${brand.name}...`);
    console.log(`🔗 Connection ID: ${brand.trackstarConnectionId}`);
    console.log(`🏷️ Integration: ${brand.trackstarIntegrationName}`);

    // Try to fetch some connection data to test the connection
    const testResponse = await fetch('https://production.trackstarhq.com/wms/inventory?limit=1', {
      method: 'GET',
      headers: {
        'x-trackstar-api-key': process.env.TRACKSTAR_API_KEY!,
        'x-trackstar-access-token': brand.trackstarAccessToken,
        'Content-Type': 'application/json',
      },
    });

    const connectionStatus = testResponse.ok ? 'active' : 'error';
    let testData = null;
    
    if (testResponse.ok) {
      try {
        testData = await testResponse.json();
        console.log(`✅ Connection test successful for ${brand.name}`);
      } catch (e) {
        console.log(`⚠️ Response received but failed to parse JSON for ${brand.name}`);
      }
    } else {
      console.log(`❌ Connection test failed for ${brand.name}: ${testResponse.status}`);
    }

    // Get recent orders to show activity
    let recentOrders = [];
    try {
      const ordersResponse = await fetch('https://production.trackstarhq.com/wms/orders?limit=5', {
        method: 'GET',
        headers: {
          'x-trackstar-api-key': process.env.TRACKSTAR_API_KEY!,
          'x-trackstar-access-token': brand.trackstarAccessToken,
          'Content-Type': 'application/json',
        },
      });

      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();
        recentOrders = ordersData.data || ordersData.orders || [];
        console.log(`📦 Found ${recentOrders.length} recent orders for ${brand.name}`);
      }
    } catch (e) {
      console.log(`⚠️ Could not fetch recent orders for ${brand.name}`);
    }

    const logEntries = [
      {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Connection test for ${brand.name}`,
        status: connectionStatus,
        details: {
          connectionId: brand.trackstarConnectionId,
          integrationName: brand.trackstarIntegrationName,
          hasAccessToken: !!brand.trackstarAccessToken,
          testResponse: testResponse.status,
          inventoryItems: testData?.data?.length || 0,
          recentOrders: recentOrders.length
        }
      },
      {
        timestamp: brand.updatedAt,
        level: 'INFO', 
        message: `Brand connection last updated`,
        status: 'info',
        details: {
          connectedAt: brand.connectedAt || 'N/A',
          lastUpdate: brand.updatedAt
        }
      }
    ];

    if (recentOrders.length > 0) {
      logEntries.push({
        timestamp: new Date().toISOString(),
        level: 'SUCCESS',
        message: `Recent order activity detected`,
        status: 'active',
        details: {
          orderCount: recentOrders.length,
          latestOrder: recentOrders[0]?.order_number || recentOrders[0]?.id,
          orderStatuses: recentOrders.map(o => o.status || o.fulfillment_status).filter(Boolean)
        }
      });
    }

    res.json({
      brand: brand.name,
      connectionId: brand.trackstarConnectionId,
      integrationName: brand.trackstarIntegrationName,
      status: connectionStatus,
      logs: logEntries,
      summary: {
        isConnected: !!brand.trackstarAccessToken,
        connectionActive: connectionStatus === 'active',
        lastUpdated: brand.updatedAt,
        inventoryItems: testData?.data?.length || 0,
        recentOrderCount: recentOrders.length
      }
    });

  } catch (error) {
    console.error(`❌ Error fetching Trackstar logs: ${(error as Error).message}`);
    res.status(500).json({
      message: 'Failed to fetch Trackstar logs',
      error: (error as Error).message
    });
  }
});

// Get all brands with their connection status
router.get('/status', isAuthenticated, async (req, res) => {
  try {
    const brands = await storage.getBrandsByThreePL('all');
    
    const brandStatuses = await Promise.all(
      brands.map(async (brand) => {
        let connectionStatus = 'not_connected';
        let lastActivity = 'N/A';
        
        if (brand.trackstarAccessToken && brand.trackstarConnectionId) {
          try {
            const testResponse = await fetch('https://production.trackstarhq.com/wms/inventory?limit=1', {
              method: 'GET',
              headers: {
                'x-trackstar-api-key': process.env.TRACKSTAR_API_KEY!,
                'x-trackstar-access-token': brand.trackstarAccessToken,
                'Content-Type': 'application/json',
              },
            });
            
            connectionStatus = testResponse.ok ? 'active' : 'error';
            lastActivity = new Date().toISOString();
          } catch (e) {
            connectionStatus = 'error';
          }
        }

        return {
          id: brand.id,
          name: brand.name,
          connectionStatus,
          integrationName: brand.trackstarIntegrationName,
          connectionId: brand.trackstarConnectionId?.substring(0, 8) + '...',
          lastActivity,
          hasWebhooks: false // We'd need to check this separately
        };
      })
    );

    res.json({
      totalBrands: brands.length,
      connectedBrands: brandStatuses.filter(b => b.connectionStatus === 'active').length,
      brands: brandStatuses
    });

  } catch (error) {
    console.error(`❌ Error fetching brand statuses: ${(error as Error).message}`);
    res.status(500).json({
      message: 'Failed to fetch brand statuses',
      error: (error as Error).message
    });
  }
});

export default router;