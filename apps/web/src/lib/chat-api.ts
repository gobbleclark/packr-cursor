import { authService } from './auth';
import { ChatRoom, ChatMessage, ChatTask } from './socket';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

class ChatAPI {
  private async fetch(endpoint: string, options: RequestInit = {}) {
    const token = authService.getToken();
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || error.message || 'Request failed');
    }

    return response.json();
  }

  // Chat Rooms
  async getChatRooms(): Promise<{ success: boolean; rooms: ChatRoom[] }> {
    return this.fetch('/api/chat/rooms');
  }

  async createOrGetChatRoom(threeplId: string, brandId: string): Promise<{ success: boolean; room: ChatRoom }> {
    return this.fetch('/api/chat/rooms', {
      method: 'POST',
      body: JSON.stringify({ threeplId, brandId }),
    });
  }

  async getRoomUsers(roomId: string): Promise<{ success: boolean; users: any[] }> {
    return this.fetch(`/api/chat/rooms/${roomId}/users`);
  }

  // Messages
  async getMessages(
    roomId: string, 
    before?: string, 
    limit: number = 50
  ): Promise<{ success: boolean; messages: ChatMessage[] }> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (before) params.append('before', before);
    
    return this.fetch(`/api/chat/rooms/${roomId}/messages?${params.toString()}`);
  }

  async searchMessages(
    roomId: string, 
    query: string, 
    limit: number = 20
  ): Promise<{ success: boolean; messages: ChatMessage[] }> {
    const params = new URLSearchParams({ q: query, limit: limit.toString() });
    return this.fetch(`/api/chat/rooms/${roomId}/search?${params.toString()}`);
  }

  // Tasks
  async getTasks(
    roomId: string, 
    status?: string
  ): Promise<{ success: boolean; tasks: ChatTask[] }> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    
    return this.fetch(`/api/chat/rooms/${roomId}/tasks?${params.toString()}`);
  }

  async createTask(roomId: string, taskData: {
    title: string;
    description?: string;
    assigneeId?: string;
    dueDate?: string;
    priority?: string;
    linkedOrderId?: string;
    notifyBrandUserId?: string;
    createdFromMessageId?: string;
  }): Promise<{ success: boolean; task: ChatTask }> {
    return this.fetch(`/api/chat/rooms/${roomId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  }

  async updateTaskStatus(taskId: string, status: string): Promise<{ success: boolean; task: ChatTask }> {
    return this.fetch(`/api/chat/tasks/${taskId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async getTaskComments(taskId: string): Promise<{ success: boolean; comments: any[] }> {
    return this.fetch(`/api/chat/tasks/${taskId}/comments`);
  }

  async addTaskComment(taskId: string, content: string): Promise<{ success: boolean; comment: any }> {
    return this.fetch(`/api/chat/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async getTask(taskId: string): Promise<{ success: boolean; task: ChatTask }> {
    return this.fetch(`/api/chat/tasks/${taskId}`);
  }

  // File Uploads
  async uploadFile(
    roomId: string, 
    file: File
  ): Promise<{ success: boolean; message: ChatMessage }> {
    const token = authService.getToken();
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/api/chat/rooms/${roomId}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  }

  async getUploadUrl(
    roomId: string, 
    filename: string, 
    mimeType: string
  ): Promise<{ success: boolean; uploadUrl: string; fileKey: string; fileUrl: string }> {
    return this.fetch(`/api/chat/rooms/${roomId}/upload-url`, {
      method: 'POST',
      body: JSON.stringify({ filename, mimeType }),
    });
  }

  async confirmUpload(
    roomId: string, 
    fileData: {
      fileKey: string;
      originalName: string;
      mimeType: string;
      fileSize: number;
    }
  ): Promise<{ success: boolean; message: ChatMessage }> {
    return this.fetch(`/api/chat/rooms/${roomId}/confirm-upload`, {
      method: 'POST',
      body: JSON.stringify(fileData),
    });
  }

  async getDownloadUrl(attachmentId: string): Promise<{ 
    success: boolean; 
    downloadUrl: string; 
    filename: string; 
    mimeType: string; 
    fileSize: number; 
  }> {
    return this.fetch(`/api/chat/attachments/${attachmentId}/download`);
  }

  async deleteAttachment(attachmentId: string): Promise<{ success: boolean; message: string }> {
    return this.fetch(`/api/chat/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
  }
}

export const chatAPI = new ChatAPI();

