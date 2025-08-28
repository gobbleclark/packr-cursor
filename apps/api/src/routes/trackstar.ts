import { Router } from 'express';
import { z } from 'zod';
import { trackstarIntegrationService } from '../integrations/trackstar/service';
import { authenticateToken, requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';
import { prisma } from '../lib/database';
import { svix } from '../lib/svix';

const router = Router();

// Validation schemas
const linkTokenSchema = z.object({
  customerId: z.string().optional(),
});

const exchangeSchema = z.object({
  authCode: z.string(),
  customerId: z.string().optional(),
});

const manualSyncSchema = z.object({
  functionsToSync: z.array(z.string()).min(1),
});

const webhookSchema = z.object({
  event_type: z.string(),
  connection_id: z.string(),
  integration_name: z.string(),
  data: z.any(),
  previous_attributes: z.any().optional(),
});

// Debug endpoint to test Trackstar client directly
router.post('/debug/trackstar/test', async (req, res) => {
  try {
    logger.info('Testing Trackstar client directly...');
    const { trackstarClient } = require('../integrations/trackstar/client');
    const result = await trackstarClient.instance.createLinkToken();
    logger.info('Direct Trackstar test successful:', result);
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Direct Trackstar test failed:', error);
    res.status(500).json({ error: 'Direct test failed', details: error.message });
  }
});

// Create link token for Trackstar Link
router.post('/brands/:brandId/integrations/trackstar/link-token', 
  authenticateToken, 
  requireRole('THREEPL_ADMIN'),
  async (req, res) => {
    try {
      const { brandId } = req.params;
      const { customerId } = linkTokenSchema.parse(req.body);

      logger.info('Creating link token for brand:', { brandId, customerId, userId: req.user.id, threeplId: req.user.threeplId });

      // Verify the brand belongs to the authenticated 3PL
      const brand = await prisma.brand.findFirst({
        where: {
          id: brandId,
          threeplId: req.user.threeplId,
        },
      });

      logger.info('Brand lookup result:', { brand: brand ? { id: brand.id, name: brand.name, threeplId: brand.threeplId } : null });

      if (!brand) {
        logger.error('Brand not found or access denied:', { brandId, userThreeplId: req.user.threeplId });
        return res.status(404).json({ error: 'Brand not found' });
      }

      logger.info('Calling trackstarIntegrationService.createLinkToken...');
      const { linkToken } = await trackstarIntegrationService.createLinkToken(brandId, customerId);
      
      logger.info('Successfully created link token:', { linkToken: linkToken.substring(0, 8) + '...' });
      res.json({ success: true, linkToken });
    } catch (error) {
      logger.error('Failed to create link token:', error);
      res.status(500).json({ error: 'Failed to create link token' });
    }
  }
);

// Exchange auth code for access token
router.post('/brands/:brandId/integrations/trackstar/exchange',
  authenticateToken,
  requireRole('THREEPL_ADMIN'),
  async (req, res) => {
    try {
      const { brandId } = req.params;
      const { authCode, customerId } = exchangeSchema.parse(req.body);

      // Verify the brand belongs to the authenticated 3PL
      const brand = await prisma.brand.findFirst({
        where: {
          id: brandId,
          threeplId: req.user.threeplId,
        },
      });

      if (!brand) {
        return res.status(404).json({ error: 'Brand not found' });
      }

      await trackstarIntegrationService.exchangeAuthCode(brandId, authCode, customerId);
      
      res.json({ success: true, message: 'Integration connected successfully' });
    } catch (error) {
      logger.error('Failed to exchange auth code:', error);
      res.status(500).json({ error: 'Failed to connect integration' });
    }
  }
);

// Webhook receiver for Trackstar events
router.post('/webhooks/trackstar', async (req, res) => {
  try {
    const headers = req.headers;
    const body = req.body;

    // Verify webhook signature using Svix
    const signature = headers['svix-signature'] as string;
    const timestamp = headers['svix-timestamp'] as string;
    const deliveryId = headers['svix-delivery-id'] as string;

    if (!signature || !timestamp || !deliveryId) {
      logger.warn('Missing Svix headers in webhook');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    // Verify the webhook signature
    let signatureValid = false;
    try {
      svix.verify(body, {
        'svix-signature': signature,
        'svix-timestamp': timestamp,
        'svix-delivery-id': deliveryId,
      });
      signatureValid = true;
    } catch (error) {
      logger.warn('Invalid webhook signature:', error);
      signatureValid = false;
    }

    // Store webhook event
    const webhookEvent = await prisma.trackstarWebhookEvent.create({
      data: {
        eventType: body.event_type,
        connectionId: body.connection_id,
        integrationName: body.integration_name,
        deliveryId,
        signatureValid,
        payload: body,
        status: signatureValid ? 'PENDING' : 'FAILED',
        error: signatureValid ? null : 'Invalid signature',
      },
    });

    if (!signatureValid) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    // Enqueue webhook processing job
    await trackstarIntegrationService['webhookQueue'].add('process-webhook', {
      eventType: body.event_type,
      connectionId: body.connection_id,
      data: body.data,
      previousAttributes: body.previous_attributes,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    res.json({ success: true, message: 'Webhook received' });
  } catch (error) {
    logger.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Manual sync trigger
router.post('/brands/:brandId/integrations/trackstar/sync',
  authenticateToken,
  requireRole('THREEPL_ADMIN'),
  async (req, res) => {
    try {
      const { brandId } = req.params;
      const { functionsToSync } = manualSyncSchema.parse(req.body);

      // Verify the brand belongs to the authenticated 3PL
      const brand = await prisma.brand.findFirst({
        where: {
          id: brandId,
          threeplId: req.user.threeplId,
        },
      });

      if (!brand) {
        return res.status(404).json({ error: 'Brand not found' });
      }

      await trackstarIntegrationService.triggerManualSync(brandId, functionsToSync);
      
      res.json({ success: true, message: 'Manual sync triggered successfully' });
    } catch (error) {
      logger.error('Failed to trigger manual sync:', error);
      res.status(500).json({ error: 'Failed to trigger sync' });
    }
  }
);

// Get integration status and health
router.get('/brands/:brandId/integrations/trackstar/health',
  authenticateToken,
  requireRole('THREEPL_ADMIN'),
  async (req, res) => {
    try {
      const { brandId } = req.params;

      // Verify the brand belongs to the authenticated 3PL
      const brand = await prisma.brand.findFirst({
        where: {
          id: brandId,
          threeplId: req.user.threeplId,
        },
      });

      if (!brand) {
        return res.status(404).json({ error: 'Brand not found' });
      }

      const health = await trackstarIntegrationService.getSyncHealth(brandId);
      
      res.json({ success: true, health });
    } catch (error) {
      logger.error('Failed to get integration health:', error);
      res.status(500).json({ error: 'Failed to get integration health' });
    }
  }
);

// Get integration details
router.get('/brands/:brandId/integrations/trackstar',
  authenticateToken,
  requireRole('THREEPL_ADMIN'),
  async (req, res) => {
    try {
      const { brandId } = req.params;

      // Verify the brand belongs to the authenticated 3PL
      const brand = await prisma.brand.findFirst({
        where: {
          id: brandId,
          threeplId: req.user.threeplId,
        },
      });

      if (!brand) {
        return res.status(404).json({ error: 'Brand not found' });
      }

      const integration = await prisma.brandIntegration.findUnique({
        where: {
          brandId_provider: {
            brandId,
            provider: 'TRACKSTAR',
          },
        },
      });

      if (!integration) {
        return res.status(404).json({ error: 'Trackstar integration not found' });
      }

      res.json({ success: true, integration });
    } catch (error) {
      logger.error('Failed to get integration details:', error);
      res.status(500).json({ error: 'Failed to get integration details' });
    }
  }
);

// Disconnect integration
router.delete('/brands/:brandId/integrations/trackstar',
  authenticateToken,
  requireRole('THREEPL_ADMIN'),
  async (req, res) => {
    try {
      const { brandId } = req.params;

      // Verify the brand belongs to the authenticated 3PL
      const brand = await prisma.brand.findFirst({
        where: {
          id: brandId,
          threeplId: req.user.threeplId,
        },
      });

      if (!brand) {
        return res.status(404).json({ error: 'Brand not found' });
      }

      await prisma.brandIntegration.delete({
        where: {
          brandId_provider: {
            brandId,
            provider: 'TRACKSTAR',
          },
        },
      });

      res.json({ success: true, message: 'Integration disconnected successfully' });
    } catch (error) {
      logger.error('Failed to disconnect integration:', error);
      res.status(500).json({ error: 'Failed to disconnect integration' });
    }
  }
);

// Manual webhook subscription endpoint
router.post('/brands/:brandId/integrations/trackstar/webhooks/subscribe',
  authenticateToken,
  requireRole('THREEPL_ADMIN'),
  async (req, res) => {
    try {
      const { brandId } = req.params;

      // Verify the brand belongs to the authenticated 3PL
      const brand = await prisma.brand.findFirst({
        where: {
          id: brandId,
          threeplId: req.user.threeplId,
        },
      });

      if (!brand) {
        return res.status(404).json({ error: 'Brand not found' });
      }

      // Get the integration
      const integration = await prisma.brandIntegration.findUnique({
        where: { brandId_provider: { brandId, provider: 'TRACKSTAR' } }
      });

      if (!integration) {
        return res.status(404).json({ error: 'Trackstar integration not found' });
      }

      // Subscribe to webhooks
      const service = new TrackstarIntegrationService();
      await service.subscribeToWebhooks(integration.connectionId, integration.accessToken);

      res.json({ success: true, message: 'Webhooks subscribed successfully' });
    } catch (error) {
      logger.error('Failed to subscribe to webhooks:', error);
      res.status(500).json({ error: 'Failed to subscribe to webhooks' });
    }
  }
);

export default router;
