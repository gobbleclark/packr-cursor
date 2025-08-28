import { Router } from 'express';
import { prisma } from '@packr/database';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get order status by order number
router.get('/status/:orderNumber', authenticateToken, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    // Get user's membership to check access
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            threepl: true,
            brand: true,
          },
        },
      },
    });

    if (!user || user.memberships.length === 0) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'User has no active memberships'
      });
    }

    const membership = user.memberships[0];

    // Find the order
    const order = await prisma.order.findFirst({
      where: {
        orderNumber: orderNumber,
        // Scope by user's access
        ...(membership.role === 'BRAND_USER' || membership.role === 'BRAND_ADMIN'
          ? { brandId: membership.brandId }
          : { threeplId: membership.threeplId }
        ),
      },
    });

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        message: `Order ${orderNumber} not found or access denied`
      });
    }

    // Determine what actions are available based on order status
    const canEditItems = order.status === 'unfulfilled' || order.status === 'pending';
    const canTrack = order.status === 'fulfilled' || order.status === 'shipped';
    const canEditAddress = order.status !== 'shipped' && order.status !== 'fulfilled';
    const canEditCarrier = order.status !== 'shipped' && order.status !== 'fulfilled';

    const orderStatus = {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      status: order.status,
      canEditItems,
      canTrack,
      canEditAddress,
      canEditCarrier,
    };

    res.json({
      success: true,
      order: orderStatus
    });
  } catch (error) {
    console.error('Error fetching order status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch order status'
    });
  }
});

export default router;
