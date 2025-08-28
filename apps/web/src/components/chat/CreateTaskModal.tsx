'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  MessageSquare, 
  User, 
  Calendar, 
  Flag, 
  Tag, 
  Clock,
  AlertCircle,
  CheckCircle2,
  Users
} from 'lucide-react';
import { ChatMessage } from '../../lib/socket';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceMessage: ChatMessage;
  currentUser: any;
  roomUsers: any[];
  onCreateTask: (taskData: {
    title: string;
    description?: string;
    assigneeId?: string;
    dueDate?: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    categoryId?: string;
    notifyBrandUserId?: string;
  }) => void;
}

const priorityOptions = [
  { value: 'LOW', label: 'Low', color: 'text-gray-600 bg-gray-100', icon: '🔵' },
  { value: 'NORMAL', label: 'Normal', color: 'text-blue-600 bg-blue-100', icon: '🟢' },
  { value: 'HIGH', label: 'High', color: 'text-orange-600 bg-orange-100', icon: '🟡' },
  { value: 'URGENT', label: 'Urgent', color: 'text-red-600 bg-red-100', icon: '🔴' },
];

const categoryOptions = [
  { value: 'shipment', label: 'Shipment', color: 'bg-blue-100 text-blue-800' },
  { value: 'tracking', label: 'Tracking', color: 'bg-green-100 text-green-800' },
  { value: 'inventory', label: 'Inventory', color: 'bg-purple-100 text-purple-800' },
  { value: 'customer-service', label: 'Customer Service', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'returns', label: 'Returns', color: 'bg-red-100 text-red-800' },
  { value: 'general', label: 'General', color: 'bg-gray-100 text-gray-800' },
];

export function CreateTaskModal({
  isOpen,
  onClose,
  sourceMessage,
  currentUser,
  roomUsers,
  onCreateTask
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [categoryId, setCategoryId] = useState('');
  const [notifyBrandUserId, setNotifyBrandUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-populate title from message content
  useEffect(() => {
    if (sourceMessage?.content && !title) {
      // Create a smart title from the message content
      const content = sourceMessage.content;
      let smartTitle = '';
      
      if (content.length <= 50) {
        smartTitle = content;
      } else {
        // Take first sentence or first 50 characters
        const firstSentence = content.split('.')[0];
        if (firstSentence.length <= 50) {
          smartTitle = firstSentence + (content.includes('.') ? '.' : '');
        } else {
          smartTitle = content.substring(0, 47) + '...';
        }
      }
      
      setTitle(smartTitle);
    }
  }, [sourceMessage, title]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onCreateTask({
        title: title.trim(),
        description: description.trim() || undefined,
        assigneeId: assigneeId || undefined,
        dueDate: dueDate || undefined,
        priority,
        categoryId: categoryId || undefined,
        notifyBrandUserId: notifyBrandUserId || undefined,
      });
      
      // Reset form
      setTitle('');
      setDescription('');
      setAssigneeId('');
      setDueDate('');
      setPriority('NORMAL');
      setCategoryId('');
      setNotifyBrandUserId('');
      
      onClose();
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const truncateMessage = (content: string | null, maxLength: number = 100) => {
    if (!content) return 'No content';
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const formatMessageTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString([], { 
      month: 'short',
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Filter users for assignment (only 3PL users can be assigned tasks)
  const assignableUsers = roomUsers.filter(user => 
    user.role === 'super_admin' || user.role === '3pl_user'
  );

  // Filter brand users for notifications
  const brandUsers = roomUsers.filter(user => user.role === 'brand_user');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Create Task</h2>
                <p className="text-blue-100 text-sm">Convert message to actionable task</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Source Message Preview */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MessageSquare className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-medium">
                    {sourceMessage.user.firstName.charAt(0)}{sourceMessage.user.lastName.charAt(0)}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {sourceMessage.user.firstName} {sourceMessage.user.lastName}
                </span>
                <span className="text-xs text-gray-500">
                  {formatMessageTime(sourceMessage.createdAt)}
                </span>
              </div>
              <p className="text-sm text-gray-700 bg-white rounded-lg px-3 py-2 border">
                {truncateMessage(sourceMessage.content)}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Task Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Task Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details about this task..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Priority and Category Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Flag className="inline h-4 w-4 mr-1" />
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.icon} {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Tag className="inline h-4 w-4 mr-1" />
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select category...</option>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assignment and Due Date Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Assign To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="inline h-4 w-4 mr-1" />
                Assign To
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Unassigned</option>
                {assignableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.role === 'super_admin' ? 'Admin' : '3PL'})
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                Due Date
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Brand Notification */}
          {brandUsers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Users className="inline h-4 w-4 mr-1" />
                Notify Brand User (when completed)
              </label>
              <select
                value={notifyBrandUserId}
                onChange={(e) => setNotifyBrandUserId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">No notification</option>
                {brandUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.email})
                  </option>
                ))}
              </select>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-500">
            <AlertCircle className="h-4 w-4 mr-1" />
            Task will be linked to the source message
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={!title.trim() || isSubmitting}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Create Task</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
