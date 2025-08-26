import { io, Socket } from 'socket.io-client';
import { authService } from './auth';

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  content: string | null;
  messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM' | 'TASK_CREATED' | 'TASK_UPDATED';
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  attachments: ChatAttachment[];
  mentions: ChatMention[];
  replies?: ChatMessage[];
  parent?: {
    id: string;
    content: string | null;
    user: {
      id: string;
      firstName: string;
      lastName: string;
    };
    attachments: ChatAttachment[];
  };
  _count?: {
    replies: number;
  };
}

export interface ChatAttachment {
  id: string;
  messageId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  s3Key: string;
  s3Bucket: string;
  thumbnailKey?: string;
  url?: string;
  thumbnailUrl?: string;
}

export interface ChatMention {
  id: string;
  messageId: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface ChatRoom {
  id: string;
  threeplId: string;
  brandId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  threepl: {
    id: string;
    name: string;
  };
  brand: {
    id: string;
    name: string;
  };
  unreadCount: number;
  lastMessage?: ChatMessage;
  _count: {
    chatMessages: number;
    chatTasks: number;
  };
}

export interface ChatTask {
  id: string;
  roomId: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  categoryId?: string;
  assigneeId?: string;
  createdById: string;
  createdFromMessageId?: string;
  linkedOrderId?: string;
  dueDate?: string;
  completedAt?: string;
  notifyBrandUserId?: string;
  createdAt: string;
  updatedAt: string;
  assignee?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  category?: {
    id: string;
    name: string;
    description?: string;
    color?: string;
  };
  linkedOrder?: {
    id: string;
    orderNumber: string;
    status: string;
  };
  _count?: {
    comments: number;
  };
}

export interface TypingUser {
  userId: string;
  user: {
    firstName: string;
    lastName: string;
  };
}

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const token = authService.getToken();
      
      if (!token) {
        reject(new Error('No authentication token available'));
        return;
      }

      this.socket = io(process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000', {
        auth: {
          token
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
      });

      this.socket.on('connect', () => {
        console.log('✅ Connected to chat server');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from chat server:', reason);
        this.isConnected = false;
        
        if (reason === 'io server disconnect') {
          // Server disconnected us, try to reconnect
          this.handleReconnect();
        }
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
        this.isConnected = false;
        reject(error);
      });

      this.socket.on('error', (error) => {
        console.error('❌ Socket error:', error);
      });
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect().catch(console.error);
      }, Math.pow(2, this.reconnectAttempts) * 1000); // Exponential backoff
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Message events
  sendMessage(roomId: string, content: string, parentId?: string, mentions?: string[]) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('chat:send_message', {
      roomId,
      content,
      parentId,
      mentions
    });
  }

  markMessageAsRead(roomId: string, messageId: string) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('chat:mark_read', {
      roomId,
      messageId
    });
  }

  // Typing indicators
  startTyping(roomId: string) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('chat:typing_start', { roomId });
  }

  stopTyping(roomId: string) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('chat:typing_stop', { roomId });
  }

  // Task events
  createTaskFromMessage(data: {
    messageId: string;
    title: string;
    description?: string;
    assigneeId?: string;
    dueDate?: string;
    priority?: string;
  }) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('task:create_from_message', data);
  }

  updateTaskStatus(taskId: string, status: string) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('task:update_status', { taskId, status });
  }

  // Event listeners
  onNewMessage(callback: (message: ChatMessage) => void) {
    if (!this.socket) return;
    this.socket.on('chat:new_message', callback);
  }

  onMessageRead(callback: (data: { messageId: string; userId: string; readAt: string }) => void) {
    if (!this.socket) return;
    this.socket.on('chat:message_read', callback);
  }

  onUserTyping(callback: (data: TypingUser) => void) {
    if (!this.socket) return;
    this.socket.on('chat:user_typing', callback);
  }

  onUserStoppedTyping(callback: (data: { userId: string }) => void) {
    if (!this.socket) return;
    this.socket.on('chat:user_stopped_typing', callback);
  }

  onTaskCreated(callback: (task: ChatTask) => void) {
    if (!this.socket) return;
    this.socket.on('task:created', callback);
  }

  onTaskUpdated(callback: (task: ChatTask) => void) {
    if (!this.socket) return;
    this.socket.on('task:updated', callback);
  }

  onMentionNotification(callback: (data: {
    messageId: string;
    roomId: string;
    fromUser: any;
    content: string;
  }) => void) {
    if (!this.socket) return;
    this.socket.on('notification:mention', callback);
  }

  // Remove event listeners
  off(event: string, callback?: (...args: any[]) => void) {
    if (!this.socket) return;
    this.socket.off(event, callback);
  }

  // Connection status
  get connected() {
    return this.isConnected;
  }

  // Get socket instance for advanced usage
  getSocket() {
    return this.socket;
  }
}

// Export singleton instance
export const socketService = new SocketService();

