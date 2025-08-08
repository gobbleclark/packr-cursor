import { Router } from 'express';
import { storage } from '../storage.js';

const router = Router();

// Connect brand to Trackstar with selected WMS provider
router.post('/connect', async (req, res) => {
  try {
    const { brandId, wmsProvider, apiKey } = req.body;

    if (!brandId || !wmsProvider || !apiKey) {
      return res.status(400).json({ 
        message: 'Missing required fields: brandId, wmsProvider, and apiKey' 
      });
    }

    // Update brand with Trackstar connection
    const brand = await storage.getBrandById(brandId);
    if (!brand) {
      return res.status(404).json({ message: 'Brand not found' });
    }

    // Update brand with Trackstar API key and selected WMS provider
    // For now, just update trackstarApiKey field (the other fields will be added in future migrations)
    await storage.updateBrandTrackstarCredentials(brandId, apiKey);

    console.log(`✅ Trackstar integration connected for brand ${brand.name} with ${wmsProvider}`);

    res.json({
      success: true,
      message: `Successfully connected ${brand.name} to Trackstar with ${wmsProvider}`,
      wmsProvider,
      brandId
    });

  } catch (error) {
    console.error('❌ Trackstar connection error:', error);
    res.status(500).json({ 
      message: 'Failed to connect Trackstar integration',
      error: error.message 
    });
  }
});

// Get Trackstar connection status for a brand
router.get('/status/:brandId', async (req, res) => {
  try {
    const { brandId } = req.params;
    
    const brand = await storage.getBrandById(brandId);
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
router.delete('/disconnect/:brandId', async (req, res) => {
  try {
    const { brandId } = req.params;
    
    const brand = await storage.getBrandById(brandId);
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

export default router;