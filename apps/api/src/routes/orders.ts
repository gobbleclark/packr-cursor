import express from 'express';
import { prisma } from '@packr/database';
import { logger } from '../utils/logger';
import { trackstarIntegrationService } from '../integrations/trackstar/service';
import { trackstarClient } from '../integrations/trackstar/client';

const router = express.Router();

/**
 * Get all orders with filtering and pagination
 * GET /api/orders?status=pending&brandId=xxx&page=1&limit=50
 */
router.get('/', async (req, res) => {
  try {
    const { 
      status, 
      brandId, 
      search, 
      page = 1, 
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Get user info from auth headers
    const userRole = req.headers['x-user-role'] || 'THREEPL_USER';
    const userThreeplId = req.headers['x-threepl-id'] as string;
    const userBrandId = req.headers['x-brand-id'] as string;

    // Build where clause based on user role
    let whereClause: any = {};

    if (userRole.includes('THREEPL')) {
      // 3PL users can see all brands under them
      whereClause.threeplId = userThreeplId;
      if (brandId && brandId !== 'all') {
        whereClause.brandId = brandId;
      }
    } else {
      // Brand users can only see their own orders
      whereClause.brandId = userBrandId;
    }

    // Apply status filter
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    // Apply search filter
    if (search) {
      whereClause.OR = [
        { orderNumber: { contains: search as string, mode: 'insensitive' } },
        { customerName: { contains: search as string, mode: 'insensitive' } },
        { customerEmail: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    // Calculate pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get orders with related data
    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        include: {
          brand: {
            select: {
              id: true,
              name: true
            }
          },
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true
                }
              }
            }
          },
          shipments: {
            select: {
              id: true,
              trackingNumber: true,
              carrier: true,
              service: true,
              shippedAt: true
            }
          }
        },
        orderBy: {
          [sortBy as string]: sortOrder as 'asc' | 'desc'
        },
        skip,
        take: limitNum
      }),
      prisma.order.count({ where: whereClause })
    ]);

    // Transform orders for frontend
    const transformedOrders = orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName || 'N/A',
      customerEmail: order.customerEmail || 'N/A',
      status: order.status,
      total: order.total,
      orderDate: order.orderDate,
      dueDate: order.dueDate,
      brandName: order.brand?.name,
      createdAt: order.createdAt,
      orderItems: order.orderItems.map(item => ({
        id: item.id,
        productName: item.product?.name || 'N/A',
        sku: item.product?.sku || 'N/A',
        quantity: item.quantity,
        price: item.price,
        total: item.total
      })),
      shipments: order.shipments
    }));

    res.json({
      success: true,
      orders: transformedOrders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });

  } catch (error: any) {
    logger.error('Failed to fetch orders:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get a specific order by ID with full details
 * GET /api/orders/:orderId
 */
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Get user info from auth headers
    const userRole = req.headers['x-user-role'] || 'THREEPL_USER';
    const userThreeplId = req.headers['x-threepl-id'] as string;
    const userBrandId = req.headers['x-brand-id'] as string;

    // Build where clause based on user role
    let whereClause: any = { id: orderId };

    if (userRole.includes('THREEPL')) {
      whereClause.threeplId = userThreeplId;
    } else {
      whereClause.brandId = userBrandId;
    }

    const order = await prisma.order.findFirst({
      where: whereClause,
      include: {
        brand: {
          select: {
            id: true,
            name: true
          }
        },
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true
              }
            }
          }
        },
        shipments: {
          select: {
            id: true,
            trackingNumber: true,
            carrier: true,
            service: true,
            shippedAt: true,
            status: true,
            rawData: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Transform order for frontend
    const transformedOrder = {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName || 'N/A',
      customerEmail: order.customerEmail || 'N/A',
      status: order.status,
      total: order.total,
      subtotal: order.subtotal,
      tax: order.tax,
      shipping: order.shipping,
      orderDate: order.orderDate,
      dueDate: order.dueDate,
      brandName: order.brand?.name,
      rawData: order.rawData,
      notes: order.rawData?.notes || [],
      orderItems: order.orderItems.map(item => ({
        id: item.id,
        productName: item.product?.name || 'N/A',
        sku: item.product?.sku || 'N/A',
        quantity: item.quantity,
        price: item.price,
        total: item.total
      })),
      shipments: order.shipments
    };

    res.json({
      success: true,
      order: transformedOrder
    });

  } catch (error: any) {
    logger.error('Failed to fetch order details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Update order status
 * PUT /api/orders/:orderId/status
 */
router.put('/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Get user info from auth headers
    const userRole = req.headers['x-user-role'] || 'THREEPL_USER';
    const userThreeplId = req.headers['x-threepl-id'] as string;
    const userBrandId = req.headers['x-brand-id'] as string;

    // Build where clause based on user role
    let whereClause: any = { id: orderId };

    if (userRole.includes('THREEPL')) {
      whereClause.threeplId = userThreeplId;
    } else {
      whereClause.brandId = userBrandId;
    }

    // Check if order exists and user has access
    const existingOrder = await prisma.order.findFirst({
      where: whereClause
    });

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if Trackstar integration exists and update Trackstar FIRST
    let trackstarSyncRequired = false;
    if (existingOrder.brandId) {
      const integration = await prisma.brandIntegration.findUnique({
        where: {
          brandId_provider: {
            brandId: existingOrder.brandId,
            provider: 'TRACKSTAR'
          }
        }
      });

      if (integration && integration.status === 'ACTIVE' && existingOrder.externalId) {
        trackstarSyncRequired = true;
        logger.info(`Updating order status in Trackstar first for order ${orderId}`);
        
        try {
          // First verify the order exists in Trackstar using direct endpoint
          try {
            await trackstarClient.instance.getOrderById(integration.accessToken, existingOrder.externalId);
            logger.info(`Verified order ${existingOrder.orderNumber} exists in Trackstar`);
          } catch (lookupError: any) {
            // If lookup fails with 404 or 422, the order doesn't exist
            if (lookupError.response?.status === 404 || lookupError.response?.status === 422) {
              logger.warn(`Order ${existingOrder.orderNumber} (${existingOrder.externalId}) no longer exists in Trackstar/ShipHero`);
              return res.status(410).json({
                success: false,
                error: 'Order no longer exists in Trackstar/ShipHero system. Cannot sync updates.',
                code: 'ORDER_NOT_FOUND_IN_TRACKSTAR',
                suggestion: 'This order may have been deleted from ShipHero. Consider marking it as archived locally.'
              });
            } else {
              throw lookupError; // Re-throw other errors
            }
          }
          
          await trackstarClient.instance.updateOrderStatus(integration.accessToken, existingOrder.externalId, status);
          logger.info('Successfully updated order status in Trackstar');
        } catch (trackstarError: any) {
          logger.error('Failed to update order status in Trackstar:', trackstarError.message);
          return res.status(500).json({
            success: false,
            error: 'Failed to update order status in Trackstar. Local data not modified to maintain consistency.',
            trackstarError: trackstarError.message
          });
        }
      }
    }

    // Only update local database if Trackstar update succeeded (or no Trackstar integration)
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status }
    });

    res.json({
      success: true,
      order: updatedOrder,
      trackstarSync: trackstarSyncRequired ? 'success' : 'not_required'
    });

  } catch (error: any) {
    logger.error('Failed to update order status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Update shipping address
 * PUT /api/orders/:orderId/shipping-address
 */
router.put('/:orderId/shipping-address', async (req, res) => {
  try {
    const { orderId } = req.params;
    const shippingAddress = req.body;

    // Get user info from auth headers
    const userRole = req.headers['x-user-role'] || 'THREEPL_USER';
    const userThreeplId = req.headers['x-threepl-id'] as string;
    const userBrandId = req.headers['x-brand-id'] as string;

    // Build where clause based on user role
    let whereClause: any = { id: orderId };

    if (userRole.includes('THREEPL')) {
      whereClause.threeplId = userThreeplId;
    } else {
      whereClause.brandId = userBrandId;
    }

    // Check if order exists and user has access
    const existingOrder = await prisma.order.findFirst({
      where: whereClause
    });

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Update rawData with new shipping address
    const currentRawData = existingOrder.rawData || {};
    const updatedRawData = {
      ...currentRawData,
      ship_to_address: {
        full_name: shippingAddress.fullName,
        company: shippingAddress.company,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2,
        city: shippingAddress.city,
        state: shippingAddress.state,
        zip_code: shippingAddress.zipCode,
        country: shippingAddress.country,
        phone: shippingAddress.phone,
        email: shippingAddress.email
      }
    };

    // Check if Trackstar integration exists and update Trackstar FIRST
    let trackstarSyncRequired = false;
    if (existingOrder.brandId) {
      const integration = await prisma.brandIntegration.findUnique({
        where: {
          brandId_provider: {
            brandId: existingOrder.brandId,
            provider: 'TRACKSTAR'
          }
        }
      });

      if (integration && integration.status === 'ACTIVE' && existingOrder.externalId) {
        trackstarSyncRequired = true;
        logger.info(`Updating shipping address in Trackstar first for order ${orderId}`);
        
        try {
          // First verify the order exists in Trackstar using direct endpoint
          try {
            await trackstarClient.instance.getOrderById(integration.accessToken, existingOrder.externalId);
            logger.info(`Verified order ${existingOrder.orderNumber} exists in Trackstar`);
          } catch (lookupError: any) {
            // If lookup fails with 404 or 422, the order doesn't exist
            if (lookupError.response?.status === 404 || lookupError.response?.status === 422) {
              logger.warn(`Order ${existingOrder.orderNumber} (${existingOrder.externalId}) no longer exists in Trackstar/ShipHero`);
              return res.status(410).json({
                success: false,
                error: 'Order no longer exists in Trackstar/ShipHero system. Cannot sync updates.',
                code: 'ORDER_NOT_FOUND_IN_TRACKSTAR',
                suggestion: 'This order may have been deleted from ShipHero. Consider marking it as archived locally.'
              });
            } else {
              throw lookupError; // Re-throw other errors
            }
          }
          
          await trackstarClient.instance.updateOrderAddress(integration.accessToken, existingOrder.externalId, shippingAddress);
          logger.info('Successfully updated shipping address in Trackstar');
        } catch (trackstarError: any) {
          logger.error('Failed to update shipping address in Trackstar:', trackstarError.message);
          return res.status(500).json({
            success: false,
            error: 'Failed to update shipping address in Trackstar. Local data not modified to maintain consistency.',
            trackstarError: trackstarError.message
          });
        }
      }
    }

    // Only update local database if Trackstar update succeeded (or no Trackstar integration)
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { 
        rawData: updatedRawData,
        customerName: shippingAddress.fullName,
        customerEmail: shippingAddress.email
      }
    });

    res.json({
      success: true,
      order: updatedOrder,
      trackstarSync: trackstarSyncRequired ? 'success' : 'not_required'
    });

  } catch (error: any) {
    logger.error('Failed to update shipping address:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Update shipping information
 * PUT /api/orders/:orderId/shipping
 */
router.put('/:orderId/shipping', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { carrier, service } = req.body;

    // Get user info from auth headers
    const userRole = req.headers['x-user-role'] || 'THREEPL_USER';
    const userThreeplId = req.headers['x-threepl-id'] as string;
    const userBrandId = req.headers['x-brand-id'] as string;

    // Build where clause based on user role
    let whereClause: any = { id: orderId };

    if (userRole.includes('THREEPL')) {
      whereClause.threeplId = userThreeplId;
    } else {
      whereClause.brandId = userBrandId;
    }

    // Check if order exists and user has access
    const existingOrder = await prisma.order.findFirst({
      where: whereClause,
      include: { shipments: true }
    });

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if Trackstar integration exists and update Trackstar FIRST
    let trackstarSyncRequired = false;
    if (existingOrder.brandId) {
      const integration = await prisma.brandIntegration.findUnique({
        where: {
          brandId_provider: {
            brandId: existingOrder.brandId,
            provider: 'TRACKSTAR'
          }
        }
      });

      if (integration && integration.status === 'ACTIVE' && existingOrder.externalId) {
        trackstarSyncRequired = true;
        logger.info(`Updating shipping carrier/service in Trackstar first for order ${orderId}`);
        
        try {
          // First verify the order exists in Trackstar using direct endpoint
          try {
            await trackstarClient.instance.getOrderById(integration.accessToken, existingOrder.externalId);
            logger.info(`Verified order ${existingOrder.orderNumber} exists in Trackstar`);
          } catch (lookupError: any) {
            // If lookup fails with 404 or 422, the order doesn't exist
            if (lookupError.response?.status === 404 || lookupError.response?.status === 422) {
              logger.warn(`Order ${existingOrder.orderNumber} (${existingOrder.externalId}) no longer exists in Trackstar/ShipHero`);
              return res.status(410).json({
                success: false,
                error: 'Order no longer exists in Trackstar/ShipHero system. Cannot sync updates.',
                code: 'ORDER_NOT_FOUND_IN_TRACKSTAR',
                suggestion: 'This order may have been deleted from ShipHero. Consider marking it as archived locally.'
              });
            } else {
              throw lookupError; // Re-throw other errors
            }
          }
          
          await trackstarClient.instance.updateOrderShipping(integration.accessToken, existingOrder.externalId, { carrier, service });
          logger.info('Successfully updated shipping carrier/service in Trackstar');
        } catch (trackstarError: any) {
          logger.error('Failed to update shipping carrier/service in Trackstar:', trackstarError.message);
          return res.status(500).json({
            success: false,
            error: 'Failed to update shipping information in Trackstar. Local data not modified to maintain consistency.',
            trackstarError: trackstarError.message
          });
        }
      }
    }

    // Only update local database if Trackstar update succeeded (or no Trackstar integration)
    
    // Update the order's rawData with the new shipping method
    const updatedRawData = {
      ...existingOrder.rawData,
      shipping_method: {
        carrier,
        service
      }
    };

    await prisma.order.update({
      where: { id: orderId },
      data: { rawData: updatedRawData }
    });

    // Also update/create shipment record
    if (existingOrder.shipments.length > 0) {
      // Update the first shipment
      await prisma.shipment.update({
        where: { id: existingOrder.shipments[0].id },
        data: { carrier, service }
      });
    } else {
      // Create new shipment
      await prisma.shipment.create({
        data: {
          threeplId: existingOrder.threeplId,
          brandId: existingOrder.brandId,
          orderId: existingOrder.id,
          carrier,
          service,
          status: 'PENDING'
        }
      });
    }

    res.json({
      success: true,
      message: 'Shipping information updated',
      trackstarSync: trackstarSyncRequired ? 'success' : 'not_required'
    });

  } catch (error: any) {
    logger.error('Failed to update shipping information:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Add order note
 * POST /api/orders/:orderId/notes
 */
router.post('/:orderId/notes', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { content } = req.body;

    // Get user info from auth headers
    const userRole = req.headers['x-user-role'] || 'THREEPL_USER';
    const userThreeplId = req.headers['x-threepl-id'] as string;
    const userBrandId = req.headers['x-brand-id'] as string;
    const userId = req.headers['x-user-id'] as string;

    // Build where clause based on user role
    let whereClause: any = { id: orderId };

    if (userRole.includes('THREEPL')) {
      whereClause.threeplId = userThreeplId;
    } else {
      whereClause.brandId = userBrandId;
    }

    // Check if order exists and user has access
    const existingOrder = await prisma.order.findFirst({
      where: whereClause
    });

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // For now, store notes in the order's rawData
    // In a production system, you'd want a separate OrderNote model
    const currentRawData = existingOrder.rawData || {};
    const notes = currentRawData.notes || [];
    
    const newNote = {
      id: `note_${Date.now()}`,
      content,
      createdBy: userId || 'unknown',
      createdByName: 'Current User', // TODO: Get from user lookup
      createdAt: new Date().toISOString()
    };

    notes.push(newNote);

    const updatedRawData = {
      ...currentRawData,
      notes
    };

    await prisma.order.update({
      where: { id: orderId },
      data: { rawData: updatedRawData }
    });

    res.json({
      success: true,
      note: newNote
    });

  } catch (error: any) {
    logger.error('Failed to add order note:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get order notes
 * GET /api/orders/:orderId/notes
 */
router.get('/:orderId/notes', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Get user info from auth headers
    const userRole = req.headers['x-user-role'] || 'THREEPL_USER';
    const userThreeplId = req.headers['x-threepl-id'] as string;
    const userBrandId = req.headers['x-brand-id'] as string;

    // Build where clause based on user role
    let whereClause: any = { id: orderId };

    if (userRole.includes('THREEPL')) {
      whereClause.threeplId = userThreeplId;
    } else {
      whereClause.brandId = userBrandId;
    }

    // Check if order exists and user has access
    const existingOrder = await prisma.order.findFirst({
      where: whereClause
    });

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const notes = existingOrder.rawData?.notes || [];

    res.json({
      success: true,
      notes
    });

  } catch (error: any) {
    logger.error('Failed to get order notes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Search orders in Trackstar (for debugging)
 */
router.get('/trackstar-search/:searchTerm?', async (req, res) => {
  try {
    const { searchTerm } = req.params;

    // Find any brand with active Trackstar integration to use for the query
    const integration = await prisma.brandIntegration.findFirst({
      where: {
        provider: 'TRACKSTAR',
        status: 'ACTIVE'
      },
      include: {
        brand: true
      }
    });

    if (!integration) {
      return res.status(404).json({
        success: false,
        error: 'No active Trackstar integration found'
      });
    }

    try {
      // Get recent orders to see what's available
      const filters: any = { limit: 10 };
      if (searchTerm && searchTerm !== 'recent') {
        filters.order_number = searchTerm;
      }
      
      const trackstarOrders = await trackstarClient.instance.getOrders(integration.accessToken, filters);
      
      res.json({
        success: true,
        orders: trackstarOrders.data.map((order: any) => ({
          id: order.id,
          order_number: order.order_number,
          shipping_method: order.shipping_method,
          status: order.status,
          created_date: order.created_date
        })),
        total: trackstarOrders.total_count,
        brand: integration.brand.name
      });

    } catch (trackstarError: any) {
      logger.error('Failed to search orders in Trackstar:', trackstarError.message);
      res.status(500).json({
        success: false,
        error: 'Failed to search orders in Trackstar',
        details: trackstarError.message
      });
    }

  } catch (error: any) {
    logger.error('Failed to search Trackstar orders:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Query order from Trackstar by order number
 */
router.get('/trackstar/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;

    // Find any brand with active Trackstar integration to use for the query
    const integration = await prisma.brandIntegration.findFirst({
      where: {
        provider: 'TRACKSTAR',
        status: 'ACTIVE'
      },
      include: {
        brand: true
      }
    });

    if (!integration) {
      return res.status(404).json({
        success: false,
        error: 'No active Trackstar integration found'
      });
    }

    try {
      const trackstarOrder = await trackstarClient.instance.getOrderByNumber(integration.accessToken, orderNumber);
      
      if (!trackstarOrder) {
        return res.status(404).json({
          success: false,
          error: `Order ${orderNumber} not found in Trackstar`
        });
      }

      res.json({
        success: true,
        order: trackstarOrder,
        shippingMethod: trackstarOrder.shipping_method || null,
        brand: integration.brand.name
      });

    } catch (trackstarError: any) {
      logger.error('Failed to query order from Trackstar:', trackstarError.message);
      res.status(500).json({
        success: false,
        error: 'Failed to query order from Trackstar',
        details: trackstarError.message
      });
    }

  } catch (error: any) {
    logger.error('Failed to query Trackstar order:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get available ship methods for an order's brand
 */
router.get('/:orderId/ship-methods', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Get the order to find its brand
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { brand: true }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if brand has Trackstar integration
    const integration = await prisma.brandIntegration.findUnique({
      where: {
        brandId_provider: {
          brandId: order.brandId,
          provider: 'TRACKSTAR'
        }
      }
    });

    if (!integration || integration.status !== 'ACTIVE') {
      // Return default ship methods if no Trackstar integration
      return res.json({
        success: true,
        shipMethods: [
          { id: 'ups-ground', name: 'UPS Ground', carrier: 'UPS' },
          { id: 'ups-next-day', name: 'UPS Next Day Air', carrier: 'UPS' },
          { id: 'fedex-ground', name: 'FedEx Ground', carrier: 'FedEx' },
          { id: 'fedex-express', name: 'FedEx Express', carrier: 'FedEx' },
          { id: 'usps-ground', name: 'USPS Ground Advantage', carrier: 'USPS' },
          { id: 'usps-priority', name: 'USPS Priority Mail', carrier: 'USPS' }
        ]
      });
    }

    // Fetch ship methods from Trackstar
    try {
      const shipMethodsResponse = await trackstarClient.instance.getShipMethods(integration.accessToken);
      
      const shipMethods = shipMethodsResponse.data.map((method: any) => ({
        id: method.id,
        name: method.name,
        carrier: method.carrier,
        additionalFields: method.additional_fields
      }));

      res.json({
        success: true,
        shipMethods
      });
    } catch (trackstarError: any) {
      logger.warn('Failed to fetch ship methods from Trackstar, using defaults:', trackstarError.message);
      
      // Fallback to default methods if Trackstar fails
      res.json({
        success: true,
        shipMethods: [
          { id: 'ups-ground', name: 'UPS Ground', carrier: 'UPS' },
          { id: 'ups-next-day', name: 'UPS Next Day Air', carrier: 'UPS' },
          { id: 'fedex-ground', name: 'FedEx Ground', carrier: 'FedEx' },
          { id: 'fedex-express', name: 'FedEx Express', carrier: 'FedEx' },
          { id: 'usps-ground', name: 'USPS Ground Advantage', carrier: 'USPS' },
          { id: 'usps-priority', name: 'USPS Priority Mail', carrier: 'USPS' }
        ]
      });
    }

  } catch (error: any) {
    logger.error('Failed to get ship methods:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Repair specific order Trackstar linkage
router.post('/repair-order/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    
    logger.info(`Repairing Trackstar linkage for order: ${orderId}`);
    
    // Get the order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { brand: true }
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    const trackstarId = order.rawData?.id;
    if (!trackstarId) {
      return res.status(400).json({
        success: false,
        error: 'Order does not have Trackstar ID in rawData'
      });
    }
    
    // Find the correct brand by searching all active integrations
    const integrations = await prisma.brandIntegration.findMany({
      where: {
        provider: 'TRACKSTAR',
        status: 'ACTIVE'
      },
      include: {
        brand: true
      }
    });
    
    let correctBrandId = null;
    let foundInBrand = null;
    
    for (const integration of integrations) {
      try {
        logger.info(`Searching for order ${trackstarId} in brand ${integration.brand.name}`);
        
        const trackstarOrder = await trackstarClient.instance.getOrders(integration.accessToken, {
          filters: { id: trackstarId },
          limit: 1
        });
        
        if (trackstarOrder.data && trackstarOrder.data.length > 0) {
          correctBrandId = integration.brandId;
          foundInBrand = integration.brand.name;
          logger.info(`Found order ${order.orderNumber} in brand ${integration.brand.name}`);
          break;
        }
      } catch (error: any) {
        logger.warn(`Failed to search in brand ${integration.brand.name}:`, error.message);
        continue;
      }
    }
    
    if (correctBrandId) {
      // Update the order with correct linkage
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          externalId: trackstarId,
          brandId: correctBrandId
        }
      });
      
      res.json({
        success: true,
        message: `Order ${order.orderNumber} successfully linked to brand ${foundInBrand}`,
        order: {
          id: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          externalId: updatedOrder.externalId,
          brandId: updatedOrder.brandId
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: `Order ${order.orderNumber} with Trackstar ID ${trackstarId} not found in any active integration`,
        searchedBrands: integrations.map(i => i.brand.name)
      });
    }
    
  } catch (error: any) {
    logger.error('Failed to repair order Trackstar linkage:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to repair order Trackstar linkage',
      details: error.message
    });
  }
});

// Repair broken Trackstar order linkages
router.post('/repair-trackstar-links', async (req: Request, res: Response) => {
  try {
    logger.info('Starting repair of broken Trackstar order links...');
    
    // Find orders with rawData but missing externalId or brandId
    const brokenOrders = await prisma.order.findMany({
      where: {
        OR: [
          { externalId: null },
          { brandId: null }
        ],
        rawData: {
          not: null
        }
      },
      include: {
        brand: true
      }
    });

    logger.info(`Found ${brokenOrders.length} orders with broken Trackstar links`);
    
    // Debug: Log first few orders
    if (brokenOrders.length > 0) {
      logger.info('Sample broken orders:', brokenOrders.slice(0, 3).map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        externalId: o.externalId,
        brandId: o.brandId,
        hasRawData: !!o.rawData,
        trackstarId: o.rawData?.id
      })));
    }

    const repairResults = [];
    
    for (const order of brokenOrders) {
      try {
        const trackstarId = order.rawData?.id;
        if (!trackstarId) continue;

        // Try to find the correct brand by searching all active integrations
        let correctBrandId = order.brandId;
        
        if (!correctBrandId) {
          const integrations = await prisma.brandIntegration.findMany({
            where: {
              provider: 'TRACKSTAR',
              status: 'ACTIVE'
            },
            include: {
              brand: true
            }
          });

          // Try to find this order in each integration using direct endpoint
          for (const integration of integrations) {
            try {
              await trackstarClient.instance.getOrderById(integration.accessToken, trackstarId);
              correctBrandId = integration.brandId;
              foundInBrand = integration.brand.name;
              logger.info(`Found order ${order.orderNumber} in brand ${integration.brand.name}`);
              break;
            } catch (error: any) {
              // If 404 or 422, order doesn't exist in this integration, try next
              if (error.response?.status === 404 || error.response?.status === 422) {
                continue;
              } else {
                // Other errors, log and continue
                logger.warn(`Error checking order in brand ${integration.brand.name}:`, error.message);
                continue;
              }
            }
          }
        }

        if (correctBrandId) {
          // Update the order with correct linkage
          const updatedOrder = await prisma.order.update({
            where: { id: order.id },
            data: {
              externalId: trackstarId,
              brandId: correctBrandId
            }
          });

          repairResults.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            status: 'repaired',
            externalId: trackstarId,
            brandId: correctBrandId
          });

          logger.info(`Repaired order ${order.orderNumber}: linked to brand ${correctBrandId} with externalId ${trackstarId}`);
        } else {
          repairResults.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            status: 'failed',
            reason: 'Could not find matching Trackstar order in any active integration'
          });
        }
      } catch (error: any) {
        repairResults.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: 'error',
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Repair completed. Processed ${brokenOrders.length} orders.`,
      results: repairResults,
      summary: {
        total: brokenOrders.length,
        repaired: repairResults.filter(r => r.status === 'repaired').length,
        failed: repairResults.filter(r => r.status === 'failed').length,
        errors: repairResults.filter(r => r.status === 'error').length
      }
    });
  } catch (error: any) {
    logger.error('Failed to repair Trackstar order links:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to repair Trackstar order links',
      details: error.message
    });
  }
});

export default router;
