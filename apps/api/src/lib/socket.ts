import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { prisma } from './database';
import { logger } from '../utils/logger';

interface AuthenticatedSocket extends Socket {
  userId: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    memberships: Array<{
      role: string;
      threeplId: string | null;
      brandId: string | null;
    }>;
  };
}

export class SocketService {
  private io: SocketIOServer;
  private redisClient: any;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      allowEIO3: true
    });

    this.setupRedis();
    this.setupAuthentication();
    this.setupEventHandlers();
  }

  private async setupRedis() {
    if (process.env.REDIS_URL) {
      try {
        this.redisClient = createClient({ url: process.env.REDIS_URL });
        await this.redisClient.connect();
        
        const subClient = this.redisClient.duplicate();
        await subClient.connect();
        
        this.io.adapter(createAdapter(this.redisClient, subClient));
        logger.info('✅ Socket.io Redis adapter connected');
      } catch (error) {
        logger.warn('⚠️ Redis not available, using memory adapter', error);
      }
    }
  }

  private setupAuthentication() {
    this.io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        
        // Get user with memberships
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          include: {
            memberships: {
              include: {
                threepl: { select: { id: true, name: true } },
                brand: { select: { id: true, name: true } }
              }
            }
          }
        });

        if (!user || !user.isActive) {
          return next(new Error('User not found or inactive'));
        }

        socket.userId = user.id;
        socket.user = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          memberships: user.memberships.map(m => ({
            role: m.role,
            threeplId: m.threeplId,
            brandId: m.brandId
          }))
        };

        next();
      } catch (error) {
        logger.error('Socket authentication failed:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`User ${socket.user.email} connected to chat`);

      // Join user to their chat rooms
      this.joinUserRooms(socket);

      // Handle chat events
      this.setupChatHandlers(socket);
      
      // Handle task events
      this.setupTaskHandlers(socket);

      // Handle typing indicators
      this.setupTypingHandlers(socket);

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info(`User ${socket.user.email} disconnected from chat`);
      });
    });
  }

  private async joinUserRooms(socket: AuthenticatedSocket) {
    try {
      // Get all chat rooms user has access to
      const whereConditions = [];
      
      for (const membership of socket.user.memberships) {
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
        }
      });

      // Join socket to each room
      for (const room of chatRooms) {
        socket.join(`room:${room.id}`);
      }

      logger.info(`User ${socket.user.email} joined ${chatRooms.length} chat rooms`);
    } catch (error) {
      logger.error('Error joining user to rooms:', error);
    }
  }

  private setupChatHandlers(socket: AuthenticatedSocket) {
    // Send message
    socket.on('chat:send_message', async (data) => {
      try {
        const { roomId, content, parentId } = data;

        // Verify user has access to room
        const hasAccess = await this.verifyRoomAccess(socket.userId, roomId);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied to chat room' });
          return;
        }

        // Create message
        const message = await prisma.chatMessage.create({
          data: {
            roomId,
            userId: socket.userId,
            content,
            parentId: parentId || null,
            messageType: 'TEXT'
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
            }
          }
        });

        // Broadcast to room
        this.io.to(`room:${roomId}`).emit('chat:new_message', message);

        // Handle mentions (if any)
        await this.processMentions(message, data.mentions || []);

        logger.info(`Message sent in room ${roomId} by ${socket.user.email}`);
      } catch (error) {
        logger.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Mark messages as read
    socket.on('chat:mark_read', async (data) => {
      try {
        const { roomId, messageId } = data;

        await prisma.readReceipt.upsert({
          where: {
            messageId_userId: {
              messageId,
              userId: socket.userId
            }
          },
          update: {
            readAt: new Date()
          },
          create: {
            roomId,
            messageId,
            userId: socket.userId
          }
        });

        // Broadcast read receipt to room
        socket.to(`room:${roomId}`).emit('chat:message_read', {
          messageId,
          userId: socket.userId,
          readAt: new Date()
        });
      } catch (error) {
        logger.error('Error marking message as read:', error);
      }
    });
  }

  private setupTaskHandlers(socket: AuthenticatedSocket) {
    // Create task from message
    socket.on('task:create_from_message', async (data) => {
      try {
        const { messageId, title, description, assigneeId, dueDate, priority } = data;

        // Get the message to verify room access
        const message = await prisma.chatMessage.findUnique({
          where: { id: messageId },
          include: { room: true }
        });

        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Verify user has access to room
        const hasAccess = await this.verifyRoomAccess(socket.userId, message.roomId);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Create task
        const task = await prisma.chatTask.create({
          data: {
            roomId: message.roomId,
            title,
            description,
            createdById: socket.userId,
            createdFromMessageId: messageId,
            assigneeId,
            dueDate: dueDate ? new Date(dueDate) : null,
            priority: priority || 'NORMAL'
          },
          include: {
            assignee: {
              select: { id: true, firstName: true, lastName: true }
            },
            createdBy: {
              select: { id: true, firstName: true, lastName: true }
            }
          }
        });

        // Broadcast task creation to room
        this.io.to(`room:${message.roomId}`).emit('task:created', task);

        logger.info(`Task created from message ${messageId} by ${socket.user.email}`);
      } catch (error) {
        logger.error('Error creating task from message:', error);
        socket.emit('error', { message: 'Failed to create task' });
      }
    });

    // Update task status
    socket.on('task:update_status', async (data) => {
      try {
        const { taskId, status } = data;

        const task = await prisma.chatTask.findUnique({
          where: { id: taskId },
          include: { room: true }
        });

        if (!task) {
          socket.emit('error', { message: 'Task not found' });
          return;
        }

        // Verify user has access
        const hasAccess = await this.verifyRoomAccess(socket.userId, task.roomId);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Update task
        const updatedTask = await prisma.chatTask.update({
          where: { id: taskId },
          data: {
            status,
            completedAt: status === 'COMPLETED' ? new Date() : null
          },
          include: {
            assignee: {
              select: { id: true, firstName: true, lastName: true }
            },
            createdBy: {
              select: { id: true, firstName: true, lastName: true }
            }
          }
        });

        // Broadcast task update to room
        this.io.to(`room:${task.roomId}`).emit('task:updated', updatedTask);

        // Send notification if task completed and brand user should be notified
        if (status === 'COMPLETED' && task.notifyBrandUserId) {
          await this.sendTaskCompletionNotification(task);
        }

        logger.info(`Task ${taskId} status updated to ${status} by ${socket.user.email}`);
      } catch (error) {
        logger.error('Error updating task status:', error);
        socket.emit('error', { message: 'Failed to update task' });
      }
    });
  }

  private setupTypingHandlers(socket: AuthenticatedSocket) {
    socket.on('chat:typing_start', (data) => {
      const { roomId } = data;
      socket.to(`room:${roomId}`).emit('chat:user_typing', {
        userId: socket.userId,
        user: {
          firstName: socket.user.firstName,
          lastName: socket.user.lastName
        }
      });
    });

    socket.on('chat:typing_stop', (data) => {
      const { roomId } = data;
      socket.to(`room:${roomId}`).emit('chat:user_stopped_typing', {
        userId: socket.userId
      });
    });
  }

  private async verifyRoomAccess(userId: string, roomId: string): Promise<boolean> {
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
      return user.memberships.some(membership => 
        membership.threeplId === room.threeplId &&
        (membership.brandId === room.brandId || membership.brandId === null)
      );
    } catch (error) {
      logger.error('Error verifying room access:', error);
      return false;
    }
  }

  private async processMentions(message: any, mentionUserIds: string[]) {
    if (mentionUserIds.length === 0) return;

    try {
      // Create mention records
      await prisma.chatMention.createMany({
        data: mentionUserIds.map(userId => ({
          messageId: message.id,
          userId
        })),
        skipDuplicates: true
      });

      // Send real-time notifications to mentioned users
      for (const userId of mentionUserIds) {
        this.io.to(`user:${userId}`).emit('notification:mention', {
          messageId: message.id,
          roomId: message.roomId,
          fromUser: message.user,
          content: message.content
        });
      }
    } catch (error) {
      logger.error('Error processing mentions:', error);
    }
  }

  private async sendTaskCompletionNotification(task: any) {
    // This will be implemented when we add the email notification system
    logger.info(`Task ${task.id} completed - notification needed for user ${task.notifyBrandUserId}`);
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}

export let socketService: SocketService;
