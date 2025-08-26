'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Clock, 
  MessageCircle, 
  Send,
  CheckSquare,
  Flag,
  Tag
} from 'lucide-react';
import { useTaskComments, useAddTaskComment, useUpdateTaskStatus } from '../../../../hooks/useChat';
import { chatAPI } from '../../../../lib/chat-api';
import { authService } from '../../../../lib/auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      retry: 2,
    },
  },
});

function TaskDetailContent() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;
  
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch task details
  const { data: task, isLoading: taskLoading } = useQuery({
    queryKey: ['chat', 'task', taskId],
    queryFn: async () => {
      const response = await chatAPI.getTask(taskId);
      return response.task;
    },
    enabled: !!taskId,
  });

  const { data: comments = [], isLoading: commentsLoading } = useTaskComments(taskId);
  const addComment = useAddTaskComment();
  const updateTaskStatus = useUpdateTaskStatus();

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addComment.mutateAsync({
        taskId,
        content: newComment.trim()
      });
      setNewComment('');
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateTaskStatus.mutateAsync({
        taskId,
        status: newStatus
      });
    } catch (error) {
      console.error('Failed to update task status:', error);
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
      case 'LOW': return 'text-gray-500 bg-gray-50';
      case 'NORMAL': return 'text-blue-500 bg-blue-50';
      case 'HIGH': return 'text-orange-500 bg-orange-50';
      case 'URGENT': return 'text-red-500 bg-red-50';
      default: return 'text-gray-500 bg-gray-50';
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (taskLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading task...</p>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Task not found</p>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-800"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Back to Chat</span>
            </button>
            <div className="h-4 w-px bg-gray-300"></div>
            <h1 className="text-lg font-semibold text-gray-900">Task Details</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Task Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Task Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex-1">
                  {task.title}
                </h2>
                <span className={`text-sm px-3 py-1 rounded-full ${getStatusColor(task.status)}`}>
                  {getStatusLabel(task.status)}
                </span>
              </div>

              {task.description && (
                <p className="text-gray-700 mb-4 whitespace-pre-wrap">
                  {task.description}
                </p>
              )}

              {/* Task Meta */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <span>Created by {task.createdBy?.firstName} {task.createdBy?.lastName}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>Created {formatDateTime(task.createdAt)}</span>
                </div>
                {task.assignee && (
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>Assigned to {task.assignee.firstName} {task.assignee.lastName}</span>
                  </div>
                )}
                {task.dueDate && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>Due {formatDateTime(task.dueDate)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Comments Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <MessageCircle className="h-5 w-5 text-gray-500" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Comments ({comments.length})
                  </h3>
                </div>
              </div>

              {/* Comments List */}
              <div className="divide-y divide-gray-200">
                {commentsLoading ? (
                  <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Loading comments...</p>
                  </div>
                ) : comments.length > 0 ? (
                  comments.map((comment: any) => (
                    <div key={comment.id} className="p-6">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {comment.user.firstName.charAt(0)}{comment.user.lastName.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {comment.user.firstName} {comment.user.lastName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDateTime(comment.createdAt)}
                            </span>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap">
                            {comment.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-gray-500">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p>No comments yet. Start the conversation!</p>
                  </div>
                )}
              </div>

              {/* Add Comment Form */}
              <div className="p-6 border-t border-gray-200">
                <form onSubmit={handleSubmitComment} className="space-y-4">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!newComment.trim() || isSubmitting}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="h-4 w-4" />
                      <span>{isSubmitting ? 'Posting...' : 'Post Comment'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Actions</h3>
              <div className="space-y-2">
                {task.status !== 'COMPLETED' && (
                  <button
                    onClick={() => handleStatusChange('COMPLETED')}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span>Mark Complete</span>
                  </button>
                )}
                {task.status === 'COMPLETED' && (
                  <button
                    onClick={() => handleStatusChange('TODO')}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span>Mark Incomplete</span>
                  </button>
                )}
                {task.status !== 'IN_PROGRESS' && task.status !== 'COMPLETED' && (
                  <button
                    onClick={() => handleStatusChange('IN_PROGRESS')}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Clock className="h-4 w-4" />
                    <span>Start Progress</span>
                  </button>
                )}
              </div>
            </div>

            {/* Task Properties */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Properties</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Priority</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                </div>
                {task.category && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Category</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                      {task.category}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Comments</span>
                  <span className="text-sm font-medium text-gray-900">
                    {comments.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TaskDetailPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authResponse = await authService.verifyToken();
        if (authResponse) {
          setUser(authResponse.user);
        } else {
          router.push('/');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TaskDetailContent />
    </QueryClientProvider>
  );
}
