import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@packr/database';
import { authenticateToken, requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const createMessageStatusSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color'),
  isDefault: z.boolean().default(false),
});

const updateMessageStatusSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color').optional(),
  isDefault: z.boolean().optional(),
});

const updateThreePLSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: z.object({
    messaging: z.object({
      defaultPriority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
      autoAssignUrgent: z.boolean().optional(),
      emailNotifications: z.boolean().optional(),
      slackIntegration: z.object({
        enabled: z.boolean().optional(),
        webhookUrl: z.string().url().optional(),
        channel: z.string().optional(),
      }).optional(),
    }).optional(),
    notifications: z.object({
      email: z.boolean().optional(),
      browser: z.boolean().optional(),
      slack: z.boolean().optional(),
    }).optional(),
    branding: z.object({
      primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
      secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
      logo: z.string().url().optional(),
    }).optional(),
  }).optional(),
});

// Get all settings for the 3PL
router.get('/', authenticateToken, requireRole('THREEPL_ADMIN'), async (req, res) => {
  try {
    const threepl = await prisma.threePL.findUnique({
      where: { id: req.user.threeplId },
      include: {
        messageStatuses: {
          orderBy: [
            { isDefault: 'desc' },
            { name: 'asc' }
          ]
        }
      }
    });

    if (!threepl) {
      return res.status(404).json({ error: '3PL not found' });
    }

    res.json({
      success: true,
      settings: {
        general: {
          name: threepl.name,
          slug: threepl.slug,
          settings: threepl.settings,
        },
        messaging: {
          statuses: threepl.messageStatuses,
        }
      }
    });
  } catch (error) {
    logger.error('Failed to fetch settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update 3PL general settings
router.put('/general', authenticateToken, requireRole('THREEPL_ADMIN'), async (req, res) => {
  try {
    const data = updateThreePLSettingsSchema.parse(req.body);

    const threepl = await prisma.threePL.update({
      where: { id: req.user.threeplId },
      data: {
        name: data.name,
        settings: data.settings,
      }
    });

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
        name: threepl.name,
        slug: threepl.slug,
        settings: threepl.settings,
      }
    });
  } catch (error) {
    logger.error('Failed to update settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get message statuses
router.get('/message-statuses', authenticateToken, async (req, res) => {
  try {
    const statuses = await prisma.messageStatus.findMany({
      where: {
        threeplId: req.user.threeplId,
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' }
      ]
    });

    res.json({ success: true, statuses });
  } catch (error) {
    logger.error('Failed to fetch message statuses:', error);
    res.status(500).json({ error: 'Failed to fetch message statuses' });
  }
});

// Create a new message status
router.post('/message-statuses', authenticateToken, requireRole('THREEPL_ADMIN'), async (req, res) => {
  try {
    const data = createMessageStatusSchema.parse(req.body);

    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await prisma.messageStatus.updateMany({
        where: {
          threeplId: req.user.threeplId,
          isDefault: true,
        },
        data: { isDefault: false }
      });
    }

    const status = await prisma.messageStatus.create({
      data: {
        ...data,
        threeplId: req.user.threeplId,
      }
    });

    res.status(201).json({
      success: true,
      message: 'Message status created successfully',
      status
    });
  } catch (error) {
    logger.error('Failed to create message status:', error);
    res.status(500).json({ error: 'Failed to create message status' });
  }
});

// Update a message status
router.put('/message-statuses/:statusId', authenticateToken, requireRole('THREEPL_ADMIN'), async (req, res) => {
  try {
    const { statusId } = req.params;
    const data = updateMessageStatusSchema.parse(req.body);

    const existingStatus = await prisma.messageStatus.findFirst({
      where: {
        id: statusId,
        threeplId: req.user.threeplId,
      }
    });

    if (!existingStatus) {
      return res.status(404).json({ error: 'Message status not found' });
    }

    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await prisma.messageStatus.updateMany({
        where: {
          threeplId: req.user.threeplId,
          isDefault: true,
          id: { not: statusId },
        },
        data: { isDefault: false }
      });
    }

    const status = await prisma.messageStatus.update({
      where: { id: statusId },
      data
    });

    res.json({
      success: true,
      message: 'Message status updated successfully',
      status
    });
  } catch (error) {
    logger.error('Failed to update message status:', error);
    res.status(500).json({ error: 'Failed to update message status' });
  }
});

// Delete a message status
router.delete('/message-statuses/:statusId', authenticateToken, requireRole('THREEPL_ADMIN'), async (req, res) => {
  try {
    const { statusId } = req.params;

    const status = await prisma.messageStatus.findFirst({
      where: {
        id: statusId,
        threeplId: req.user.threeplId,
      },
      include: {
        _count: {
          select: { messages: true }
        }
      }
    });

    if (!status) {
      return res.status(404).json({ error: 'Message status not found' });
    }

    if (status._count.messages > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete message status that is being used by messages' 
      });
    }

    await prisma.messageStatus.delete({
      where: { id: statusId }
    });

    res.json({
      success: true,
      message: 'Message status deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete message status:', error);
    res.status(500).json({ error: 'Failed to delete message status' });
  }
});

// Initialize default message statuses for a 3PL
router.post('/message-statuses/initialize', authenticateToken, requireRole('THREEPL_ADMIN'), async (req, res) => {
  try {
    // Check if statuses already exist
    const existingCount = await prisma.messageStatus.count({
      where: { threeplId: req.user.threeplId }
    });

    if (existingCount > 0) {
      return res.status(400).json({ error: 'Message statuses already initialized' });
    }

    // Create default statuses
    const defaultStatuses = [
      { name: 'Open', color: '#3B82F6', isDefault: true },
      { name: 'In Progress', color: '#F59E0B', isDefault: false },
      { name: 'Waiting for Response', color: '#8B5CF6', isDefault: false },
      { name: 'Resolved', color: '#10B981', isDefault: false },
      { name: 'Closed', color: '#6B7280', isDefault: false },
    ];

    const statuses = await prisma.messageStatus.createMany({
      data: defaultStatuses.map(status => ({
        ...status,
        threeplId: req.user.threeplId,
      }))
    });

    res.status(201).json({
      success: true,
      message: 'Default message statuses created successfully',
      count: statuses.count
    });
  } catch (error) {
    logger.error('Failed to initialize message statuses:', error);
    res.status(500).json({ error: 'Failed to initialize message statuses' });
  }
});

// Get system info and stats
router.get('/system', authenticateToken, requireRole('THREEPL_ADMIN'), async (req, res) => {
  try {
    const [
      userCount,
      brandCount,
      messageCount,
      orderCount,
      integrationCount
    ] = await Promise.all([
      prisma.user.count({
        where: {
          memberships: {
            some: { threeplId: req.user.threeplId }
          }
        }
      }),
      prisma.brand.count({
        where: { threeplId: req.user.threeplId }
      }),
      prisma.message.count({
        where: { threeplId: req.user.threeplId }
      }),
      prisma.order.count({
        where: { threeplId: req.user.threeplId }
      }),
      prisma.brandIntegration.count({
        where: {
          brand: { threeplId: req.user.threeplId }
        }
      })
    ]);

    res.json({
      success: true,
      system: {
        stats: {
          users: userCount,
          brands: brandCount,
          messages: messageCount,
          orders: orderCount,
          integrations: integrationCount,
        },
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      }
    });
  } catch (error) {
    logger.error('Failed to fetch system info:', error);
    res.status(500).json({ error: 'Failed to fetch system info' });
  }
});

export default router;
