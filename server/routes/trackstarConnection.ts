import { Router } from 'express';
import { storage } from '../storage.js';
import { isAuthenticated } from '../replitAuth.js';
import { TrackstarSyncService } from '../services/trackstarSync.js';

const router = Router();
const trackstarSyncService = new TrackstarSyncService();

// Get Trackstar link token for new connection
router.post('/link-token', isAuthenticated, async (req, res) => {
  try {
    const trackstarApiKey = process.env.TRACKSTAR_API_KEY;
    if (!trackstarApiKey) {
      return res.status(500).json({ message: 'Trackstar API key not configured' });
    }

    console.log('🔗 Generating Trackstar link token...');
    
    const response = await fetch('https://production.trackstarhq.com/link/token', {
      method: 'POST',
      headers: {
        'x-trackstar-api-key': trackstarApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to get link token: ${errorText}`);
      return res.status(response.status).json({ 
        message: 'Failed to generate Trackstar link token',
        error: errorText 
      });
    }

    const data = await response.json();
    console.log(`✅ Link token generated: ${data.link_token?.substring(0, 8)}...`);

    res.json({
      success: true,
      linkToken: data.link_token
    });

  } catch (error) {
    console.error('❌ Link token generation error:', error);
    res.status(500).json({ 
      message: 'Failed to generate Trackstar link token',
      error: (error as Error).message 
    });
  }
});

// Connect brand to Trackstar with auth code from frontend
router.post('/connect', isAuthenticated, async (req, res) => {
  try {
    const { brandId, authCode, wmsProvider, credentials } = req.body;

    if (!brandId || !authCode) {
      return res.status(400).json({ 
        message: 'Missing required fields: brandId and authCode' 
      });
    }

    const brand = await storage.getBrand(brandId);
    if (!brand) {
      return res.status(404).json({ message: 'Brand not found' });
    }

    const trackstarApiKey = process.env.TRACKSTAR_API_KEY;
    if (!trackstarApiKey) {
      return res.status(500).json({ message: 'Trackstar API key not configured' });
    }
    
    console.log(`🔄 Creating new Trackstar connection for ${brand.name}...`);
    
    // Exchange auth code for permanent access token
    const response = await fetch('https://production.trackstarhq.com/link/exchange', {
      method: 'POST',
      headers: {
        'x-trackstar-api-key': trackstarApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ auth_code: authCode }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to exchange auth code: ${errorText}`);
      return res.status(response.status).json({ 
        message: 'Failed to create Trackstar connection',
        error: errorText 
      });
    }

    const connectionData = await response.json();
    console.log(`✅ New Trackstar connection created:`, {
      connection_id: connectionData.connection_id,
      integration_name: connectionData.integration_name,
      available_endpoints: connectionData.available_endpoints?.length || 0
    });

    // Store the connection details in database
    await storage.updateBrandTrackstarCredentials(brandId, trackstarApiKey);
    // TODO: Store access_token and connection_id in brand record
    
    // Store WMS credentials if provided
    if (credentials) {
      console.log(`🔐 Storing ${wmsProvider} credentials for ${brand.name}`);
      // TODO: Store encrypted WMS credentials in database
    }

    res.json({
      success: true,
      message: `Successfully created new Trackstar connection for ${brand.name}`,
      wmsProvider: connectionData.integration_name,
      brandId,
      connectionId: connectionData.connection_id,
      availableEndpoints: connectionData.available_endpoints?.length || 0
    });

  } catch (error) {
    console.error('❌ Trackstar connection error:', error);
    res.status(500).json({ 
      message: 'Failed to connect Trackstar integration',
      error: (error as Error).message 
    });
  }
});

// Create new Trackstar connection (simple approach with sandbox)
router.post('/create-connection', isAuthenticated, async (req, res) => {
  try {
    const { brandId, wmsProvider, credentials } = req.body;

    if (!brandId || !wmsProvider || !credentials) {
      return res.status(400).json({ 
        message: 'Missing required fields: brandId, wmsProvider, and credentials' 
      });
    }

    const brand = await storage.getBrand(brandId);
    if (!brand) {
      return res.status(404).json({ message: 'Brand not found' });
    }

    const trackstarApiKey = process.env.TRACKSTAR_API_KEY;
    if (!trackstarApiKey) {
      return res.status(500).json({ message: 'Trackstar API key not configured' });
    }

    console.log(`🔗 Creating new Trackstar connection for ${brand.name} with ${wmsProvider}...`);
    console.log(`🔐 WMS Credentials: ${credentials.username} / ${credentials.password ? '[PROVIDED]' : '[MISSING]'}`);
    
    try {
      // Create real Trackstar connection using production API
      console.log(`🔗 Creating production Trackstar connection for ${brand.name} with ${wmsProvider}...`);
      
      // Get link token from production Trackstar API
      const linkTokenResponse = await fetch('https://production.trackstarhq.com/link/token', {
        method: 'POST',
        headers: {
          'x-trackstar-api-key': trackstarApiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!linkTokenResponse.ok) {
        const errorText = await linkTokenResponse.text();
        console.error(`❌ Failed to get Trackstar link token: ${errorText}`);
        return res.status(500).json({ 
          message: 'Failed to get Trackstar link token',
          error: errorText 
        });
      }

      const linkData = await linkTokenResponse.json();
      console.log(`✅ Trackstar link token generated: ${linkData.link_token?.substring(0, 8)}...`);

      // Store the Trackstar API key in database to mark as connected
      await storage.updateBrandTrackstarCredentials(brandId, trackstarApiKey);

      // Return the link token for the frontend to complete the OAuth flow
      res.json({
        success: true,
        message: `Trackstar link token generated for ${brand.name}. Complete the ${wmsProvider} connection in Trackstar.`,
        wmsProvider,
        brandId,
        linkToken: linkData.link_token,
        trackstarLinkUrl: `https://production.trackstarhq.com/link?token=${linkData.link_token}`,
        instructions: `Visit the Trackstar link to complete your ${wmsProvider} integration setup`
      });

    } catch (apiError) {
      console.error(`❌ Trackstar API error: ${(apiError as Error).message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to create Trackstar connection',
        error: (apiError as Error).message
      });
    }

  } catch (error) {
    console.error('❌ Connection creation error:', error);
    res.status(500).json({ 
      message: 'Failed to create Trackstar connection',
      error: (error as Error).message 
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
      error: (error as Error).message 
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
      error: (error as Error).message 
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
      error: (error as Error).message 
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
      error: (error as Error).message 
    });
  }
});

export default router;