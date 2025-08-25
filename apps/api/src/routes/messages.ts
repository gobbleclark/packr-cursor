import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@packr/database';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const createMessageSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  brandId: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  isUrgent: z.boolean().default(false),
  assignedTo: z.string().optional(),
  statusId: z.string().optional(),
  orderId: z.string().optional(),
  shipmentId: z.string().optional(),
  productId: z.string().optional(),
});

const updateMessageSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(5000).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  isUrgent: z.boolean().optional(),
  assignedTo: z.string().optional(),
  statusId: z.string().optional(),
  completedAt: z.string().optional(),
  completedBy: z.string().optional(),
});

const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  mentions: z.array(z.string()).optional(),
});

// Get all messages for the 3PL
router.get('/', authenticateToken, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const { brandId, status, priority, assignedTo, page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      threeplId: req.user.threeplId,
    };

    if (brandId) where.brandId = brandId;
    if (status) where.statusId = status;
    if (priority) where.priority = priority;
    if (assignedTo) where.assignedTo = assignedTo;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          status: true,
          brand: true,
          comments: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 3, // Latest 3 comments
          },
          mentions: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                }
              }
            }
          },
          _count: {
            select: {
              comments: true,
              attachments: true,
            }
          }
        },
        orderBy: [
          { isUrgent: 'desc' },
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: limitNum,
      }),
      prisma.message.count({ where })
    ]);

    res.json({
      success: true,
      messages,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      }
    });
  } catch (error) {
    logger.error('Failed to fetch messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get a specific message
router.get('/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        threeplId: req.user.threeplId,
      },
      include: {
        status: true,
        brand: true,
        comments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              }
            }
          },
          orderBy: { createdAt: 'asc' },
        },
        mentions: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              }
            }
          }
        },
        attachments: true,
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ success: true, message });
  } catch (error) {
    logger.error('Failed to fetch message:', error);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

// Create a new message
router.post('/', authenticateToken, async (req, res) => {
  try {
    const data = createMessageSchema.parse(req.body);

    // Verify brand access if brandId is provided
    if (data.brandId) {
      const brand = await prisma.brand.findFirst({
        where: {
          id: data.brandId,
          threeplId: req.user.threeplId,
        }
      });

      if (!brand) {
        return res.status(404).json({ error: 'Brand not found' });
      }
    }

    const message = await prisma.message.create({
      data: {
        ...data,
        threeplId: req.user.threeplId,
        createdBy: req.user.id,
      },
      include: {
        status: true,
        brand: true,
        _count: {
          select: {
            comments: true,
            attachments: true,
          }
        }
      }
    });

    res.status(201).json({ success: true, message });
  } catch (error) {
    logger.error('Failed to create message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// Update a message
router.put('/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const data = updateMessageSchema.parse(req.body);

    const existingMessage = await prisma.message.findFirst({
      where: {
        id: messageId,
        threeplId: req.user.threeplId,
      }
    });

    if (!existingMessage) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Handle completion
    const updateData: any = { ...data };
    if (data.completedAt && !existingMessage.completedAt) {
      updateData.completedAt = new Date(data.completedAt);
      updateData.completedBy = req.user.id;
    }

    const message = await prisma.message.update({
      where: { id: messageId },
      data: updateData,
      include: {
        status: true,
        brand: true,
        _count: {
          select: {
            comments: true,
            attachments: true,
          }
        }
      }
    });

    res.json({ success: true, message });
  } catch (error) {
    logger.error('Failed to update message:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// Delete a message
router.delete('/:messageId', authenticateToken, requireRole('THREEPL_ADMIN'), async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        threeplId: req.user.threeplId,
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    await prisma.message.delete({
      where: { id: messageId }
    });

    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Add a comment to a message
router.post('/:messageId/comments', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content, mentions = [] } = createCommentSchema.parse(req.body);

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        threeplId: req.user.threeplId,
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const comment = await prisma.comment.create({
      data: {
        messageId,
        userId: req.user.id,
        content,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      }
    });

    // Create mentions
    if (mentions.length > 0) {
      await prisma.mention.createMany({
        data: mentions.map(userId => ({
          messageId,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    res.status(201).json({ success: true, comment });
  } catch (error) {
    logger.error('Failed to create comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// Get message statuses for the 3PL
router.get('/statuses/list', authenticateToken, async (req, res) => {
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

// Get dashboard stats for messages
router.get('/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    const { brandId } = req.query;
    
    const where: any = {
      threeplId: req.user.threeplId,
    };

    if (brandId) where.brandId = brandId;

    const [
      totalMessages,
      urgentMessages,
      uncompletedMessages,
      completedToday,
      messagesByStatus,
      messagesByPriority
    ] = await Promise.all([
      prisma.message.count({ where }),
      prisma.message.count({ 
        where: { ...where, isUrgent: true, completedAt: null } 
      }),
      prisma.message.count({ 
        where: { ...where, completedAt: null } 
      }),
      prisma.message.count({
        where: {
          ...where,
          completedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.message.groupBy({
        by: ['statusId'],
        where,
        _count: true,
      }),
      prisma.message.groupBy({
        by: ['priority'],
        where,
        _count: true,
      }),
    ]);

    res.json({
      success: true,
      stats: {
        totalMessages,
        urgentMessages,
        uncompletedMessages,
        completedToday,
        messagesByStatus,
        messagesByPriority,
      }
    });
  } catch (error) {
    logger.error('Failed to fetch message stats:', error);
    res.status(500).json({ error: 'Failed to fetch message stats' });
  }
});

export default router;
