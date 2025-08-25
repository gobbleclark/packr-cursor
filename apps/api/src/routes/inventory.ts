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

export default router;
