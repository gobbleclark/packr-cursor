import { Router } from 'express';
import { prisma } from '@packr/database';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get full order details (simulating Trackstar API response)
router.get('/:orderNumber', authenticateToken, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const userId = req.user?.id;
    
    console.log('🔍 Trackstar order request:', { orderNumber, userId, user: req.user });

    if (!userId) {
      console.log('❌ No userId found in request');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    // Build where clause based on user role (using same pattern as orders.ts)
    const userRole = req.user.role;
    const userThreeplId = req.user.threeplId;
    const userMemberships = req.user.memberships;

    let whereClause: any = { orderNumber: orderNumber };

    if (userRole.includes('THREEPL')) {
      // 3PL users can see all orders under their 3PL
      whereClause.threeplId = userThreeplId;
    } else {
      // Brand users can only see their own orders
      const brandMembership = userMemberships.find(m => m.brandId);
      if (brandMembership) {
        whereClause.brandId = brandMembership.brandId;
      } else {
        return res.status(403).json({
          error: 'Access denied',
          message: 'No brand access found'
        });
      }
    }

    console.log('🔍 Where clause for order lookup:', whereClause);

    // Find the order
    const order = await prisma.order.findFirst({
      where: whereClause,
    });

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        message: `Order ${orderNumber} not found or access denied`
      });
    }

    // Simulate full order details (in real implementation, this would come from Trackstar)
    const orderDetails = {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status.toLowerCase(),
      customerName: order.customerName,
      customerEmail: order.customerEmail || `${order.customerName?.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      shippingAddress: {
        name: order.customerName,
        street: order.shippingAddress || '123 Main St',
        street2: '',
        city: order.shippingCity || 'Anytown',
        state: order.shippingState || 'CA',
        zipCode: order.shippingZip || '12345',
        country: 'US',
        phone: order.customerPhone || '(555) 123-4567'
      },
      lineItems: [
        {
          sku: 'SAMPLE-SKU-001',
          name: 'Sample Product',
          quantity: 2
        },
        {
          sku: 'SAMPLE-SKU-002', 
          name: 'Another Product',
          quantity: 1
        }
      ],
      carrier: order.status === 'SHIPPED' ? {
        carrierId: 'ups',
        carrierName: 'UPS',
        serviceLevel: 'Ground'
      } : null,
      tracking: order.status === 'SHIPPED' ? {
        trackingNumber: '1Z999AA1234567890',
        carrier: 'UPS',
        status: 'In Transit',
        estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        trackingUrl: 'https://www.ups.com/track?tracknum=1Z999AA1234567890',
        events: [
          {
            date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            status: 'Shipped',
            location: 'Los Angeles, CA',
            description: 'Package shipped from facility'
          },
          {
            date: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
            status: 'In Transit',
            location: 'Phoenix, AZ',
            description: 'Package in transit'
          }
        ]
      } : null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      notes: [
        {
          id: '1',
          content: 'Customer requested expedited shipping',
          author: 'Customer Service',
          createdAt: order.createdAt.toISOString(),
          isInternal: false
        }
      ]
    };

    res.json({
      success: true,
      data: orderDetails
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch order details'
    });
  }
});

export default router;
