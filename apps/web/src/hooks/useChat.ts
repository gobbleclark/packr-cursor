import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { chatAPI } from '../lib/chat-api';
import { socketService, ChatMessage, ChatRoom, ChatTask, TypingUser } from '../lib/socket';

// Chat Rooms
export function useChatRooms() {
  return useQuery({
    queryKey: ['chat', 'rooms'],
    queryFn: () => chatAPI.getChatRooms(),
    select: (data) => data.rooms,
    staleTime: 30000, // 30 seconds
  });
}

export function useCreateChatRoom() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ threeplId, brandId }: { threeplId: string; brandId: string }) =>
      chatAPI.createOrGetChatRoom(threeplId, brandId),
    onSuccess: (data) => {
      // Add the new room to the cache
      queryClient.setQueryData(['chat', 'rooms'], (old: any) => {
        if (!old) return { rooms: [data.room] };
        const existingRoom = old.rooms.find((r: ChatRoom) => r.id === data.room.id);
        if (existingRoom) return old;
        return { rooms: [data.room, ...old.rooms] };
      });
    },
  });
}

export function useRoomUsers(roomId: string | null) {
  return useQuery({
    queryKey: ['chat', 'room-users', roomId],
    queryFn: () => {
      if (!roomId) throw new Error('Room ID required');
      return chatAPI.getRoomUsers(roomId);
    },
    select: (data) => data.users,
    enabled: !!roomId,
    staleTime: 300000, // 5 minutes
  });
}

// Messages with infinite scroll
export function useChatMessages(roomId: string | null) {
  return useInfiniteQuery({
    queryKey: ['chat', 'messages', roomId],
    queryFn: ({ pageParam }) => {
      if (!roomId) throw new Error('Room ID required');
      return chatAPI.getMessages(roomId, pageParam);
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.messages.length) return undefined;
      return lastPage.messages[0].createdAt; // Use first message timestamp for pagination
    },
    enabled: !!roomId,
    staleTime: 60000, // 1 minute
    select: (data) => {
      const allMessages = data.pages.flatMap(page => page.messages);
      // Sort all messages by createdAt to ensure proper chronological order
      allMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      return {
        pages: data.pages,
        pageParams: data.pageParams,
        messages: allMessages,
      };
    },
  });
}

export function useSearchMessages(roomId: string | null, query: string) {
  return useQuery({
    queryKey: ['chat', 'search', roomId, query],
    queryFn: () => {
      if (!roomId || !query.trim()) throw new Error('Room ID and query required');
      return chatAPI.searchMessages(roomId, query);
    },
    enabled: !!roomId && !!query.trim(),
    select: (data) => data.messages,
  });
}

// Tasks
export function useChatTasks(roomId: string | null, status?: string) {
  return useQuery({
    queryKey: ['chat', 'tasks', roomId, status],
    queryFn: () => {
      if (!roomId) throw new Error('Room ID required');
      return chatAPI.getTasks(roomId, status);
    },
    enabled: !!roomId,
    select: (data) => data.tasks,
    staleTime: 30000,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ roomId, taskData }: { 
      roomId: string; 
      taskData: Parameters<typeof chatAPI.createTask>[1] 
    }) => chatAPI.createTask(roomId, taskData),
    onSuccess: (data, variables) => {
      // Add task to cache
      queryClient.setQueryData(['chat', 'tasks', variables.roomId], (old: ChatTask[] = []) => [
        data.task,
        ...old,
      ]);
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['chat', 'rooms'] });
    },
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) => 
      chatAPI.updateTaskStatus(taskId, status),
    onSuccess: (data) => {
      // Update task in all relevant caches
      queryClient.setQueryData(['chat', 'tasks'], (old: ChatTask[] = []) =>
        old.map(task => task.id === data.task.id ? data.task : task)
      );
      
      // Invalidate task queries to refresh
      queryClient.invalidateQueries({ queryKey: ['chat', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'rooms'] });
    },
  });
}

export function useTaskComments(taskId: string | null) {
  return useQuery({
    queryKey: ['chat', 'task-comments', taskId],
    queryFn: () => {
      if (!taskId) throw new Error('Task ID required');
      return chatAPI.getTaskComments(taskId);
    },
    select: (data) => data.comments,
    enabled: !!taskId,
    staleTime: 30000,
  });
}

export function useAddTaskComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ taskId, content }: { taskId: string; content: string }) =>
      chatAPI.addTaskComment(taskId, content),
    onSuccess: (data, variables) => {
      // Add comment to cache
      queryClient.setQueryData(['chat', 'task-comments', variables.taskId], (old: any[] = []) => [
        ...old,
        data.comment,
      ]);
      
      // Update task comment count
      queryClient.invalidateQueries({ queryKey: ['chat', 'tasks'] });
    },
  });
}

// File Upload
export function useFileUpload() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ roomId, file }: { roomId: string; file: File }) =>
      chatAPI.uploadFile(roomId, file),
    onSuccess: (data, variables) => {
      // Don't add message optimistically - let Socket.io handle it to avoid duplicates
      // Just invalidate the rooms query to update last message
      queryClient.invalidateQueries({ queryKey: ['chat', 'rooms'] });
    },
  });
}

// Real-time Socket Hooks
export function useSocketConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const connect = async () => {
      try {
        await socketService.connect();
        setIsConnected(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Connection failed');
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      socketService.disconnect();
      setIsConnected(false);
    };
  }, []);

  return { isConnected, error };
}

export function useSocketMessages(roomId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!roomId) return;

    const handleNewMessage = (message: ChatMessage) => {
      if (message.roomId !== roomId) return;

      // Add message to cache (check for duplicates)
      queryClient.setQueryData(['chat', 'messages', roomId], (old: any) => {
        if (!old) return { pages: [{ messages: [message] }], pageParams: [undefined] };
        
        // Check if message already exists in any page
        const messageExists = old.pages.some((page: any) => 
          page.messages.some((existingMessage: ChatMessage) => existingMessage.id === message.id)
        );
        
        if (messageExists) {
          return old; // Don't add duplicate
        }
        
        const newPages = [...old.pages];
        if (newPages.length > 0) {
          const lastPage = newPages[newPages.length - 1];
          newPages[newPages.length - 1] = {
            ...lastPage,
            messages: [...lastPage.messages, message],
          };
        }
        
        return { ...old, pages: newPages };
      });

      // Update room's unread count and last message
      queryClient.setQueryData(['chat', 'rooms'], (old: any) => {
        if (!old) return old;
        
        return {
          ...old,
          rooms: old.rooms.map((room: ChatRoom) => 
            room.id === roomId 
              ? { 
                  ...room, 
                  lastMessage: message,
                  unreadCount: room.unreadCount + (message.userId !== getCurrentUserId() ? 1 : 0)
                }
              : room
          ),
        };
      });
    };

    const handleMessageRead = (data: { messageId: string; userId: string; readAt: string }) => {
      // Update read receipts in cache if needed
      // This could be expanded to show read indicators
    };

    socketService.onNewMessage(handleNewMessage);
    socketService.onMessageRead(handleMessageRead);

    return () => {
      socketService.off('chat:new_message', handleNewMessage);
      socketService.off('chat:message_read', handleMessageRead);
    };
  }, [roomId, queryClient]);
}

export function useSocketTasks(roomId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!roomId) return;

    const handleTaskCreated = (task: ChatTask) => {
      if (task.roomId !== roomId) return;

      queryClient.setQueryData(['chat', 'tasks', roomId], (old: ChatTask[] = []) => [
        task,
        ...old,
      ]);

      // Update room task count
      queryClient.invalidateQueries({ queryKey: ['chat', 'rooms'] });
    };

    const handleTaskUpdated = (task: ChatTask) => {
      if (task.roomId !== roomId) return;

      queryClient.setQueryData(['chat', 'tasks', roomId], (old: ChatTask[] = []) =>
        old.map(t => t.id === task.id ? task : t)
      );

      // Update room task count if status changed
      queryClient.invalidateQueries({ queryKey: ['chat', 'rooms'] });
    };

    socketService.onTaskCreated(handleTaskCreated);
    socketService.onTaskUpdated(handleTaskUpdated);

    return () => {
      socketService.off('task:created', handleTaskCreated);
      socketService.off('task:updated', handleTaskUpdated);
    };
  }, [roomId, queryClient]);
}

export function useTypingIndicators(roomId: string | null) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  useEffect(() => {
    if (!roomId) return;

    const handleUserTyping = (data: TypingUser) => {
      setTypingUsers(prev => {
        const existing = prev.find(u => u.userId === data.userId);
        if (existing) return prev;
        return [...prev, data];
      });

      // Auto-remove after 3 seconds
      setTimeout(() => {
        setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
      }, 3000);
    };

    const handleUserStoppedTyping = (data: { userId: string }) => {
      setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
    };

    socketService.onUserTyping(handleUserTyping);
    socketService.onUserStoppedTyping(handleUserStoppedTyping);

    return () => {
      socketService.off('chat:user_typing', handleUserTyping);
      socketService.off('chat:user_stopped_typing', handleUserStoppedTyping);
    };
  }, [roomId]);

  return typingUsers;
}

// Helper function to get current user ID
function getCurrentUserId(): string {
  // Get user ID from localStorage token (basic implementation)
  try {
    const token = localStorage.getItem('token');
    if (!token) return '';
    
    // Decode JWT token to get user ID (basic decode, not secure but works for client-side)
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.userId || '';
  } catch {
    return '';
  }
}
