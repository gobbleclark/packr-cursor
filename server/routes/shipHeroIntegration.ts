/**
 * ShipHero Integration API Routes
 * 
 * Implements all user requirements for the ShipHero integration:
 * 1. Setup brand integration with email/password credentials
 * 2. Manual sync triggers
 * 3. Purchase Order management  
 * 4. Integration status monitoring
 * 5. Webhook management
 */

import { Router } from 'express';
import { z } from 'zod';
import { IStorage } from '../storage';
import { ShipHeroIntegrationService } from '../services/shipHeroIntegrationService';
import { ShipHeroScheduler } from '../services/shipHeroScheduler';
import { PurchaseOrderService } from '../services/purchaseOrderService';
import { createShipHeroWebhookRoutes } from './shipHeroWebhooks';

interface AuthenticatedRequest extends Request {
  user?: any;
}

const setupIntegrationSchema = z.object({
  brandId: z.string(),
  brandEmail: z.string().email(),
  brandPassword: z.string().min(6),
});

const createPOSchema = z.object({
  brandId: z.string(),
  poNumber: z.string().optional(),
  supplierName: z.string(),
  supplierEmail: z.string().email().optional(),
  warehouse: z.string().optional(),
  expectedDate: z.string().transform(str => new Date(str)),
  notes: z.string().optional(),
  lineItems: z.array(z.object({
    sku: z.string(),
    productName: z.string(),
    quantity: z.number().positive(),
    unitCost: z.number().optional(),
    expectedDate: z.string().transform(str => new Date(str)).optional(),
  }))
});

export function createShipHeroIntegrationRoutes(storage: IStorage): Router {
  const router = Router();
  
  const integrationService = new ShipHeroIntegrationService(storage);
  const scheduler = new ShipHeroScheduler(storage);
  const poService = new PurchaseOrderService(storage);
  
  // Start the scheduler when routes are initialized
  scheduler.startScheduler();

  /**
   * Set up ShipHero integration for a brand
   * POST /api/shiphero/setup
   */
  router.post('/setup', async (req: any, res) => {
    try {
      const { brandId, brandEmail, brandPassword } = setupIntegrationSchema.parse(req.body);
      
      console.log(`🔧 Setting up ShipHero integration for brand: ${brandId}`);
      
      // Setup integration via scheduler (includes 7-day backpull)
      await scheduler.setupNewBrandIntegration(brandId, brandEmail, brandPassword);
      
      res.json({
        success: true,
        message: 'ShipHero integration setup initiated',
        note: 'Historical 7-day backpull is running in background'
      });
      
    } catch (error) {
      console.error('❌ ShipHero setup failed:', error);
      res.status(500).json({
        error: 'Setup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get integration status for a brand
   * GET /api/shiphero/status/:brandId
   */
  router.get('/status/:brandId', async (req, res) => {
    try {
      const { brandId } = req.params;
      
      const brand = await storage.getBrand(brandId);
      if (!brand) {
        return res.status(404).json({ error: 'Brand not found' });
      }
      
      const hasCredentials = !!(brand.shipHeroApiKey && brand.shipHeroPassword);
      const schedulerStatus = scheduler.getSchedulerStatus();
      
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
          username: brand.shipHeroApiKey,
          passwordSet: true
        } : null,
        scheduler: schedulerStatus,
        lastSync: lastSyncOrder?.lastSyncAt || null,
        recentOrdersCount: recentOrders.length,
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
   * POST /api/shiphero/sync/:brandId
   */
  router.post('/sync/:brandId', async (req, res) => {
    try {
      const { brandId } = req.params;
      const { type = 'full' } = req.body;
      
      console.log(`🔄 Manual sync triggered for brand: ${brandId}, type: ${type}`);
      
      if (type === 'incremental') {
        await integrationService.performIncrementalSync(brandId);
      } else {
        await scheduler.triggerManualSync(brandId);
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
   * Product sync for a brand
   * POST /api/shiphero/sync-products/:brandId
   */
  router.post('/sync-products/:brandId', async (req, res) => {
    try {
      const { brandId } = req.params;
      
      console.log(`📦 Product sync triggered for brand: ${brandId}`);
      
      await integrationService.syncProducts(brandId);
      
      res.json({
        success: true,
        message: `Product sync completed for brand ${brandId}`
      });
      
    } catch (error) {
      console.error('❌ Product sync failed:', error);
      res.status(500).json({
        error: 'Product sync failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Create Purchase Order
   * POST /api/shiphero/purchase-orders
   */
  router.post('/purchase-orders', async (req, res) => {
    try {
      const poData = createPOSchema.parse(req.body);
      
      console.log(`📋 Creating Purchase Order for brand: ${poData.brandId}`);
      
      const purchaseOrder = await poService.createPurchaseOrder(poData);
      
      res.json({
        success: true,
        purchaseOrder,
        message: 'Purchase Order created successfully'
      });
      
    } catch (error) {
      console.error('❌ Purchase Order creation failed:', error);
      res.status(500).json({
        error: 'Purchase Order creation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get Purchase Orders for a brand
   * GET /api/shiphero/purchase-orders/:brandId
   */
  router.get('/purchase-orders/:brandId', async (req, res) => {
    try {
      const { brandId } = req.params;
      const { status, supplier, startDate, endDate } = req.query;
      
      const filters: any = {};
      if (status) filters.status = status;
      if (supplier) filters.supplierName = supplier;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      
      const purchaseOrders = await poService.getPurchaseOrders(brandId, filters);
      
      res.json({
        success: true,
        purchaseOrders,
        count: purchaseOrders.length
      });
      
    } catch (error) {
      console.error('❌ Purchase Orders fetch failed:', error);
      res.status(500).json({
        error: 'Purchase Orders fetch failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get Purchase Order details with line items
   * GET /api/shiphero/purchase-orders/details/:poId
   */
  router.get('/purchase-orders/details/:poId', async (req, res) => {
    try {
      const { poId } = req.params;
      
      const purchaseOrder = await poService.getPurchaseOrderDetails(poId);
      
      res.json({
        success: true,
        purchaseOrder
      });
      
    } catch (error) {
      console.error('❌ Purchase Order details fetch failed:', error);
      res.status(500).json({
        error: 'Purchase Order details fetch failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Update Purchase Order
   * PATCH /api/shiphero/purchase-orders/:poId
   */
  router.patch('/purchase-orders/:poId', async (req, res) => {
    try {
      const { poId } = req.params;
      const updates = req.body;
      
      // Transform date strings to Date objects if present
      if (updates.expectedDate) {
        updates.expectedDate = new Date(updates.expectedDate);
      }
      if (updates.lineItems) {
        updates.lineItems = updates.lineItems.map((item: any) => ({
          ...item,
          expectedDate: item.expectedDate ? new Date(item.expectedDate) : undefined
        }));
      }
      
      const purchaseOrder = await poService.updatePurchaseOrder(poId, updates);
      
      res.json({
        success: true,
        purchaseOrder,
        message: 'Purchase Order updated successfully'
      });
      
    } catch (error) {
      console.error('❌ Purchase Order update failed:', error);
      res.status(500).json({
        error: 'Purchase Order update failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Cancel Purchase Order
   * DELETE /api/shiphero/purchase-orders/:poId
   */
  router.delete('/purchase-orders/:poId', async (req, res) => {
    try {
      const { poId } = req.params;
      
      await poService.cancelPurchaseOrder(poId);
      
      res.json({
        success: true,
        message: 'Purchase Order cancelled successfully'
      });
      
    } catch (error) {
      console.error('❌ Purchase Order cancellation failed:', error);
      res.status(500).json({
        error: 'Purchase Order cancellation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get integration health and metrics
   * GET /api/shiphero/health
   */
  router.get('/health', async (req, res) => {
    try {
      const schedulerStatus = scheduler.getSchedulerStatus();
      
      // Get brands with ShipHero integrations
      const allBrands = await storage.getAllBrands?.() || [];
      const integratedBrands = allBrands.filter(brand => 
        brand.shipHeroApiKey && brand.shipHeroPassword
      );
      
      // Get recent sync statistics
      const recentSyncs = await storage.getRecentSyncStatus?.() || [];
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        scheduler: schedulerStatus,
        integrations: {
          totalBrands: allBrands.length,
          integratedBrands: integratedBrands.length,
          brands: integratedBrands.map(brand => ({
            id: brand.id,
            name: brand.name,
            username: brand.shipHeroApiKey
          }))
        },
        recentActivity: {
          syncCount: recentSyncs.length,
          lastSync: recentSyncs[0]?.lastSyncAt || null
        }
      });
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      res.status(500).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Mount webhook routes at /webhooks
  router.use('/webhooks', createShipHeroWebhookRoutes(storage));

  return router;
}