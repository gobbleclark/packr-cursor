import express from 'express';
import { prisma } from '@packr/database';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * Test endpoint to verify API is working
 * GET /api/dashboard/test
 */
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Dashboard API is working',
    timestamp: new Date().toISOString()
  });
});

/**
 * Get dashboard statistics
 * GET /api/dashboard/stats
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { brandId, startDate, endDate } = req.query;
    
    // Debug logging
    logger.info(`Dashboard stats request - brandId: ${brandId}, startDate: ${startDate}, endDate: ${endDate}`);
    
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

    // Get total orders that have shipments in the date range (for date-filtered metrics)
    // Debug the where clause
    logger.info(`Order where clause: ${JSON.stringify(orderWhereClause, null, 2)}`);
    
    const totalOrdersInDateRange = await prisma.order.count({
      where: orderWhereClause
    });

    // Get fulfilled orders in the date range (orders with shipped/delivered shipments in date range)
    const fulfilledOrdersInDateRange = await prisma.order.count({
      where: {
        ...orderWhereClause,
        shipments: {
          some: {
            status: { in: ['shipped', 'delivered'] },
            ...(startDate || endDate ? {
              shippedAt: {
                ...(startDate ? { gte: new Date(startDate as string) } : {}),
                ...(endDate ? { lte: new Date(endDate as string) } : {})
              }
            } : {})
          }
        }
      }
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

    // Debug logging
    logger.info(`Query results - Total in date range: ${totalOrdersInDateRange}, Fulfilled in date range: ${fulfilledOrdersInDateRange}, Current pending: ${unfulfilledOrders}`);

    // Get late orders - orders that were shipped after their required ship date within the date range
    // EXCLUDE orders flagged as having backorder items (inventory constraints)
    let lateOrdersQuery = `
      SELECT COUNT(DISTINCT o.id) as count
      FROM orders o
      JOIN shipments s ON o.id = s."orderId"
      WHERE s.status IN ('shipped', 'delivered')
        AND o.metadata->>'required_ship_date_parsed' IS NOT NULL
        AND s."shippedAt" > (o.metadata->>'required_ship_date_parsed')::timestamp
        AND (o.metadata->'backorder_info'->>'has_backorder_items')::boolean IS NOT TRUE
    `;
    
    const queryParams: any[] = [];
    let paramIndex = 1;
    
    // Add date filtering
    if (startDate) {
      lateOrdersQuery += ` AND s."shippedAt" >= $${paramIndex}`;
      queryParams.push(new Date(startDate as string));
      paramIndex++;
    }
    if (endDate) {
      lateOrdersQuery += ` AND s."shippedAt" <= $${paramIndex}`;
      queryParams.push(new Date(endDate as string));
      paramIndex++;
    }
    
    // Add brand/3PL filtering
    if (threeplIds.length > 0) {
      lateOrdersQuery += ` AND (o."brandId" IN (SELECT id FROM brands WHERE "threeplId" = ANY($${paramIndex}))`;
      queryParams.push(threeplIds);
      paramIndex++;
      
      if (brandIds.length > 0) {
        lateOrdersQuery += ` OR o."brandId" = ANY($${paramIndex})`;
        queryParams.push(brandIds);
        paramIndex++;
      }
      lateOrdersQuery += ')';
    } else if (brandIds.length > 0) {
      lateOrdersQuery += ` AND o."brandId" = ANY($${paramIndex})`;
      queryParams.push(brandIds);
      paramIndex++;
    }
    
    logger.info(`Late orders query: ${lateOrdersQuery}`);
    logger.info(`Late orders params: ${JSON.stringify(queryParams)}`);
    
    const lateOrdersResult = await prisma.$queryRawUnsafe(lateOrdersQuery, ...queryParams);
    const lateOrders = parseInt((lateOrdersResult as any)[0]?.count || '0');
    
    logger.info(`Late orders result: ${lateOrders}`);

    // Get accessible brands count
    let totalBrands = 0;
    try {
      if (threeplIds.length > 0) {
        totalBrands = await prisma.brand.count({
          where: { threeplId: { in: threeplIds } }
        });
      } else {
        totalBrands = brandIds.length;
      }
      logger.info(`Total brands: ${totalBrands}`);
    } catch (error) {
      logger.error('Error getting total brands:', error);
      throw error;
    }

    // Get orders by brand (simplified query to avoid complex where clause issues)
    let ordersByBrand: any[] = [];
    try {
      let ordersByBrandWhereClause: any = {};
      
      // Add brand/3PL filtering for orders by brand
      if (threeplIds.length > 0) {
        const accessConditions = [
          { brand: { threeplId: { in: threeplIds } } },
          ...(brandIds.length > 0 ? [{ brandId: { in: brandIds } }] : [])
        ];
        ordersByBrandWhereClause.OR = accessConditions;
      } else if (brandIds.length > 0) {
        ordersByBrandWhereClause.brandId = { in: brandIds };
      }
      
      // Add brand filtering if specified
      if (brandId && brandId !== 'all') {
        ordersByBrandWhereClause.brandId = brandId as string;
      }
      
      logger.info(`Orders by brand where clause: ${JSON.stringify(ordersByBrandWhereClause, null, 2)}`);
      
      ordersByBrand = await prisma.order.groupBy({
        by: ['brandId'],
        where: ordersByBrandWhereClause,
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
      
      logger.info(`Orders by brand result: ${ordersByBrand.length} brands`);
    } catch (error) {
      logger.error('Error getting orders by brand:', error);
      throw error;
    }

    // Get brand details for the grouped results
    let brandDetails: any[] = [];
    try {
      const brandIds = ordersByBrand.map(item => item.brandId);
      logger.info(`Getting brand details for IDs: ${JSON.stringify(brandIds)}`);
      
      brandDetails = await prisma.brand.findMany({
        where: {
          id: { in: brandIds }
        },
        select: {
          id: true,
          name: true
        }
      });
      
      logger.info(`Brand details result: ${brandDetails.length} brands found`);
    } catch (error) {
      logger.error('Error getting brand details:', error);
      throw error;
    }

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
          brandId: brandStat.brandId,
          metadata: {
            path: ['required_ship_date_parsed'],
            lt: new Date().toISOString()
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
      totalOrders: totalOrdersInDateRange,
      unfulfilledOrders,
      fulfilledOrders: fulfilledOrdersInDateRange,
      lateOrders,
      totalBrands,
      ordersByBrand: ordersByBrandWithNames,
      lateOrdersByBrand
    });

  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ 
      error: 'Failed to fetch dashboard statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
