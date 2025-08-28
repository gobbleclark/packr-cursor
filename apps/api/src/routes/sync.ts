import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@packr/database';
import { logger } from '../utils/logger';
import { trackstarIntegrationService } from '../integrations/trackstar/service';
import { requireAuth } from '../middleware/auth';
import { trackstarClient } from '../integrations/trackstar/client';
import { circuitBreakerManager } from '../lib/circuit-breaker';

const router = Router();

// Apply authentication to all sync routes
router.use(requireAuth);

/**
 * GET /api/sync/health
 * Returns comprehensive sync health status for all tenant brands
 * Includes lag metrics, queue status, and recent failures
 */
router.get('/health', async (req, res) => {
  try {
    const userTenantId = req.user.threeplId;
    const userRole = req.user.role;

    // Get all integrations for the tenant (with brand filter for non-admin users)
    const whereClause = userRole === 'SUPER_ADMIN' 
      ? {} 
      : {
          brand: {
            threeplId: userTenantId
          }
        };

    const integrations = await prisma.brandIntegration.findMany({
      where: {
        provider: 'TRACKSTAR',
        status: 'ACTIVE',
        ...whereClause
      },
      include: {
        brand: {
          include: {
            threepl: {
              select: { id: true, name: true, slug: true }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const healthData = await Promise.all(
      integrations.map(async (integration) => {
        const brandId = integration.brandId;
        const tenantId = integration.brand.threeplId;

        // Calculate sync lag (time since last successful sync)
        const now = new Date();
        const syncLagMs = integration.lastSyncedAt 
          ? now.getTime() - integration.lastSyncedAt.getTime()
          : null;

        // Calculate webhook lag (time since last webhook)
        const webhookLagMs = integration.lastWebhookAt
          ? now.getTime() - integration.lastWebhookAt.getTime()
          : null;

        // Get recent failed webhook events (last 24 hours)
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const recentFailures = await prisma.webhookEventV2.count({
          where: {
            tenantId,
            brandId,
            status: 'failed',
            createdAt: { gte: twentyFourHoursAgo }
          }
        });

        // Get recent successful webhook events for rate calculation
        const recentSuccesses = await prisma.webhookEventV2.count({
          where: {
            tenantId,
            brandId, 
            status: 'processed',
            createdAt: { gte: twentyFourHoursAgo }
          }
        });

        const totalRecentEvents = recentFailures + recentSuccesses;
        const errorRate = totalRecentEvents > 0 ? (recentFailures / totalRecentEvents) * 100 : 0;

        // Get queue job counts (this would ideally come from BullMQ dashboard APIs)
        const queueStats = await getQueueStats(brandId);

        // Get circuit breaker status
        const circuitBreakerStats = trackstarClient.getCircuitBreakerStats();

        // Determine overall health status
        const healthStatus = determineHealthStatus({
          syncLagMs,
          webhookLagMs,
          errorRate,
          queueStats,
          recentFailures,
          circuitBreakerOpen: circuitBreakerStats?.state === 'open'
        });

        return {
          tenantId,
          tenantName: integration.brand.threepl.name,
          brandId,
          brandName: integration.brand.name,
          integrationName: integration.integrationName,
          connectionId: integration.connectionId,
          status: healthStatus,
          lastSyncedAt: integration.lastSyncedAt,
          lastWebhookAt: integration.lastWebhookAt,
          syncLagMs,
          webhookLagMs,
          recentFailures,
          recentSuccesses,
          errorRate: Math.round(errorRate * 100) / 100, // Round to 2 decimal places
          queueStats,
          circuitBreaker: circuitBreakerStats,
          config: integration.config
        };
      })
    );

    // Calculate aggregate metrics
    const aggregateStats = {
      totalIntegrations: integrations.length,
      healthyIntegrations: healthData.filter(h => h.status === 'healthy').length,
      degradedIntegrations: healthData.filter(h => h.status === 'degraded').length,
      unhealthyIntegrations: healthData.filter(h => h.status === 'unhealthy').length,
      avgSyncLag: calculateAverage(healthData.map(h => h.syncLagMs).filter(Boolean)),
      avgWebhookLag: calculateAverage(healthData.map(h => h.webhookLagMs).filter(Boolean)),
      totalRecentFailures: healthData.reduce((sum, h) => sum + h.recentFailures, 0),
      circuitBreakerStats: circuitBreakerManager.getAllStats(),
      generatedAt: now.toISOString()
    };

    res.json({
      status: 'success',
      aggregate: aggregateStats,
      integrations: healthData
    });

  } catch (error) {
    logger.error('Failed to get sync health status:', error);
    res.status(500).json({
      error: 'Failed to retrieve sync health',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/sync/replay
 * Replay failed webhook events or sync jobs
 * Requires ADMIN role and optional brand filter
 */
router.post('/replay', async (req, res) => {
  try {
    // Validate request schema
    const replaySchema = z.object({
      type: z.enum(['webhook', 'sync']),
      brandId: z.string().optional(),
      eventIds: z.array(z.string()).optional(),
      maxAge: z.number().min(1).max(168).optional(), // Max 7 days in hours
      dryRun: z.boolean().default(false)
    });

    const { type, brandId, eventIds, maxAge = 24, dryRun } = replaySchema.parse(req.body);

    // Authorization check - only admins can replay
    if (!['SUPER_ADMIN', 'THREEPL_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Build where clause for failed events
    const maxAgeDate = new Date(Date.now() - maxAge * 60 * 60 * 1000);
    const whereClause: any = {
      status: 'failed',
      createdAt: { gte: maxAgeDate }
    };

    // Apply tenant filtering for non-super-admins
    if (req.user.role !== 'SUPER_ADMIN') {
      whereClause.tenantId = req.user.threeplId;
    }

    // Apply brand filtering if specified
    if (brandId) {
      whereClause.brandId = brandId;
    }

    // Apply specific event ID filtering if specified
    if (eventIds && eventIds.length > 0) {
      whereClause.eventId = { in: eventIds };
    }

    if (type === 'webhook') {
      // Get failed webhook events to replay
      const failedEvents = await prisma.webhookEventV2.findMany({
        where: whereClause,
        orderBy: { createdAt: 'asc' },
        take: 100 // Limit to prevent overwhelming the system
      });

      if (dryRun) {
        return res.json({
          action: 'dry_run',
          type: 'webhook',
          eventsFound: failedEvents.length,
          events: failedEvents.map(e => ({
            eventId: e.eventId,
            eventType: e.eventType,
            tenantId: e.tenantId,
            brandId: e.brandId,
            createdAt: e.createdAt,
            error: e.error
          }))
        });
      }

      // Queue webhook events for replay
      let replayedCount = 0;
      for (const event of failedEvents) {
        try {
          await trackstarIntegrationService['webhookQueue'].add('webhook-replay', {
            eventType: event.eventType,
            connectionId: `replay-${event.eventId}`,
            data: event.payload,
            originalEventId: event.eventId
          }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            delay: replayedCount * 1000 // Stagger replays
          });

          // Mark as pending retry
          await prisma.webhookEventV2.update({
            where: { id: event.id },
            data: { 
              status: 'pending',
              attempts: 0,
              error: null
            }
          });

          replayedCount++;
        } catch (error) {
          logger.error(`Failed to queue replay for event ${event.eventId}:`, error);
        }
      }

      res.json({
        action: 'replay',
        type: 'webhook', 
        eventsFound: failedEvents.length,
        eventsQueued: replayedCount
      });

    } else if (type === 'sync') {
      // For sync jobs, trigger manual sync for affected brands
      const affectedBrands = await prisma.brandIntegration.findMany({
        where: {
          ...(brandId ? { brandId } : {}),
          ...(req.user.role !== 'SUPER_ADMIN' ? { brand: { threeplId: req.user.threeplId } } : {}),
          provider: 'TRACKSTAR',
          status: 'ACTIVE'
        },
        select: { brandId: true, brand: { select: { name: true } } }
      });

      if (dryRun) {
        return res.json({
          action: 'dry_run',
          type: 'sync',
          brandsFound: affectedBrands.length,
          brands: affectedBrands.map(b => ({
            brandId: b.brandId,
            brandName: b.brand.name
          }))
        });
      }

      // Trigger manual sync for each brand
      let syncedCount = 0;
      for (const brand of affectedBrands) {
        try {
          await trackstarIntegrationService.triggerManualSync(brand.brandId, [
            'products', 'inventory', 'orders', 'shipments'
          ]);
          syncedCount++;
        } catch (error) {
          logger.error(`Failed to trigger sync for brand ${brand.brandId}:`, error);
        }
      }

      res.json({
        action: 'replay',
        type: 'sync',
        brandsFound: affectedBrands.length,
        syncTriggered: syncedCount
      });
    }

  } catch (error) {
    logger.error('Failed to replay events:', error);
    res.status(500).json({
      error: 'Failed to replay events',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/sync/lag/:brandId
 * Get detailed lag metrics for a specific brand
 */
router.get('/lag/:brandId', async (req, res) => {
  try {
    const { brandId } = req.params;

    // Validate brand access
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: { 
        threepl: true,
        integrations: {
          where: { provider: 'TRACKSTAR' }
        }
      }
    });

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    // Check authorization
    if (req.user.role !== 'SUPER_ADMIN' && brand.threeplId !== req.user.threeplId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const integration = brand.integrations[0];
    if (!integration) {
      return res.status(404).json({ error: 'Trackstar integration not found' });
    }

    // Calculate detailed lag metrics
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get recent webhook events for lag analysis
    const recentWebhooks = await prisma.webhookEventV2.findMany({
      where: {
        tenantId: brand.threeplId,
        brandId,
        createdAt: { gte: twentyFourHoursAgo }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // Calculate webhook processing lag distribution
    const processingLags = recentWebhooks
      .filter(wh => wh.processedAt)
      .map(wh => wh.processedAt!.getTime() - wh.receivedAt.getTime());

    const lagStats = {
      syncLag: {
        lastSyncAt: integration.lastSyncedAt,
        lagMs: integration.lastSyncedAt 
          ? now.getTime() - integration.lastSyncedAt.getTime() 
          : null
      },
      webhookLag: {
        lastWebhookAt: integration.lastWebhookAt,
        lagMs: integration.lastWebhookAt 
          ? now.getTime() - integration.lastWebhookAt.getTime() 
          : null
      },
      processingLag: {
        count: processingLags.length,
        avgMs: processingLags.length > 0 
          ? Math.round(processingLags.reduce((sum, lag) => sum + lag, 0) / processingLags.length)
          : null,
        p50Ms: percentile(processingLags, 50),
        p95Ms: percentile(processingLags, 95),
        p99Ms: percentile(processingLags, 99),
        maxMs: processingLags.length > 0 ? Math.max(...processingLags) : null
      },
      recentActivity: {
        last24h: {
          webhooksReceived: recentWebhooks.length,
          webhooksProcessed: recentWebhooks.filter(wh => wh.status === 'processed').length,
          webhooksFailed: recentWebhooks.filter(wh => wh.status === 'failed').length
        }
      }
    };

    res.json({
      brandId,
      brandName: brand.name,
      tenantId: brand.threeplId,
      tenantName: brand.threepl.name,
      integrationStatus: integration.status,
      lag: lagStats,
      generatedAt: now.toISOString()
    });

  } catch (error) {
    logger.error(`Failed to get lag metrics for brand ${req.params.brandId}:`, error);
    res.status(500).json({
      error: 'Failed to retrieve lag metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper functions

async function getQueueStats(brandId: string) {
  // In a real implementation, this would query BullMQ dashboard APIs
  // For now, return mock stats that could be populated from Redis
  return {
    syncQueue: {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0
    },
    webhookQueue: {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0
    },
    // Could add job age metrics here
    oldestJobAge: null
  };
}

function determineHealthStatus(params: {
  syncLagMs: number | null;
  webhookLagMs: number | null;
  errorRate: number;
  queueStats: any;
  recentFailures: number;
  circuitBreakerOpen?: boolean;
}) {
  const { syncLagMs, webhookLagMs, errorRate, recentFailures, circuitBreakerOpen } = params;

  // Define SLO thresholds (from user requirements)
  const SYNC_LAG_WARNING_MS = 5 * 60 * 1000; // 5 minutes
  const SYNC_LAG_CRITICAL_MS = 15 * 60 * 1000; // 15 minutes
  const WEBHOOK_LAG_WARNING_MS = 2 * 60 * 1000; // 2 minutes
  const WEBHOOK_LAG_CRITICAL_MS = 10 * 60 * 1000; // 10 minutes
  const ERROR_RATE_WARNING = 1.0; // 1%
  const ERROR_RATE_CRITICAL = 5.0; // 5%
  const FAILURE_COUNT_WARNING = 5;
  const FAILURE_COUNT_CRITICAL = 20;

  // Check for critical conditions
  if (
    (syncLagMs && syncLagMs > SYNC_LAG_CRITICAL_MS) ||
    (webhookLagMs && webhookLagMs > WEBHOOK_LAG_CRITICAL_MS) ||
    errorRate > ERROR_RATE_CRITICAL ||
    recentFailures > FAILURE_COUNT_CRITICAL ||
    circuitBreakerOpen
  ) {
    return 'unhealthy';
  }

  // Check for warning conditions
  if (
    (syncLagMs && syncLagMs > SYNC_LAG_WARNING_MS) ||
    (webhookLagMs && webhookLagMs > WEBHOOK_LAG_WARNING_MS) ||
    errorRate > ERROR_RATE_WARNING ||
    recentFailures > FAILURE_COUNT_WARNING
  ) {
    return 'degraded';
  }

  return 'healthy';
}

function calculateAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, val) => sum + val, 0) / values.length);
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, index)]);
}

export default router;