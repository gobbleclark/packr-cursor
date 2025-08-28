'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Users, CheckSquare, Menu, X, Search, ArrowLeft } from 'lucide-react';
import { useChatRooms, useSocketConnection } from '../../hooks/useChat';
import { ChatRoomList } from './ChatRoomList';
import { ChatWindow } from './ChatWindow';
import { TaskPanel } from './TaskPanel';
import { ChatRoom } from '../../lib/socket';

interface ChatInterfaceProps {
  user: any;
  onLogout: () => void;
}

type ViewMode = 'workspaces' | 'chat' | 'tasks';

export function ChatInterface({ user, onLogout }: ChatInterfaceProps) {
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('workspaces');
  const [isMobile, setIsMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const { data: rooms, isLoading: roomsLoading } = useChatRooms();
  const { isConnected, error: connectionError } = useSocketConnection();

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-select first room on desktop
  useEffect(() => {
    if (!isMobile && rooms && rooms.length > 0 && !selectedRoom) {
      setSelectedRoom(rooms[0]);
      setViewMode('chat');
    }
  }, [rooms, isMobile, selectedRoom]);

  const handleRoomSelect = (room: ChatRoom) => {
    setSelectedRoom(room);
    if (isMobile) {
      setViewMode('chat');
    }
  };

  const handleBackToWorkspaces = () => {
    if (isMobile) {
      setViewMode('workspaces');
      setSelectedRoom(null);
    }
  };

  const handleShowTasks = () => {
    if (isMobile) {
      setViewMode('tasks');
    }
  };

  const filteredWorkspaces = rooms?.filter(room => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      room.brand.name.toLowerCase().includes(query) ||
      room.threepl.name.toLowerCase().includes(query) ||
      room.lastMessage?.content?.toLowerCase().includes(query)
    );
  }) || [];

  if (roomsLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading workspaces...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Navigation Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <a 
            href="/dashboard" 
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Dashboard</span>
          </a>
          <div className="h-4 w-px bg-gray-300"></div>
                      <h1 className="text-lg font-semibold text-gray-900">Workspace</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-xs text-gray-500">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
      {/* Mobile Header */}
      {isMobile && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {viewMode !== 'workspaces' && (
              <button
                onClick={handleBackToWorkspaces}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            )}
            <h1 className="text-lg font-semibold text-gray-900">
              {viewMode === 'workspaces' && 'Workspace'}
              {viewMode === 'chat' && selectedRoom?.brand.name}
              {viewMode === 'tasks' && 'Tasks'}
            </h1>
          </div>
          
          <div className="flex items-center space-x-2">
            {viewMode === 'workspaces' && (
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Search className="h-5 w-5" />
              </button>
            )}
            
            {viewMode === 'chat' && selectedRoom && (
              <button
                onClick={handleShowTasks}
                className="p-2 hover:bg-gray-100 rounded-lg relative"
              >
                <CheckSquare className="h-5 w-5" />
                {selectedRoom._count.chatTasks > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {selectedRoom._count.chatTasks}
                  </span>
                )}
              </button>
            )}
            
            <button
              onClick={onLogout}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Search Bar (Mobile) */}
      {isMobile && showSearch && viewMode === 'workspaces' && (
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <input
            type="text"
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>
      )}

      {/* Connection Status */}
      {!isConnected && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
          <p className="text-sm text-yellow-800">
            {connectionError ? `Connection error: ${connectionError}` : 'Connecting to chat...'}
          </p>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Layout */}
        {!isMobile && (
          <>
            {/* Sidebar */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
              {/* Sidebar Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-900">Workspace</h2>
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-xs text-gray-500">
                      {isConnected ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
                
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search workspaces..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* Workspace List */}
              <div className="flex-1 overflow-y-auto">
                <ChatRoomList
                  rooms={filteredWorkspaces}
                  selectedRoom={selectedRoom}
                  onRoomSelect={handleRoomSelect}
                  currentUserId={user?.id}
                />
              </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex">
              {selectedRoom ? (
                <>
                  {/* Chat Window */}
                  <div className="w-1/2 flex flex-col">
                    <ChatWindow
                      room={selectedRoom}
                      currentUser={user}
                      onBackToWorkspaces={handleBackToWorkspaces}
                    />
                  </div>

                  {/* Tasks Panel */}
                  <div className="w-1/2 border-l border-gray-200">
                    <TaskPanel
                      room={selectedRoom}
                      currentUser={user}
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Select a workspace</h3>
                    <p className="text-gray-500">Choose a workspace from the sidebar to start chatting</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Mobile Layout */}
        {isMobile && (
          <div className="flex-1 flex flex-col">
            {viewMode === 'workspaces' && (
              <ChatRoomList
                rooms={filteredWorkspaces}
                selectedRoom={selectedRoom}
                onRoomSelect={handleRoomSelect}
                currentUserId={user?.id}
                isMobile={true}
              />
            )}

            {viewMode === 'chat' && selectedRoom && (
              <ChatWindow
                room={selectedRoom}
                currentUser={user}
                onBackToWorkspaces={handleBackToWorkspaces}
                isMobile={true}
              />
            )}

            {viewMode === 'tasks' && selectedRoom && (
              <TaskPanel
                room={selectedRoom}
                currentUser={user}
                isMobile={true}
                onBack={() => setViewMode('chat')}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
