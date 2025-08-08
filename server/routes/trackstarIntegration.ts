/**
 * Trackstar Integration API Routes
 * Replaces ShipHero integration with universal WMS connectivity
 */

import { Router } from 'express';
import { IStorage } from '../storage';
import { TrackstarIntegrationService } from '../services/trackstarIntegrationService';

export function createTrackstarRoutes(storage: IStorage) {
  const router = Router();
  const trackstarService = new TrackstarIntegrationService(storage);

  /**
   * Setup Trackstar integration for a brand
   * POST /api/trackstar/setup/:brandId
   */
  router.post('/setup/:brandId', async (req, res) => {
    try {
      const { brandId } = req.params;
      const { apiKey, accessToken, connectionId } = req.body;

      if (!apiKey || !accessToken || !connectionId) {
        return res.status(400).json({ 
          error: 'Missing required credentials',
          required: ['apiKey', 'accessToken', 'connectionId']
        });
      }

      console.log(`🔗 Setting up Trackstar integration for brand: ${brandId}`);

      await trackstarService.setupBrandIntegration(brandId, {
        apiKey,
        accessToken,
        connectionId
      });

      res.json({
        success: true,
        message: 'Trackstar integration setup completed',
        note: 'Initial data sync and webhook configuration complete'
      });

    } catch (error) {
      console.error('❌ Trackstar setup failed:', error);
      res.status(500).json({
        error: 'Setup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get Trackstar integration status for a brand
   * GET /api/trackstar/status/:brandId
   */
  router.get('/status/:brandId', async (req, res) => {
    try {
      const { brandId } = req.params;
      
      const brand = await storage.getBrand(brandId);
      if (!brand) {
        return res.status(404).json({ error: 'Brand not found' });
      }

      const hasCredentials = !!(brand.trackstarApiKey && brand.trackstarAccessToken);
      
      // Get recent sync statistics
      const recentOrders = await storage.getOrdersByBrand?.(brandId, { 
        limit: 10, 
        orderBy: 'lastSyncAt' 
      }) || [];

      const lastSyncOrder = recentOrders[0];

      res.json({
        brandId,
        hasIntegration: hasCredentials,
        credentials: hasCredentials ? {
          apiKey: brand.trackstarApiKey?.substring(0, 8) + '...',
          accessTokenSet: !!brand.trackstarAccessToken,
          connectionId: brand.trackstarConnectionId
        } : null,
        lastSync: lastSyncOrder?.lastSyncAt || null,
        recentOrdersCount: recentOrders.length,
        integrationStatus: brand.integrationStatus || 'not_configured',
        status: hasCredentials ? 'active' : 'not_configured'
      });

    } catch (error) {
      console.error('❌ Status check failed:', error);
      res.status(500).json({
        error: 'Status check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Manual sync trigger for a brand
   * POST /api/trackstar/sync/:brandId
   */
  router.post('/sync/:brandId', async (req, res) => {
    try {
      const { brandId } = req.params;
      const { type = 'incremental', days = 7 } = req.body;

      console.log(`🔄 Manual Trackstar sync triggered for brand: ${brandId}, type: ${type}`);

      const brand = await storage.getBrand(brandId);
      if (!brand?.trackstarAccessToken) {
        return res.status(400).json({ error: 'Trackstar credentials not configured' });
      }

      const credentials = {
        apiKey: brand.trackstarApiKey!,
        accessToken: brand.trackstarAccessToken!,
        connectionId: brand.trackstarConnectionId!
      };

      if (type === 'incremental') {
        await trackstarService.performIncrementalSync(brandId);
      } else if (type === 'orders') {
        await trackstarService.syncOrders(brandId, credentials, days);
      } else if (type === 'products') {
        await trackstarService.syncProducts(brandId, credentials);
      } else if (type === 'inventory') {
        await trackstarService.syncInventory(brandId, credentials);
      } else if (type === 'full') {
        await trackstarService.performInitialSync(brandId, credentials);
      }

      res.json({
        success: true,
        message: `${type} sync completed for brand ${brandId}`
      });

    } catch (error) {
      console.error('❌ Manual sync failed:', error);
      res.status(500).json({
        error: 'Manual sync failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Trackstar webhook endpoint
   * POST /api/trackstar/webhook
   */
  router.post('/webhook', async (req, res) => {
    try {
      console.log('📡 Received Trackstar webhook:', req.body?.type);

      // Verify webhook signature if needed
      // const signature = req.headers['x-trackstar-signature'];

      await trackstarService.processWebhook(req.body);

      res.status(200).json({ received: true });

    } catch (error) {
      console.error('❌ Webhook processing failed:', error);
      res.status(500).json({
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Remove Trackstar integration
   * DELETE /api/trackstar/integration/:brandId
   */
  router.delete('/integration/:brandId', async (req, res) => {
    try {
      const { brandId } = req.params;

      console.log(`🗑️ Removing Trackstar integration for brand: ${brandId}`);

      // Clear Trackstar credentials
      await storage.updateBrand(brandId, {
        trackstarApiKey: null,
        trackstarAccessToken: null,
        trackstarConnectionId: null,
        integrationStatus: 'disconnected'
      });

      res.json({
        success: true,
        message: 'Trackstar integration removed successfully'
      });

    } catch (error) {
      console.error('❌ Integration removal failed:', error);
      res.status(500).json({
        error: 'Integration removal failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get link token for Trackstar Connect flow
   * POST /api/trackstar/link-token/:brandId
   */
  router.post('/link-token/:brandId', async (req, res) => {
    try {
      const { brandId } = req.params;
      
      // This would typically call Trackstar's link token API
      // For now, return a placeholder that frontend can use
      
      res.json({
        linkToken: `trackstar_link_${brandId}_${Date.now()}`,
        brandId,
        message: 'Use this token with Trackstar Connect component'
      });

    } catch (error) {
      console.error('❌ Link token generation failed:', error);
      res.status(500).json({
        error: 'Link token generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}