import { Router } from 'express';
import { storage } from '../storage.js';
import { isAuthenticated } from '../replitAuth.js';
import { TrackstarSyncService } from '../services/trackstarSync.js';

const router = Router();
const trackstarSyncService = new TrackstarSyncService();

// Connect brand to Trackstar with selected WMS provider
router.post('/connect', isAuthenticated, async (req, res) => {
  try {
    const { brandId, wmsProvider, credentials } = req.body;

    if (!brandId || !wmsProvider) {
      return res.status(400).json({ 
        message: 'Missing required fields: brandId and wmsProvider' 
      });
    }

    // Update brand with Trackstar connection
    const brand = await storage.getBrand(brandId);
    if (!brand) {
      return res.status(404).json({ message: 'Brand not found' });
    }

    // Store credentials for Trackstar connection
    const trackstarApiKey = process.env.TRACKSTAR_API_KEY;
    if (!trackstarApiKey) {
      return res.status(500).json({ message: 'Trackstar API key not configured' });
    }
    
    // Get existing connections from Trackstar account
    try {
      const response = await fetch(`https://production.trackstarhq.com/connections`, {
        headers: {
          'x-trackstar-api-key': trackstarApiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Trackstar API error: ${response.status}`);
      }

      const connectionsData = await response.json();
      const connections = connectionsData.data || [];
      
      console.log(`📋 Found ${connections.length} existing connections in Trackstar account`);
      
      // Find a matching connection for the selected WMS provider
      const matchingConnection = connections.find(conn => 
        conn.integration_name === wmsProvider.toLowerCase() && 
        conn.available_actions && 
        conn.available_actions.length > 0
      );

      if (matchingConnection) {
        console.log(`🔗 Using existing Trackstar connection: ${matchingConnection.connection_id}`);
        
        // Update brand with Trackstar connection details
        await storage.updateBrandTrackstarCredentials(brandId, trackstarApiKey);
        
        // Store the connection ID for future use
        console.log(`📝 WMS Provider: ${wmsProvider}`);
        console.log(`🔗 Connection ID: ${matchingConnection.connection_id}`);
        console.log(`✅ Using existing connection with ${matchingConnection.available_actions.length} available actions`);

        res.json({
          success: true,
          message: `Successfully connected ${brand.name} to Trackstar using existing ${wmsProvider} connection`,
          wmsProvider,
          brandId,
          connectionId: matchingConnection.connection_id,
          availableActions: matchingConnection.available_actions.length
        });
      } else {
        // No matching connection found
        console.log(`⚠️ No existing ${wmsProvider} connection found in Trackstar account`);
        res.status(400).json({
          success: false,
          message: `No ${wmsProvider} connection found in your Trackstar account. Please create a ${wmsProvider} connection in Trackstar first.`,
          availableConnections: connections.map(c => c.integration_name)
        });
      }
    } catch (error) {
      console.error(`❌ Failed to check Trackstar connections: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to verify Trackstar connections',
        error: error.message
      });
    }

  } catch (error) {
    console.error('❌ Trackstar connection error:', error);
    res.status(500).json({ 
      message: 'Failed to connect Trackstar integration',
      error: error.message 
    });
  }
});

// Get Trackstar connection status for a brand
router.get('/status/:brandId', isAuthenticated, async (req, res) => {
  try {
    const { brandId } = req.params;
    
    const brand = await storage.getBrand(brandId);
    if (!brand) {
      return res.status(404).json({ message: 'Brand not found' });
    }

    res.json({
      connected: !!brand.trackstarApiKey,
      wmsProvider: null,
      integrationStatus: brand.trackstarApiKey ? 'connected' : 'disconnected',
      connectedAt: brand.trackstarApiKey ? new Date().toISOString() : null
    });

  } catch (error) {
    console.error('❌ Trackstar status check error:', error);
    res.status(500).json({ 
      message: 'Failed to check Trackstar status',
      error: error.message 
    });
  }
});

// Disconnect Trackstar integration
router.delete('/disconnect/:brandId', isAuthenticated, async (req, res) => {
  try {
    const { brandId } = req.params;
    
    const brand = await storage.getBrand(brandId);
    if (!brand) {
      return res.status(404).json({ message: 'Brand not found' });
    }

    // Remove Trackstar connection
    await storage.updateBrandTrackstarCredentials(brandId, null);

    console.log(`🔌 Trackstar integration disconnected for brand ${brand.name}`);

    res.json({
      success: true,
      message: `Trackstar integration disconnected for ${brand.name}`
    });

  } catch (error) {
    console.error('❌ Trackstar disconnection error:', error);
    res.status(500).json({ 
      message: 'Failed to disconnect Trackstar integration',
      error: error.message 
    });
  }
});

// Manually trigger sync for a specific brand
router.post('/sync/:brandId', isAuthenticated, async (req, res) => {
  try {
    const { brandId } = req.params;
    
    const brand = await storage.getBrand(brandId);
    if (!brand) {
      return res.status(404).json({ message: 'Brand not found' });
    }

    if (!brand.trackstarApiKey) {
      return res.status(400).json({ message: 'Brand not connected to Trackstar' });
    }

    console.log(`🔄 Manual sync triggered for brand: ${brand.name}`);
    await trackstarSyncService.syncBrandData(brandId, brand.trackstarApiKey);

    res.json({
      success: true,
      message: `Successfully synced data for ${brand.name}`,
      brandId,
      syncedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Manual Trackstar sync error:', error);
    res.status(500).json({ 
      message: 'Failed to sync Trackstar data',
      error: error.message 
    });
  }
});

// Get sync stats for a brand
router.get('/sync-stats/:brandId', isAuthenticated, async (req, res) => {
  try {
    const { brandId } = req.params;
    
    const brand = await storage.getBrand(brandId);
    if (!brand) {
      return res.status(404).json({ message: 'Brand not found' });
    }

    // Get order and product counts for the brand
    const orders = await storage.getOrdersByBrand(brandId);
    const products = await storage.getProductsByBrand(brandId);
    
    const trackstarOrders = orders.filter(order => order.trackstarOrderId);
    const trackstarProducts = products.filter(product => product.trackstarProductId);

    res.json({
      brandName: brand.name,
      isConnected: !!brand.trackstarApiKey,
      totalOrders: orders.length,
      trackstarSyncedOrders: trackstarOrders.length,
      totalProducts: products.length,
      trackstarSyncedProducts: trackstarProducts.length,
      lastSyncAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Trackstar sync stats error:', error);
    res.status(500).json({ 
      message: 'Failed to get sync stats',
      error: error.message 
    });
  }
});

export default router;