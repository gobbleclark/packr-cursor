'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, CheckSquare, Clock, User, Calendar, ArrowLeft, MessageCircle, Check } from 'lucide-react';
import { useChatTasks, useSocketTasks, useCreateTask, useUpdateTaskStatus } from '../../hooks/useChat';
import { ChatRoom, ChatTask } from '../../lib/socket';

interface TaskPanelProps {
  room: ChatRoom;
  currentUser: any;
  isMobile?: boolean;
  onBack?: () => void;
}

export function TaskPanel({ room, currentUser, isMobile = false, onBack }: TaskPanelProps) {
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const { data: tasks, isLoading } = useChatTasks(room.id, selectedStatus === 'all' ? undefined : selectedStatus);
  const createTask = useCreateTask();

  // Set up real-time task listeners
  useSocketTasks(room.id);

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;

    try {
      await createTask.mutateAsync({
        roomId: room.id,
        taskData: {
          title: newTaskTitle.trim(),
          description: newTaskDescription.trim() || undefined,
          priority: 'NORMAL'
        }
      });

      setNewTaskTitle('');
      setNewTaskDescription('');
      setShowCreateTask(false);
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO': return 'bg-gray-100 text-gray-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'text-gray-500';
      case 'NORMAL': return 'text-blue-500';
      case 'HIGH': return 'text-orange-500';
      case 'URGENT': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const activeTasks = tasks?.filter(task => task.status !== 'COMPLETED' && task.status !== 'CANCELLED') || [];
  const completedTasks = tasks?.filter(task => task.status === 'COMPLETED') || [];

  return (
    <div className="bg-white flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          {isMobile && onBack && (
            <button
              onClick={onBack}
              className="p-1 hover:bg-gray-100 rounded mr-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <h3 className="text-lg font-semibold text-gray-900">Tasks</h3>
          <button
            onClick={() => setShowCreateTask(true)}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex space-x-2">
          {['all', 'TODO', 'IN_PROGRESS', 'COMPLETED'].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                selectedStatus === status
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div 
        className="overflow-y-auto"
        style={{ 
          height: 'calc(100vh - 240px)', // Match chat window height - right above input
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
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : tasks && tasks.length > 0 ? (
          <div className="p-4 space-y-4">
            {/* Active Tasks */}
            {activeTasks.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  Active Tasks ({activeTasks.length})
                </h4>
                <div className="space-y-3">
                  {activeTasks.map((task) => (
                    <TaskCard key={task.id} task={task} currentUser={currentUser} />
                  ))}
                </div>
              </div>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  Completed ({completedTasks.length})
                </h4>
                <div className="space-y-3">
                  {completedTasks.map((task) => (
                    <TaskCard key={task.id} task={task} currentUser={currentUser} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <CheckSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No tasks yet</h4>
              <p className="text-gray-500 text-sm mb-4">
                Create tasks to track work for {room.brand.name}
              </p>
              <button
                onClick={() => setShowCreateTask(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Create First Task
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateTask && (
        <div className="absolute inset-0 bg-white z-10 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Create Task</h3>
              <button
                onClick={() => setShowCreateTask(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                ×
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Title *
              </label>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Enter task title..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Add task description..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="p-4 border-t border-gray-200 flex justify-end space-x-3">
            <button
              onClick={() => setShowCreateTask(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateTask}
              disabled={!newTaskTitle.trim() || createTask.isPending}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createTask.isPending ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, currentUser }: { task: ChatTask; currentUser: any }) {
  const router = useRouter();
  const updateTaskStatus = useUpdateTaskStatus();
  const [isUpdating, setIsUpdating] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO': return 'bg-gray-100 text-gray-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'TODO': return 'Open';
      case 'IN_PROGRESS': return 'In Progress';
      case 'COMPLETED': return 'Completed';
      case 'CANCELLED': return 'Cancelled';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'text-gray-500';
      case 'NORMAL': return 'text-blue-500';
      case 'HIGH': return 'text-orange-500';
      case 'URGENT': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const handleToggleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (isUpdating) return;

    const newStatus = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
    setIsUpdating(true);

    try {
      await updateTaskStatus.mutateAsync({
        taskId: task.id,
        status: newStatus
      });
    } catch (error) {
      console.error('Failed to update task status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTaskClick = () => {
    // Navigate to task detail page
    router.push(`/chat/tasks/${task.id}`);
  };

  return (
    <div 
      className="p-3 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow cursor-pointer"
      onClick={handleTaskClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start space-x-2 flex-1">
          {/* Completion Checkbox */}
          <button
            onClick={handleToggleComplete}
            disabled={isUpdating}
            className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
              task.status === 'COMPLETED'
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-gray-300 hover:border-green-400'
            } ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            title={task.status === 'COMPLETED' ? 'Mark as incomplete' : 'Mark as complete'}
          >
            {task.status === 'COMPLETED' && <Check className="h-3 w-3" />}
          </button>
          
          <h5 className={`text-sm font-medium flex-1 ${
            task.status === 'COMPLETED' ? 'text-gray-500 line-through' : 'text-gray-900'
          }`}>
            {task.title}
          </h5>
        </div>
        
        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
          {getStatusLabel(task.status)}
        </span>
      </div>

      {task.description && (
        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{task.description}</p>
      )}

      {/* Creator and Created Date */}
      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
        <div className="flex items-center space-x-1">
          <span>Created by {task.createdBy.firstName} {task.createdBy.lastName}</span>
        </div>
        <div className="flex items-center space-x-1">
          <Calendar className="h-3 w-3" />
          <span>{new Date(task.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Assignee, Due Date, and Priority */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-3">
          {task.assignee ? (
            <div className="flex items-center space-x-1">
              <User className="h-3 w-3" />
              <span>Assigned to {task.assignee.firstName} {task.assignee.lastName}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-gray-400">
              <User className="h-3 w-3" />
              <span>Unassigned</span>
            </div>
          )}
          
          {task.dueDate && (
            <div className="flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-1 ${getPriorityColor(task.priority)}`}>
            <Clock className="h-3 w-3" />
            <span>{task.priority}</span>
          </div>
          
          {/* Comment Count */}
          {task._count?.comments && task._count.comments > 0 && (
            <div className="flex items-center space-x-1 text-gray-500">
              <MessageCircle className="h-3 w-3" />
              <span>{task._count.comments}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

