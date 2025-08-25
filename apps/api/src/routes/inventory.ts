import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@packr/database';
import { authenticateToken, requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const inventoryListSchema = z.object({
  q: z.string().optional(), // Search by SKU or product name
  brandId: z.string().optional(), // 3PL only
  warehouseId: z.string().optional(),
  stock: z.enum(['in', 'low', 'out']).optional(),
  incoming: z.boolean().optional(),
  after: z.string().optional(), // Cursor for keyset pagination
  limit: z.coerce.number().min(1).max(200).default(50),
});

const inventoryDetailSchema = z.object({
  id: z.string().cuid(),
});

const inventoryBySkuSchema = z.object({
  sku: z.string().min(1),
});

const bulkHideSchema = z.object({
  itemIds: z.array(z.string().cuid()),
});

/**
 * GET /api/inventory
 * List inventory items with filters and keyset pagination
 * RBAC: 3PL users see all brands they're assigned to, Brand users see only their brand
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const params = inventoryListSchema.parse(req.query);
    
    // Build base where clause with tenant scoping
    let whereClause: any = {
      tenantId: user.threeplId,
      active: true, // Only show active (non-hidden) items
    };

    // RBAC: Brand users can only see their brand's inventory
    if (user.role === 'BRAND_ADMIN' || user.role === 'BRAND_USER') {
      if (!user.brandId) {
        return res.status(403).json({ error: 'Brand user must be associated with a brand' });
      }
      whereClause.brandId = user.brandId;
    } else if (user.role === 'THREEPL_ADMIN' || user.role === 'THREEPL_USER') {
      // 3PL users can filter by brand or see all brands they have access to
      if (params.brandId) {
        // Verify the brand belongs to this 3PL
        const brand = await prisma.brand.findFirst({
          where: {
            id: params.brandId,
            threeplId: user.threeplId,
          },
        });
        
        if (!brand) {
          return res.status(404).json({ error: 'Brand not found' });
        }
        
        whereClause.brandId = params.brandId;
      }
      // If no brandId specified, show all brands for this 3PL (already handled by tenantId)
    }

    // Add warehouse filter
    if (params.warehouseId) {
      whereClause.warehouseId = params.warehouseId;
    }

    // Add stock status filter
    if (params.stock) {
      switch (params.stock) {
        case 'in':
          whereClause.available = { gt: 0 };
          break;
        case 'low':
          whereClause.available = { gt: 0, lte: 10 }; // Configurable threshold
          break;
        case 'out':
          whereClause.available = { lte: 0 };
          break;
      }
    }

    // Add incoming filter
    if (params.incoming !== undefined) {
      if (params.incoming) {
        whereClause.incoming = { gt: 0 };
      } else {
        whereClause.incoming = { lte: 0 };
      }
    }

    // Add search filter (SKU or product name)
    if (params.q) {
      whereClause.OR = [
        { sku: { contains: params.q, mode: 'insensitive' } },
        { productName: { contains: params.q, mode: 'insensitive' } },
      ];
    }

    // Keyset pagination
    if (params.after) {
      whereClause.id = { gt: params.after };
    }

    // Execute query with explicit column selection
    const items = await prisma.inventoryItem.findMany({
      where: whereClause,
      select: {
        id: true,
        sku: true,
        productName: true,
        onHand: true,
        available: true,
        incoming: true,
        warehouseId: true,
        lastTrackstarUpdateAt: true,
        updatedAt: true,
        brandId: true,
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { id: 'asc' },
      take: params.limit + 1, // +1 to check if there are more results
    });

    // Determine if there are more results and create cursor
    const hasMore = items.length > params.limit;
    const results = hasMore ? items.slice(0, -1) : items;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    // Calculate freshness for each item
    const itemsWithFreshness = results.map(item => {
      let freshness = 'stale';
      if (item.lastTrackstarUpdateAt) {
        const minutesAgo = (Date.now() - item.lastTrackstarUpdateAt.getTime()) / (1000 * 60);
        if (minutesAgo <= 2) freshness = 'live';
        else if (minutesAgo <= 10) freshness = 'recent';
      }

      return {
        ...item,
        freshness,
        // Hide brand info for brand users (they already know their brand)
        brand: user.role.startsWith('BRAND_') ? undefined : item.brand,
      };
    });

    res.json({
      data: itemsWithFreshness,
      pagination: {
        hasMore,
        nextCursor,
        limit: params.limit,
      },
    });

  } catch (error) {
    logger.error('Failed to fetch inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

/**
 * GET /api/inventory/:id
 * Get detailed inventory item with per-warehouse breakdown
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = inventoryDetailSchema.parse(req.params);

    // Build where clause with RBAC
    let whereClause: any = {
      id,
      tenantId: user.threeplId,
    };

    // Brand users can only see their brand's inventory
    if (user.role === 'BRAND_ADMIN' || user.role === 'BRAND_USER') {
      if (!user.brandId) {
        return res.status(403).json({ error: 'Brand user must be associated with a brand' });
      }
      whereClause.brandId = user.brandId;
    }

    const item = await prisma.inventoryItem.findFirst({
      where: whereClause,
      select: {
        id: true,
        sku: true,
        productName: true,
        trackstarProductId: true,
        trackstarVariantId: true,
        onHand: true,
        available: true,
        incoming: true,
        committed: true,
        unfulfillable: true,
        unsellable: true,
        sellable: true,
        awaiting: true,
        unitCost: true,
        active: true,
        warehouseId: true,
        lastTrackstarUpdateAt: true,
        rawData: true,
        createdAt: true,
        updatedAt: true,
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    // Calculate freshness
    let freshness = 'stale';
    if (item.lastTrackstarUpdateAt) {
      const minutesAgo = (Date.now() - item.lastTrackstarUpdateAt.getTime()) / (1000 * 60);
      if (minutesAgo <= 2) freshness = 'live';
      else if (minutesAgo <= 10) freshness = 'recent';
    }

    // Extract per-warehouse breakdown from rawData if available
    let warehouseBreakdown = null;
    if (item.rawData && typeof item.rawData === 'object' && 'inventory_by_warehouse_id' in item.rawData) {
      warehouseBreakdown = (item.rawData as any).inventory_by_warehouse_id;
    }

    res.json({
      ...item,
      freshness,
      warehouseBreakdown,
      // Hide brand info for brand users
      brand: user.role.startsWith('BRAND_') ? undefined : item.brand,
    });

  } catch (error) {
    logger.error('Failed to fetch inventory item:', error);
    res.status(500).json({ error: 'Failed to fetch inventory item' });
  }
});

/**
 * GET /api/inventory/sku/:sku
 * Get inventory items by SKU (convenience endpoint)
 */
router.get('/sku/:sku', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { sku } = inventoryBySkuSchema.parse(req.params);

    // Build where clause with RBAC
    let whereClause: any = {
      sku,
      tenantId: user.threeplId,
    };

    // Brand users can only see their brand's inventory
    if (user.role === 'BRAND_ADMIN' || user.role === 'BRAND_USER') {
      if (!user.brandId) {
        return res.status(403).json({ error: 'Brand user must be associated with a brand' });
      }
      whereClause.brandId = user.brandId;
    }

    const items = await prisma.inventoryItem.findMany({
      where: whereClause,
      select: {
        id: true,
        sku: true,
        productName: true,
        onHand: true,
        available: true,
        incoming: true,
        warehouseId: true,
        lastTrackstarUpdateAt: true,
        updatedAt: true,
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { warehouseId: 'asc' },
    });

    // Calculate freshness for each item
    const itemsWithFreshness = items.map(item => {
      let freshness = 'stale';
      if (item.lastTrackstarUpdateAt) {
        const minutesAgo = (Date.now() - item.lastTrackstarUpdateAt.getTime()) / (1000 * 60);
        if (minutesAgo <= 2) freshness = 'live';
        else if (minutesAgo <= 10) freshness = 'recent';
      }

      return {
        ...item,
        freshness,
        // Hide brand info for brand users
        brand: user.role.startsWith('BRAND_') ? undefined : item.brand,
      };
    });

    res.json({
      data: itemsWithFreshness,
      totalWarehouses: items.length,
    });

  } catch (error) {
    logger.error('Failed to fetch inventory by SKU:', error);
    res.status(500).json({ error: 'Failed to fetch inventory by SKU' });
  }
});

/**
 * POST /api/inventory/bulk-hide
 * Bulk hide inventory items - removes from sync, search, and reports
 * RBAC: Users can only hide items from their accessible brands
 */
router.post('/bulk-hide', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { itemIds } = bulkHideSchema.parse(req.body);

    if (itemIds.length === 0) {
      return res.status(400).json({ error: 'No items specified' });
    }

    // Build where clause with RBAC
    let whereClause: any = {
      id: { in: itemIds },
      tenantId: user.threeplId,
    };

    // Brand users can only hide their brand's inventory
    if (user.role === 'BRAND_ADMIN' || user.role === 'BRAND_USER') {
      if (!user.brandId) {
        return res.status(403).json({ error: 'Brand user must be associated with a brand' });
      }
      whereClause.brandId = user.brandId;
    }

    // First, verify all items exist and user has access
    const itemsToHide = await prisma.inventoryItem.findMany({
      where: whereClause,
      select: {
        id: true,
        sku: true,
        productName: true,
        brandId: true,
        brand: {
          select: {
            name: true,
          },
        },
      },
    });

    if (itemsToHide.length !== itemIds.length) {
      return res.status(404).json({ 
        error: 'Some items not found or access denied',
        found: itemsToHide.length,
        requested: itemIds.length,
      });
    }

    // Mark items as hidden (soft delete approach)
    const result = await prisma.inventoryItem.updateMany({
      where: whereClause,
      data: {
        active: false, // This will exclude them from sync and search
      },
    });

    // Also mark related products as inactive to exclude from sync jobs
    const skus = itemsToHide.map(item => item.sku);
    await prisma.product.updateMany({
      where: {
        sku: { in: skus },
        brandId: { in: itemsToHide.map(item => item.brandId) },
      },
      data: {
        // Add a hidden flag to metadata to exclude from sync
        metadata: {
          hidden: true,
          hiddenAt: new Date().toISOString(),
          hiddenBy: user.id,
        },
      },
    });

    logger.info('Bulk hide products completed', {
      userId: user.id,
      itemCount: result.count,
      skus: skus,
      brands: [...new Set(itemsToHide.map(item => item.brand?.name))],
    });

    res.json({
      success: true,
      hiddenCount: result.count,
      items: itemsToHide.map(item => ({
        id: item.id,
        sku: item.sku,
        productName: item.productName,
        brandName: item.brand?.name,
      })),
    });

  } catch (error) {
    logger.error('Failed to bulk hide inventory items:', error);
    res.status(500).json({ error: 'Failed to hide inventory items' });
  }
});

export default router;
