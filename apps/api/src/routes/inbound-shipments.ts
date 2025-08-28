import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@packr/database';
import { logger } from '../utils/logger';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Validation schemas
const createInboundShipmentSchema = z.object({
  brandId: z.string().optional(),
  trackingNumber: z.string().optional(),
  referenceNumber: z.string().optional(),
  expectedDate: z.string().datetime().optional(),
  carrierName: z.string().optional(),
  warehouseId: z.string().optional(),
  items: z.array(z.object({
    sku: z.string(),
    productName: z.string().optional(),
    expectedQuantity: z.number().int().positive(),
    unitCost: z.number().optional(),
  })).optional(),
});

const updateInboundShipmentSchema = z.object({
  status: z.enum(['PENDING', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED', 'PARTIAL']).optional(),
  trackingNumber: z.string().optional(),
  referenceNumber: z.string().optional(),
  expectedDate: z.string().datetime().optional(),
  receivedDate: z.string().datetime().optional(),
  carrierName: z.string().optional(),
  warehouseId: z.string().optional(),
  totalItems: z.number().int().optional(),
  receivedItems: z.number().int().optional(),
});

// Get all inbound shipments
router.get('/', authenticateToken, async (req, res) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const { user } = authenticatedReq;
    
    // Build where clause based on user role
    let whereClause: any = {
      threeplId: user.threeplId,
    };

    // Brand users can only see their own shipments
    if (user.role?.includes('BRAND')) {
      whereClause.brandId = user.brandId;
    }

    // Apply filters from query params
    const { status, brandId, warehouseId, search } = req.query;
    
    if (status && typeof status === 'string') {
      whereClause.status = status;
    }
    
    if (brandId && typeof brandId === 'string' && user.role?.includes('THREEPL')) {
      whereClause.brandId = brandId;
    }
    
    if (warehouseId && typeof warehouseId === 'string') {
      whereClause.warehouseId = warehouseId;
    }
    
    if (search && typeof search === 'string') {
      whereClause.OR = [
        { trackingNumber: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const shipments = await prisma.inboundShipment.findMany({
      where: whereClause,
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
          },
        },
        items: {
          select: {
            id: true,
            sku: true,
            productName: true,
            expectedQuantity: true,
            receivedQuantity: true,
            unitCost: true,
            totalCost: true,
          },
        },
        receipts: {
          select: {
            id: true,
            receivedDate: true,
            receivedBy: true,
            notes: true,
          },
          orderBy: {
            receivedDate: 'desc',
          },
        },
        _count: {
          select: {
            items: true,
            receipts: true,
          },
        },
      },
      orderBy: [
        { expectedDate: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({
      success: true,
      data: shipments,
    });
  } catch (error) {
    logger.error('Failed to fetch inbound shipments:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch inbound shipments',
    });
  }
});

// Get single inbound shipment
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const { user } = authenticatedReq;
    const { id } = req.params;

    let whereClause: any = {
      id,
      threeplId: user.threeplId,
    };

    // Brand users can only see their own shipments
    if (user.role?.includes('BRAND')) {
      whereClause.brandId = user.brandId;
    }

    const shipment = await prisma.inboundShipment.findFirst({
      where: whereClause,
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
            country: true,
          },
        },
        items: {
          select: {
            id: true,
            sku: true,
            productName: true,
            expectedQuantity: true,
            receivedQuantity: true,
            unitCost: true,
            totalCost: true,
            metadata: true,
          },
        },
        receipts: {
          select: {
            id: true,
            receivedDate: true,
            receivedBy: true,
            notes: true,
            metadata: true,
          },
          orderBy: {
            receivedDate: 'desc',
          },
        },
      },
    });

    if (!shipment) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Inbound shipment not found',
      });
    }

    res.json({
      success: true,
      data: shipment,
    });
  } catch (error) {
    logger.error('Failed to fetch inbound shipment:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch inbound shipment',
    });
  }
});

// Create new inbound shipment
router.post('/', authenticateToken, requireRole('THREEPL_ADMIN'), async (req, res) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const { user } = authenticatedReq;
    
    const validatedData = createInboundShipmentSchema.parse(req.body);

    // Create the shipment
    const shipment = await prisma.inboundShipment.create({
      data: {
        threeplId: user.threeplId!,
        brandId: validatedData.brandId,
        trackingNumber: validatedData.trackingNumber,
        referenceNumber: validatedData.referenceNumber,
        expectedDate: validatedData.expectedDate ? new Date(validatedData.expectedDate) : undefined,
        carrierName: validatedData.carrierName,
        warehouseId: validatedData.warehouseId,
        totalItems: validatedData.items?.reduce((sum, item) => sum + item.expectedQuantity, 0),
        items: validatedData.items ? {
          create: validatedData.items.map(item => ({
            sku: item.sku,
            productName: item.productName,
            expectedQuantity: item.expectedQuantity,
            unitCost: item.unitCost,
            totalCost: item.unitCost ? item.unitCost * item.expectedQuantity : undefined,
          })),
        } : undefined,
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
          },
        },
        items: true,
      },
    });

    logger.info(`Created inbound shipment ${shipment.id} for 3PL ${user.threeplId}`);

    res.status(201).json({
      success: true,
      data: shipment,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid request data',
        details: error.errors,
      });
    }

    logger.error('Failed to create inbound shipment:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create inbound shipment',
    });
  }
});

// Update inbound shipment
router.put('/:id', authenticateToken, requireRole('THREEPL_ADMIN'), async (req, res) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const { user } = authenticatedReq;
    const { id } = req.params;
    
    const validatedData = updateInboundShipmentSchema.parse(req.body);

    // Check if shipment exists and user has access
    const existingShipment = await prisma.inboundShipment.findFirst({
      where: {
        id,
        threeplId: user.threeplId,
      },
    });

    if (!existingShipment) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Inbound shipment not found',
      });
    }

    // Update the shipment
    const shipment = await prisma.inboundShipment.update({
      where: { id },
      data: {
        status: validatedData.status,
        trackingNumber: validatedData.trackingNumber,
        referenceNumber: validatedData.referenceNumber,
        expectedDate: validatedData.expectedDate ? new Date(validatedData.expectedDate) : undefined,
        receivedDate: validatedData.receivedDate ? new Date(validatedData.receivedDate) : undefined,
        carrierName: validatedData.carrierName,
        warehouseId: validatedData.warehouseId,
        totalItems: validatedData.totalItems,
        receivedItems: validatedData.receivedItems,
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
          },
        },
        items: true,
        receipts: {
          orderBy: {
            receivedDate: 'desc',
          },
        },
      },
    });

    logger.info(`Updated inbound shipment ${shipment.id}`);

    res.json({
      success: true,
      data: shipment,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid request data',
        details: error.errors,
      });
    }

    logger.error('Failed to update inbound shipment:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update inbound shipment',
    });
  }
});

// Delete inbound shipment
router.delete('/:id', authenticateToken, requireRole('THREEPL_ADMIN'), async (req, res) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const { user } = authenticatedReq;
    const { id } = req.params;

    // Check if shipment exists and user has access
    const existingShipment = await prisma.inboundShipment.findFirst({
      where: {
        id,
        threeplId: user.threeplId,
      },
    });

    if (!existingShipment) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Inbound shipment not found',
      });
    }

    // Delete the shipment (cascade will handle items and receipts)
    await prisma.inboundShipment.delete({
      where: { id },
    });

    logger.info(`Deleted inbound shipment ${id}`);

    res.json({
      success: true,
      message: 'Inbound shipment deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete inbound shipment:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete inbound shipment',
    });
  }
});

export default router;
