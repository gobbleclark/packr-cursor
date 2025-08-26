'use client';

import { Building2, MessageSquare, CheckSquare, Clock } from 'lucide-react';
import { ChatRoom } from '../../lib/socket';

interface ChatRoomListProps {
  rooms: ChatRoom[];
  selectedRoom: ChatRoom | null;
  onRoomSelect: (room: ChatRoom) => void;
  currentUserId: string;
  isMobile?: boolean;
}

export function ChatRoomList({ 
  rooms, 
  selectedRoom, 
  onRoomSelect, 
  currentUserId,
  isMobile = false 
}: ChatRoomListProps) {
  const formatLastMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return minutes <= 1 ? 'now' : `${minutes}m`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h`;
    } else {
      const days = Math.floor(diffInHours / 24);
      return days === 1 ? '1d' : `${days}d`;
    }
  };

  const truncateMessage = (content: string | null, maxLength: number = 50) => {
    if (!content) return 'No messages yet';
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (rooms.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No workspaces</h3>
          <p className="text-gray-500 text-sm">
            Workspaces will appear here when you have conversations with brands or 3PLs
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isMobile ? 'flex-1' : ''} overflow-y-auto`}>
      <div className="divide-y divide-gray-200">
        {rooms.map((room) => {
          const isSelected = selectedRoom?.id === room.id;
          const hasUnread = room.unreadCount > 0;
          const openTasks = room._count.chatTasks;

          return (
            <button
              key={room.id}
              onClick={() => onRoomSelect(room)}
              className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                isSelected ? 'bg-blue-50 border-r-2 border-blue-500' : ''
              }`}
            >
              <div className="flex items-start space-x-3">
                {/* Brand/3PL Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                </div>

                {/* Room Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={`text-sm font-medium truncate ${
                      hasUnread ? 'text-gray-900' : 'text-gray-700'
                    }`}>
                      {room.brand.name}
                    </h3>
                    
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {/* Unread Count */}
                      {hasUnread && (
                        <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                          {room.unreadCount > 99 ? '99+' : room.unreadCount}
                        </span>
                      )}
                      
                      {/* Last Message Time */}
                      {room.lastMessage && (
                        <span className="text-xs text-gray-400">
                          {formatLastMessageTime(room.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 3PL Name */}
                  <p className="text-xs text-gray-500 mb-1">
                    via {room.threepl.name}
                  </p>

                  {/* Last Message Preview */}
                  <p className={`text-sm truncate ${
                    hasUnread ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}>
                    {room.lastMessage ? (
                      <>
                        {room.lastMessage.userId === currentUserId && (
                          <span className="text-gray-400">You: </span>
                        )}
                        {room.lastMessage.messageType === 'IMAGE' && '📷 Image'}
                        {room.lastMessage.messageType === 'FILE' && '📎 File'}
                        {room.lastMessage.messageType === 'TASK_CREATED' && '✅ Task created'}
                        {room.lastMessage.messageType === 'TEXT' && 
                          truncateMessage(room.lastMessage.content)
                        }
                      </>
                    ) : (
                      <span className="text-gray-400">No messages yet</span>
                    )}
                  </p>

                  {/* Room Stats */}
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center space-x-1 text-xs text-gray-400">
                      <MessageSquare className="h-3 w-3" />
                      <span>{room._count.chatMessages}</span>
                    </div>
                    
                    {openTasks > 0 && (
                      <div className="flex items-center space-x-1 text-xs text-orange-500">
                        <CheckSquare className="h-3 w-3" />
                        <span>{openTasks}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Active Indicator */}
              {isSelected && !isMobile && (
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-l"></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
