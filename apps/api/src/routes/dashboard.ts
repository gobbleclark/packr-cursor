import express from 'express';
import { prisma } from '@packr/database';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * Get dashboard statistics
 * GET /api/dashboard/stats
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { brandId, startDate, endDate } = req.query;
    
    // Get user's memberships to determine accessible brands
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      include: {
        brand: true,
        threepl: true
      }
    });

    let brandIds: string[] = [];
    let threeplIds: string[] = [];

    // Determine which brands/3PLs the user can access
    memberships.forEach(membership => {
      if (membership.brandId) {
        brandIds.push(membership.brandId);
      }
      if (membership.threeplId) {
        threeplIds.push(membership.threeplId);
        // If user has 3PL access, get all brands under that 3PL
        // This will be handled in the query
      }
    });

    // Build base where clause for orders
    let orderWhereClause: any = {};
    
    // Add date filtering based on shipped date
    if (startDate || endDate) {
      const shipmentDateFilter: any = {};
      if (startDate) {
        shipmentDateFilter.gte = new Date(startDate as string);
      }
      if (endDate) {
        shipmentDateFilter.lte = new Date(endDate as string);
      }
      
      // Filter orders that have shipments within the date range
      orderWhereClause.shipments = {
        some: {
          shippedAt: shipmentDateFilter
        }
      };
    }
    
    // Add brand filtering if specified
    if (brandId && brandId !== 'all') {
      orderWhereClause.brandId = brandId as string;
    }
    
    if (threeplIds.length > 0) {
      // User has 3PL access - can see all orders for their 3PLs
      const accessConditions = [
        { brand: { threeplId: { in: threeplIds } } },
        ...(brandIds.length > 0 ? [{ brandId: { in: brandIds } }] : [])
      ];
      
      if (orderWhereClause.brandId) {
        // If specific brand is requested, ensure user has access to it
        orderWhereClause.AND = [
          { brandId: orderWhereClause.brandId },
          { OR: accessConditions }
        ];
        delete orderWhereClause.brandId;
      } else {
        orderWhereClause.OR = accessConditions;
      }
    } else if (brandIds.length > 0) {
      // User only has brand access
      if (orderWhereClause.brandId) {
        // Ensure requested brand is in user's accessible brands
        if (!brandIds.includes(orderWhereClause.brandId)) {
          orderWhereClause.brandId = { in: [] }; // No access
        }
      } else {
        orderWhereClause.brandId = { in: brandIds };
      }
    } else {
      // No access - return empty stats
      return res.json({
        totalOrders: 0,
        unfulfilledOrders: 0,
        fulfilledOrders: 0,
        lateOrders: 0,
        totalBrands: 0,
        ordersByBrand: [],
        lateOrdersByBrand: []
      });
    }

    // Get total orders
    const totalOrders = await prisma.order.count({
      where: orderWhereClause
    });

    // Build separate where clause for current pending orders (no date filtering)
    let currentPendingWhereClause: any = {};
    
    // Add brand filtering if specified
    if (brandId && brandId !== 'all') {
      currentPendingWhereClause.brandId = brandId as string;
    }
    
    // Apply same access control logic for current pending orders
    if (threeplIds.length > 0) {
      const accessConditions = [
        { brand: { threeplId: { in: threeplIds } } },
        ...(brandIds.length > 0 ? [{ brandId: { in: brandIds } }] : [])
      ];
      
      if (currentPendingWhereClause.brandId) {
        currentPendingWhereClause.AND = [
          { brandId: currentPendingWhereClause.brandId },
          { OR: accessConditions }
        ];
        delete currentPendingWhereClause.brandId;
      } else {
        currentPendingWhereClause.OR = accessConditions;
      }
    } else if (brandIds.length > 0) {
      if (currentPendingWhereClause.brandId) {
        if (!brandIds.includes(currentPendingWhereClause.brandId)) {
          currentPendingWhereClause.brandId = { in: [] };
        }
      } else {
        currentPendingWhereClause.brandId = { in: brandIds };
      }
    }

    // Get current pending orders (orders without shipments or with incomplete shipments) - no date filtering
    const unfulfilledOrders = await prisma.order.count({
      where: {
        ...currentPendingWhereClause,
        OR: [
          { shipments: { none: {} } }, // No shipments
          { 
            shipments: {
              some: {
                status: { notIn: ['shipped', 'delivered'] }
              }
            }
          }
        ]
      }
    });

    // Get fulfilled orders
    const fulfilledOrders = totalOrders - unfulfilledOrders;

    // Get late orders (required ship date < current date and not shipped)
    const now = new Date();
    const lateOrders = await prisma.order.count({
      where: {
        ...orderWhereClause,
        metadata: {
          path: ['required_ship_date_parsed'],
          lt: now.toISOString()
        },
        OR: [
          { shipments: { none: {} } },
          {
            shipments: {
              every: {
                status: { notIn: ['shipped', 'delivered'] }
              }
            }
          }
        ]
      }
    });

    // Get accessible brands count
    let totalBrands = 0;
    if (threeplIds.length > 0) {
      totalBrands = await prisma.brand.count({
        where: { threeplId: { in: threeplIds } }
      });
    } else {
      totalBrands = brandIds.length;
    }

    // Get orders by brand
    const ordersByBrand = await prisma.order.groupBy({
      by: ['brandId'],
      where: orderWhereClause,
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10 // Top 10 brands
    });

    // Get brand details for the grouped results
    const brandDetails = await prisma.brand.findMany({
      where: {
        id: { in: ordersByBrand.map(item => item.brandId) }
      },
      select: {
        id: true,
        name: true
      }
    });

    // Combine brand details with order counts
    const ordersByBrandWithNames = ordersByBrand.map(item => {
      const brand = brandDetails.find(b => b.id === item.brandId);
      return {
        brandId: item.brandId,
        brandName: brand?.name || 'Unknown Brand',
        totalOrders: item._count.id,
        unfulfilledOrders: 0, // Will be calculated separately
        fulfilledOrders: 0,
        lateOrders: 0
      };
    });

    // Get unfulfilled orders by brand
    for (const brandStat of ordersByBrandWithNames) {
      const unfulfilled = await prisma.order.count({
        where: {
          ...orderWhereClause,
          brandId: brandStat.brandId,
          OR: [
            { shipments: { none: {} } },
            { 
              shipments: {
                some: {
                  status: { notIn: ['shipped', 'delivered'] }
                }
              }
            }
          ]
        }
      });

      const late = await prisma.order.count({
        where: {
          ...orderWhereClause,
          brandId: brandStat.brandId,
          metadata: {
            path: ['required_ship_date_parsed'],
            lt: now.toISOString()
          },
          OR: [
            { shipments: { none: {} } },
            {
              shipments: {
                every: {
                  status: { notIn: ['shipped', 'delivered'] }
                }
              }
            }
          ]
        }
      });

      brandStat.unfulfilledOrders = unfulfilled;
      brandStat.fulfilledOrders = brandStat.totalOrders - unfulfilled;
      brandStat.lateOrders = late;
    }

    // Get late orders by brand (top 5 with most late orders)
    const lateOrdersByBrand = ordersByBrandWithNames
      .filter(brand => brand.lateOrders > 0)
      .sort((a, b) => b.lateOrders - a.lateOrders)
      .slice(0, 5);

    res.json({
      totalOrders,
      unfulfilledOrders,
      fulfilledOrders,
      lateOrders,
      totalBrands,
      ordersByBrand: ordersByBrandWithNames,
      lateOrdersByBrand
    });

  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
