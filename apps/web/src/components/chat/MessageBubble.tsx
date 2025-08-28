'use client';

import { useState } from 'react';
import { Download, Eye, MoreVertical, Reply, CheckSquare, Edit, Trash2 } from 'lucide-react';
import { ChatMessage } from '../../lib/socket';

interface MessageBubbleProps {
  message: ChatMessage;
  currentUserId: string;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  onReply?: (message: ChatMessage) => void;
  onCreateTask?: (message: ChatMessage) => void;
  onEdit?: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
}

export function MessageBubble({ 
  message, 
  currentUserId, 
  isFirstInGroup, 
  isLastInGroup,
  onReply,
  onCreateTask,
  onEdit,
  onDelete
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const isOwnMessage = message.userId === currentUserId;

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const isWithin24Hours = (timestamp: string) => {
    const messageTime = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);
    return diffInHours <= 24;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return '🗜️';
    return '📎';
  };

  const renderMessageContent = () => {
    switch (message.messageType) {
      case 'IMAGE':
        return (
          <div className="space-y-2">
            {message.attachments.map((attachment) => (
              <div key={attachment.id} className="relative group">
                <img
                  src={attachment.thumbnailUrl || attachment.url}
                  alt={attachment.originalName}
                  className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(attachment.url, '_blank')}
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-all flex items-center justify-center">
                  <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
            {message.content && (
              <p className="text-sm">{message.content}</p>
            )}
          </div>
        );

      case 'FILE':
        return (
          <div className="space-y-2">
            {message.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => window.open(attachment.url, '_blank')}
              >
                <span className="text-2xl">{getFileIcon(attachment.mimeType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {attachment.originalName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(attachment.fileSize / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <Download className="h-4 w-4 text-gray-400" />
              </div>
            ))}
          </div>
        );

      case 'TASK_CREATED':
        return (
          <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <CheckSquare className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-800">
              Created a new task: {message.content}
            </span>
          </div>
        );

      case 'SYSTEM':
        return (
          <div className="text-center">
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {message.content}
            </span>
          </div>
        );

      default:
        return (
          <div className="space-y-1">
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
            
            {/* Enhanced Mentions with Avatars */}
            {message.mentions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {message.mentions.map((mention) => (
                  <div
                    key={mention.id}
                    className="flex items-center space-x-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full"
                  >
                    <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-medium">
                        {mention.user.firstName.charAt(0)}
                      </span>
                    </div>
                    <span className="text-xs font-medium">
                      @{mention.user.firstName} {mention.user.lastName}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
    }
  };

  if (message.messageType === 'SYSTEM') {
    return (
      <div className="flex justify-center py-2">
        {renderMessageContent()}
      </div>
    );
  }

  return (
    <div
      className={`flex px-4 mb-3 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`flex items-start space-x-3 ${
        isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''
      }`}>
        {/* Avatar - Always show */}
        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-medium">
            {message.user.firstName.charAt(0)}{message.user.lastName.charAt(0)}
          </span>
        </div>

        {/* Message Content */}
        <div className="max-w-md">
          {/* Sender Name and Timestamp - Always show */}
          <div className={`flex items-center space-x-2 mb-1 ${
            isOwnMessage ? 'justify-end' : 'justify-start'
          }`}>
            {isOwnMessage ? (
              <>
                <p className="text-xs text-gray-500">
                  {formatTime(message.createdAt)}
                </p>
                <p className="text-sm font-medium text-gray-900">
                  You
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-900">
                  {message.user.firstName} {message.user.lastName}
                </p>
                <p className="text-xs text-gray-500">
                  {formatTime(message.createdAt)}
                </p>
              </>
            )}
          </div>

          {/* Message Bubble */}
          <div className={`${isOwnMessage ? 'text-right' : 'text-left'}`}>
            <div
              className={`relative px-3 py-2 rounded-lg inline-block text-left ${
                isOwnMessage
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              } ${
                showActions ? 'shadow-lg' : ''
              }`}
          >
            {renderMessageContent()}

            {/* Message Actions */}
            {showActions && (
              <div
                className={`absolute top-0 z-10 ${
                  isOwnMessage ? 'left-0 -translate-x-full -ml-2' : 'right-0 translate-x-full ml-2'
                } flex items-center space-x-1 bg-white border border-gray-200 rounded-lg shadow-lg px-2 py-1`}
              >
                <button 
                  className="p-1 hover:bg-gray-100 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Reply button clicked');
                    onReply?.(message);
                  }}
                  title="Reply to message"
                >
                  <Reply className="h-3 w-3 text-gray-500" />
                </button>
                <button 
                  className="p-1 hover:bg-gray-100 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Create task button clicked');
                    onCreateTask?.(message);
                  }}
                  title="Create task from message"
                >
                  <CheckSquare className="h-3 w-3 text-gray-500" />
                </button>
                
                {/* Edit and Delete - only for own messages within 24 hours */}
                {isOwnMessage && isWithin24Hours(message.createdAt) && (
                  <>
                    <button 
                      className="p-1 hover:bg-gray-100 rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Edit button clicked');
                        onEdit?.(message);
                      }}
                      title="Edit message"
                    >
                      <Edit className="h-3 w-3 text-gray-500" />
                    </button>
                    <button 
                      className="p-1 hover:bg-gray-100 rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Delete button clicked');
                        onDelete?.(message);
                      }}
                      title="Delete message"
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                  </>
                )}
                
                <button 
                  className="p-1 hover:bg-gray-100 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('More options button clicked');
                    alert('More options menu (not implemented yet)');
                  }}
                  title="More options"
                >
                  <MoreVertical className="h-3 w-3 text-gray-500" />
                </button>
              </div>
            )}
            </div>
          </div>

          {/* Removed old timestamp - now shown in header */}

          {/* Replies Preview */}
          {message.replies && message.replies.length > 0 && (
            <div className="mt-2 ml-4 space-y-1">
              <button className="text-xs text-blue-500 hover:text-blue-600">
                {message._count?.replies || message.replies.length} replies
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
