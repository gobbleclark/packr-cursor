import express from 'express';
import { prisma } from '../lib/database';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * Get chat rooms for the authenticated user
 * GET /api/chat/rooms
 */
router.get('/rooms', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's memberships to determine accessible rooms
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            threepl: { select: { id: true, name: true } },
            brand: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get chat rooms based on user's memberships
    const whereConditions = [];
    
    for (const membership of user.memberships) {
      if (membership.role.includes('THREEPL')) {
        // 3PL users can see all chat rooms for their 3PL
        whereConditions.push({
          threeplId: membership.threeplId
        });
      } else if (membership.role.includes('BRAND')) {
        // Brand users can only see their specific brand's chat room
        whereConditions.push({
          AND: [
            { threeplId: membership.threeplId },
            { brandId: membership.brandId }
          ]
        });
      }
    }

    const chatRooms = await prisma.chatRoom.findMany({
      where: {
        OR: whereConditions
      },
      include: {
        threepl: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        _count: {
          select: {
            chatMessages: true,
            chatTasks: {
              where: { status: { in: ['TODO', 'IN_PROGRESS'] } }
            }
          }
        },
        chatMessages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Get unread message counts for each room
    const roomsWithUnreadCounts = await Promise.all(
      chatRooms.map(async (room) => {
        const unreadCount = await prisma.chatMessage.count({
          where: {
            roomId: room.id,
            NOT: {
              readReceipts: {
                some: { userId }
              }
            },
            userId: { not: userId } // Don't count own messages
          }
        });

        return {
          ...room,
          unreadCount,
          lastMessage: room.chatMessages[0] || null
        };
      })
    );

    res.json({
      success: true,
      rooms: roomsWithUnreadCounts
    });
  } catch (error) {
    logger.error('Error fetching chat rooms:', error);
    res.status(500).json({ error: 'Failed to fetch chat rooms' });
  }
});

/**
 * Get or create a chat room between 3PL and brand
 * POST /api/chat/rooms
 */
router.post('/rooms', authenticateToken, async (req, res) => {
  try {
    const { threeplId, brandId } = req.body;
    const userId = req.user.id;

    // Verify user has access to create/access this room
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hasAccess = user.memberships.some(membership => 
      membership.threeplId === threeplId &&
      (membership.brandId === brandId || membership.brandId === null)
    );

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this chat room' });
    }

    // Get or create chat room
    const chatRoom = await prisma.chatRoom.upsert({
      where: {
        threeplId_brandId: { threeplId, brandId }
      },
      update: {},
      create: {
        threeplId,
        brandId
      },
      include: {
        threepl: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } }
      }
    });

    res.json({
      success: true,
      room: chatRoom
    });
  } catch (error) {
    logger.error('Error creating/getting chat room:', error);
    res.status(500).json({ error: 'Failed to create chat room' });
  }
});

/**
 * Get messages for a chat room with pagination
 * GET /api/chat/rooms/:roomId/messages
 */
router.get('/rooms/:roomId/messages', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { before, limit = 50 } = req.query;
    const userId = req.user.id;

    // Verify user has access to this room
    const hasAccess = await verifyRoomAccess(userId, roomId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this chat room' });
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        roomId,
        ...(before && { createdAt: { lt: new Date(before as string) } })
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        attachments: true,
        mentions: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true }
            }
          }
        },
        parent: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true }
            }
          }
        },
        replies: {
          take: 3,
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true }
            }
          }
        },
        _count: {
          select: { replies: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string)
    });

    res.json({
      success: true,
      messages: messages.reverse() // Return in chronological order
    });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * Get tasks for a chat room
 * GET /api/chat/rooms/:roomId/tasks
 */
router.get('/rooms/:roomId/tasks', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { status } = req.query;
    const userId = req.user.id;

    // Verify user has access to this room
    const hasAccess = await verifyRoomAccess(userId, roomId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this chat room' });
    }

    const tasks = await prisma.chatTask.findMany({
      where: {
        roomId,
        ...(status && { status: status as any })
      },
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true }
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        createdFromMessage: {
          select: { id: true, content: true }
        },
        linkedOrder: {
          select: { id: true, orderNumber: true, status: true }
        },
        _count: {
          select: { comments: true }
        }
      },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    res.json({
      success: true,
      tasks
    });
  } catch (error) {
    logger.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * Get users in a chat room
 * GET /api/chat/rooms/:roomId/users
 */
router.get('/rooms/:roomId/users', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    // Verify user has access to this room
    const hasAccess = await verifyRoomAccess(userId, roomId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this chat room' });
    }

    // Get the room details to find the 3PL and brand
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: {
        threeplId: true,
        brandId: true
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Chat room not found' });
    }

    // Get all users who have access to this room
    // This includes 3PL users and the specific brand users
    const users = await prisma.user.findMany({
      where: {
        memberships: {
          some: {
            OR: [
              // 3PL users (can access all rooms for their 3PL)
              {
                threeplId: room.threeplId,
                role: {
                  in: ['THREEPL_SUPER_ADMIN', 'THREEPL_USER']
                }
              },
              // Brand users (can only access their specific brand's room)
              {
                threeplId: room.threeplId,
                brandId: room.brandId,
                role: 'BRAND_USER'
              }
            ]
          }
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        memberships: {
          where: {
            threeplId: room.threeplId,
            ...(room.brandId && { brandId: room.brandId })
          },
          select: {
            role: true
          }
        }
      }
    });

    // Transform the data to include role information
    const transformedUsers = users.map(user => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.memberships[0]?.role === 'THREEPL_SUPER_ADMIN' ? 'super_admin' :
            user.memberships[0]?.role === 'THREEPL_USER' ? '3pl_user' : 'brand_user'
    }));

    res.json({
      success: true,
      users: transformedUsers
    });
  } catch (error) {
    logger.error('Error fetching room users:', error);
    res.status(500).json({ error: 'Failed to fetch room users' });
  }
});

/**
 * Update task status
 * PUT /api/chat/tasks/:taskId/status
 */
router.put('/tasks/:taskId/status', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    // Verify task exists and user has access
    const task = await prisma.chatTask.findUnique({
      where: { id: taskId },
      include: {
        room: true,
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify user has access to this room
    const hasAccess = await verifyRoomAccess(userId, task.roomId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this task' });
    }

    // Update task status
    const updatedTask = await prisma.chatTask.update({
      where: { id: taskId },
      data: { 
        status,
        ...(status === 'COMPLETED' && { completedAt: new Date() })
      },
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true }
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        linkedOrder: {
          select: { id: true, orderNumber: true, status: true }
        },
        _count: {
          select: { comments: true }
        }
      }
    });

    res.json({
      success: true,
      task: updatedTask
    });
  } catch (error) {
    logger.error('Error updating task status:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

/**
 * Get single task details
 * GET /api/chat/tasks/:taskId
 */
router.get('/tasks/:taskId', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    const task = await prisma.chatTask.findUnique({
      where: { id: taskId },
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true }
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        linkedOrder: {
          select: { id: true, orderNumber: true, status: true }
        },
        room: true,
        _count: {
          select: { comments: true }
        }
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify user has access to this room
    const hasAccess = await verifyRoomAccess(userId, task.roomId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this task' });
    }

    res.json({
      success: true,
      task
    });
  } catch (error) {
    logger.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

/**
 * Get task comments
 * GET /api/chat/tasks/:taskId/comments
 */
router.get('/tasks/:taskId/comments', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    // Verify task exists and user has access
    const task = await prisma.chatTask.findUnique({
      where: { id: taskId },
      select: { roomId: true }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify user has access to this room
    const hasAccess = await verifyRoomAccess(userId, task.roomId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this task' });
    }

    const comments = await prisma.taskComment.findMany({
      where: { taskId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      success: true,
      comments
    });
  } catch (error) {
    logger.error('Error fetching task comments:', error);
    res.status(500).json({ error: 'Failed to fetch task comments' });
  }
});

/**
 * Add task comment
 * POST /api/chat/tasks/:taskId/comments
 */
router.post('/tasks/:taskId/comments', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content?.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Verify task exists and user has access
    const task = await prisma.chatTask.findUnique({
      where: { id: taskId },
      select: { roomId: true }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify user has access to this room
    const hasAccess = await verifyRoomAccess(userId, task.roomId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this task' });
    }

    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        userId,
        content: content.trim()
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    res.json({
      success: true,
      comment
    });
  } catch (error) {
    logger.error('Error adding task comment:', error);
    res.status(500).json({ error: 'Failed to add task comment' });
  }
});

/**
 * Create a new task
 * POST /api/chat/rooms/:roomId/tasks
 */
router.post('/rooms/:roomId/tasks', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const {
      title,
      description,
      assigneeId,
      dueDate,
      priority = 'NORMAL',
      linkedOrderId,
      notifyBrandUserId,
      createdFromMessageId
    } = req.body;
    const userId = req.user.id;

    // Verify user has access to this room
    const hasAccess = await verifyRoomAccess(userId, roomId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this chat room' });
    }

    const task = await prisma.chatTask.create({
      data: {
        roomId,
        title,
        description,
        createdById: userId,
        assigneeId,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority,
        linkedOrderId,
        createdFromMessageId,
        notifyBrandUserId
      },
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true }
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        linkedOrder: {
          select: { id: true, orderNumber: true, status: true }
        }
      }
    });

    res.json({
      success: true,
      task
    });
  } catch (error) {
    logger.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * Search messages in a room
 * GET /api/chat/rooms/:roomId/search
 */
router.get('/rooms/:roomId/search', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { q, limit = 20 } = req.query;
    const userId = req.user.id;

    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    // Verify user has access to this room
    const hasAccess = await verifyRoomAccess(userId, roomId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this chat room' });
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        roomId,
        content: {
          contains: q as string,
          mode: 'insensitive'
        }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string)
    });

    res.json({
      success: true,
      messages
    });
  } catch (error) {
    logger.error('Error searching messages:', error);
    res.status(500).json({ error: 'Failed to search messages' });
  }
});

// Helper function to verify room access
async function verifyRoomAccess(userId: string, roomId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: true }
    });

    if (!user) return false;

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId }
    });

    if (!room) return false;

    // Check if user has membership that gives access to this room
    return user.memberships.some(membership => {
      if (membership.role.includes('THREEPL')) {
        // 3PL users can access any room for their 3PL
        return membership.threeplId === room.threeplId;
      } else if (membership.role.includes('BRAND')) {
        // Brand users can only access their specific brand's room
        return membership.threeplId === room.threeplId && 
               membership.brandId === room.brandId;
      }
      return false;
    });
  } catch (error) {
    logger.error('Error verifying room access:', error);
    return false;
  }
}

export default router;
