'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Paperclip, Smile, MoreVertical, ArrowLeft, Users, X, Reply } from 'lucide-react';
// Removed react-window for simpler auto-scroll approach
import { 
  useChatMessages, 
  useSocketMessages, 
  useTypingIndicators, 
  useFileUpload,
  useRoomUsers,
  useCreateTask
} from '../../hooks/useChat';
import { socketService, ChatRoom, ChatMessage } from '../../lib/socket';
import { MessageBubble } from './MessageBubble';
import { FileUploadDropzone } from './FileUploadDropzone';
import { TypingIndicator } from './TypingIndicator';
import { CreateTaskModal } from './CreateTaskModal';
import { SystemBotMessage } from './SystemBotMessage';
import { useSystemBot } from '../../hooks/useSystemBot';

interface ChatWindowProps {
  room: ChatRoom;
  currentUser: any;
  onBackToWorkspaces?: () => void;
  isMobile?: boolean;
}

export function ChatWindow({ room, currentUser, onBackToWorkspaces, isMobile = false }: ChatWindowProps) {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [taskSourceMessage, setTaskSourceMessage] = useState<ChatMessage | null>(null);
  // Removed isAtBottom state - always auto-scrolling now
  

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading
  } = useChatMessages(room.id);

  const fileUpload = useFileUpload();
  const typingUsers = useTypingIndicators(room.id);
  const { data: roomUsers = [] } = useRoomUsers(room.id);
  const createTaskMutation = useCreateTask();
  const { botResponses, processMessage, dismissBotResponse, handleBotAction, updateBotResponseMessageIds } = useSystemBot();

  // Set up real-time message listeners
  useSocketMessages(room.id);

  const messages = messagesData?.pages?.flatMap((page: any) => page.messages) || [];
  
  // Sort messages chronologically to ensure proper order
  const sortedMessages = messages.sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Update bot response message IDs when messages change
  useEffect(() => {
    if (sortedMessages.length > 0) {
      updateBotResponseMessageIds(sortedMessages);
    }
  }, [sortedMessages, updateBotResponseMessageIds]);

  // Simple scroll to bottom function for constrained container
  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    // Always scroll to bottom when messages change
    setTimeout(scrollToBottom, 100);
  }, [sortedMessages.length, scrollToBottom]);

  // Scroll to bottom when room changes
  useEffect(() => {
    setTimeout(scrollToBottom, 100);
  }, [room.id, scrollToBottom]);

  // Handle typing indicators
  const handleTypingStart = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      socketService.startTyping(room.id);
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketService.stopTyping(room.id);
    }, 2000);
  }, [room.id, isTyping]);

  const handleTypingStop = useCallback(() => {
    if (isTyping) {
      setIsTyping(false);
      socketService.stopTyping(room.id);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  }, [room.id, isTyping]);

  // Send message
  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || !socketService.connected) return;

    const messageContent = message.trim();
    const parentId = replyingTo?.id;
    setMessage('');
    setReplyingTo(null); // Clear reply state
    handleTypingStop();

    try {
      // Extract mentions (simple @username detection)
      const mentions = messageContent.match(/@(\w+)/g)?.map(m => m.substring(1)) || [];
      
      socketService.sendMessage(room.id, messageContent, parentId, mentions);
      
      // Process message for system bot response (only for brand users)
      if (currentUser?.role === 'BRAND_USER' || currentUser?.role === 'BRAND_ADMIN') {
        // Use a simpler approach - generate a unique ID and process immediately
        const tempMessageId = `temp_${Date.now()}_${Math.random()}`;
        console.log('Processing bot message for brand user:', messageContent);
        
        // Process immediately with temp ID, we'll update it later when we get the real message
        processMessage(messageContent, tempMessageId, currentUser, room).catch(error => {
          console.error('Error processing message for bot response:', error);
        });
      }
      
      // Force scroll to bottom when sending a message
      // Multiple scroll attempts to ensure it works
      setTimeout(scrollToBottom, 50);
      setTimeout(scrollToBottom, 150);
      setTimeout(scrollToBottom, 300);
      
      // Focus back to input
      messageInputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
      // Could show error toast here
    }
  }, [message, room.id, handleTypingStop, scrollToBottom]);

  // Handle file upload
  const handleFileUpload = useCallback(async (files: File[]) => {
    for (const file of files) {
      try {
        await fileUpload.mutateAsync({ roomId: room.id, file });
        
        // Force scroll to bottom after file upload
        setTimeout(scrollToBottom, 100);
      } catch (error) {
        console.error('Failed to upload file:', error);
        // Could show error toast here
      }
    }
    setShowFileUpload(false);
  }, [room.id, fileUpload, scrollToBottom]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle reply to message
  const handleReply = useCallback((replyToMessage: ChatMessage) => {
    console.log('Reply clicked for message:', replyToMessage.id);
    setReplyingTo(replyToMessage);
    // Focus the message input
    messageInputRef.current?.focus();
  }, []);

  // Handle create task from message
  const handleCreateTask = useCallback((sourceMessage: ChatMessage) => {
    console.log('Create Task clicked for message:', sourceMessage.id);
    setTaskSourceMessage(sourceMessage);
    setShowCreateTaskModal(true);
  }, []);

  // Handle edit message
  const handleEdit = useCallback((messageToEdit: ChatMessage) => {
    console.log('Edit clicked for message:', messageToEdit.id);
    alert(`Editing message: "${messageToEdit.content}"`);
    // TODO: Implement message editing
  }, []);

  // Handle delete message
  const handleDelete = useCallback((messageToDelete: ChatMessage) => {
    console.log('Delete clicked for message:', messageToDelete.id);
    if (confirm(`Are you sure you want to delete this message: "${messageToDelete.content}"?`)) {
      alert('Message would be deleted (not implemented yet)');
      // TODO: Call API to delete message
    }
  }, []);

  // Handle task creation from modal
  const handleTaskCreation = useCallback(async (taskData: {
    title: string;
    description?: string;
    assigneeId?: string;
    dueDate?: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    categoryId?: string;
    notifyBrandUserId?: string;
  }) => {
    if (!taskSourceMessage) return;

    try {
      await createTaskMutation.mutateAsync({
        roomId: room.id,
        taskData: {
          ...taskData,
          // Link to the source message
          createdFromMessageId: taskSourceMessage.id,
        }
      });
      
      console.log('Task created successfully from message:', taskSourceMessage.id);
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error; // Re-throw so modal can handle it
    }
  }, [taskSourceMessage, room.id, createTaskMutation]);

  // Removed virtual scrolling functions - using simple div-based approach now

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {isMobile && onBackToWorkspaces && (
            <button
              onClick={onBackToWorkspaces}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {room.brand.name.charAt(0)}
              </span>
            </div>
          </div>
          
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{room.brand.name}</h2>
            <p className="text-sm text-gray-500">via {room.threepl.name}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <Users className="h-5 w-5" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 relative">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">👋</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Start the conversation</h3>
              <p className="text-gray-500">Send a message to begin chatting with {room.brand.name}</p>
            </div>
          </div>
        ) : (
          <div 
            ref={messagesContainerRef}
            className="overflow-y-auto p-4 space-y-4"
            style={{ 
              height: 'calc(100vh - 240px)', // Minimal padding - right above input box
              scrollbarWidth: 'none', 
              msOverflowStyle: 'none' 
            }}
          >
            {/* Hide scrollbar with CSS */}
            <style jsx>{`
              div::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            
            {sortedMessages.map((message, index) => (
              <div key={message.id}>
                <MessageBubble
                  message={message}
                  currentUserId={currentUser.id}
                  isFirstInGroup={true} // Always true since we show individual messages
                  isLastInGroup={true}  // Always true since we show individual messages
                  onReply={handleReply}
                  onCreateTask={handleCreateTask}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
                
                {/* Show bot responses tied to this specific message */}
                {botResponses
                  .filter(botResponse => botResponse.messageId === message.id)
                  .map((botResponse) => (
                    <SystemBotMessage
                      key={botResponse.id}
                      message={botResponse.message}
                      actionCards={botResponse.actionCards}
                      orderNumber={botResponse.orderNumber}
                      loading={botResponse.loading}
                      threeplName={botResponse.threeplName}
                      onActionClick={handleBotAction}
                      onDismiss={() => dismissBotResponse(botResponse.id)}
                    />
                  ))}
              </div>
            ))}
            
            {/* Typing indicators */}
            {typingUsers.length > 0 && (
              <TypingIndicator users={typingUsers} />
            )}
            
            {/* Invisible div to scroll to */}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Removed scroll to bottom button - always auto-scrolling now */}


      </div>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100">
          <TypingIndicator users={typingUsers} />
        </div>
      )}

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-end space-x-2">
          <button
            onClick={() => setShowFileUpload(true)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={messageInputRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                handleTypingStart();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none max-h-32"
              style={{ minHeight: '40px' }}
            />
          </div>

          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Smile className="h-5 w-5" />
          </button>

          <button
            onClick={handleSendMessage}
            disabled={!message.trim() || !socketService.connected}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* File Upload Modal */}
      {showFileUpload && (
        <FileUploadDropzone
          onUpload={handleFileUpload}
          onClose={() => setShowFileUpload(false)}
          maxFiles={5}
          maxSize={50 * 1024 * 1024} // 50MB
        />
      )}

      {/* Create Task Modal */}
      {showCreateTaskModal && taskSourceMessage && (
        <CreateTaskModal
          isOpen={showCreateTaskModal}
          onClose={() => {
            setShowCreateTaskModal(false);
            setTaskSourceMessage(null);
          }}
          sourceMessage={taskSourceMessage}
          currentUser={currentUser}
          roomUsers={roomUsers}
          onCreateTask={handleTaskCreation}
        />
      )}
    </div>
  );
}
