'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AuthenticatedLayout } from '../../../components/layout/AuthenticatedLayout';
import { authService } from '../../../lib/auth';
import { 
  ArrowLeft, 
  MessageSquare, 
  User, 
  Calendar, 
  AlertTriangle,
  Clock,
  CheckCircle,
  Paperclip,
  Send,
  Edit,
  Trash2,
  Flag,
  UserPlus,
  Package,
  Truck,
  ShoppingCart,
  MoreVertical,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Select } from '../../../components/ui/select';
import { RichTextEditor } from '../../../components/messages/RichTextEditor';

interface Message {
  id: string;
  title: string;
  body: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  isUrgent: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  completedBy?: string;
  assignedTo?: string;
  orderId?: string;
  shipmentId?: string;
  productId?: string;
  status?: {
    id: string;
    name: string;
    color: string;
  };
  brand?: {
    id: string;
    name: string;
  };
  comments: Comment[];
  mentions: Mention[];
  attachments: Attachment[];
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface Mention {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  mimeType?: string;
  createdAt: string;
}

export default function MessageDetailPage() {
  const router = useRouter();
  const params = useParams();
  const messageId = params.messageId as string;
  
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showActions, setShowActions] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authResponse = await authService.verifyToken();
        if (authResponse) {
          setUser(authResponse.user);
          await Promise.all([
            fetchMessage(),
            fetchStatuses(),
            fetchUsers(),
          ]);
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
  }, [router, messageId]);

  const fetchMessage = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`http://localhost:4000/api/messages/${messageId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessage(data.message);
      } else if (response.status === 404) {
        router.push('/messages');
      }
    } catch (error) {
      console.error('Error fetching message:', error);
      router.push('/messages');
    }
  };

  const fetchStatuses = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch('http://localhost:4000/api/messages/statuses/list', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStatuses(data.statuses || []);
      }
    } catch (error) {
      console.error('Error fetching statuses:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch('http://localhost:4000/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    
    try {
      const token = authService.getToken();
      const response = await fetch(`http://localhost:4000/api/messages/${messageId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: newComment.trim()
        })
      });

      if (response.ok) {
        setNewComment('');
        await fetchMessage(); // Refresh to get new comment
      } else {
        const errorData = await response.json();
        alert(`Failed to add comment: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
      alert('Failed to add comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleStatusUpdate = async (statusId: string) => {
    try {
      const token = authService.getToken();
      const response = await fetch(`http://localhost:4000/api/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ statusId })
      });

      if (response.ok) {
        await fetchMessage();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleAssignmentUpdate = async (assignedTo: string) => {
    try {
      const token = authService.getToken();
      const response = await fetch(`http://localhost:4000/api/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ assignedTo })
      });

      if (response.ok) {
        await fetchMessage();
      }
    } catch (error) {
      console.error('Failed to update assignment:', error);
    }
  };

  const handleComplete = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`http://localhost:4000/api/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          completedAt: new Date().toISOString()
        })
      });

      if (response.ok) {
        await fetchMessage();
      }
    } catch (error) {
      console.error('Failed to complete message:', error);
    }
  };

  const handleLogout = () => {
    authService.clearToken();
    router.push('/');
  };

  const handleEdit = () => {
    router.push(`/messages/${messageId}/edit`);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this message? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const token = authService.getToken();
      const response = await fetch(`http://localhost:4000/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        router.push('/messages');
      } else {
        const errorData = await response.json();
        alert(`Failed to delete message: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const getPriorityColor = (priority: string, isUrgent: boolean) => {
    if (isUrgent) return 'bg-red-100 text-red-800 border-red-200';
    switch (priority) {
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'NORMAL': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'LOW': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityIcon = (priority: string, isUrgent: boolean) => {
    if (isUrgent) return <AlertTriangle className="h-4 w-4" />;
    switch (priority) {
      case 'HIGH': return <Clock className="h-4 w-4" />;
      case 'NORMAL': return <MessageSquare className="h-4 w-4" />;
      case 'LOW': return <MessageSquare className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading message...</p>
        </div>
      </div>
    );
  }

  if (!user || !message) {
    return null;
  }

  return (
    <AuthenticatedLayout user={user} onLogout={handleLogout}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button
              onClick={() => router.push('/messages')}
              className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{message.title}</h1>
              <p className="text-gray-600">Message Details</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {!message.completedAt && (
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            )}
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => setShowActions(!showActions)}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
              {showActions && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                  <div className="py-1">
                    <button 
                      onClick={handleEdit}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                    >
                      <Edit className="h-4 w-4 inline mr-2" />
                      Edit Message
                    </button>
                    <button 
                      onClick={handleDelete}
                      disabled={deleting}
                      className="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 w-full text-left disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4 inline mr-2" />
                      {deleting ? 'Deleting...' : 'Delete Message'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Message Content */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getPriorityColor(message.priority, message.isUrgent)}`}>
                      {getPriorityIcon(message.priority, message.isUrgent)}
                      <span className="ml-1">
                        {message.isUrgent ? 'URGENT' : message.priority}
                      </span>
                    </div>
                    {message.status && (
                      <Badge style={{ backgroundColor: message.status.color }} className="text-white">
                        {message.status.name}
                      </Badge>
                    )}
                    {message.completedAt && (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Completed
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(message.createdAt).toLocaleString()}
                  </div>
                </div>
                
                <div className="prose max-w-none">
                  <div className="text-gray-900" dangerouslySetInnerHTML={{ __html: message.body }} />
                </div>

                {/* Mentions */}
                {message.mentions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Mentioned Users</h4>
                    <div className="flex flex-wrap gap-2">
                      {message.mentions.map((mention) => (
                        <Badge key={mention.id} variant="outline" className="bg-blue-50">
                          <User className="h-3 w-3 mr-1" />
                          {mention.user.firstName} {mention.user.lastName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attachments */}
                {message.attachments.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Attachments</h4>
                    <div className="space-y-2">
                      {message.attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Paperclip className="h-4 w-4 text-gray-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{attachment.filename}</p>
                              <p className="text-xs text-gray-500">{formatFileSize(attachment.size)}</p>
                            </div>
                          </div>
                          <a 
                            href={attachment.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border border-gray-300 bg-transparent hover:bg-gray-50 text-gray-700 h-8 px-3 text-sm"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Comments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Comments ({message.comments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {/* Comment List */}
                <div className="space-y-4 mb-6">
                  {message.comments.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No comments yet. Be the first to comment!</p>
                  ) : (
                    message.comments.map((comment) => (
                      <div key={comment.id} className="flex space-x-3">
                        <div className="flex-shrink-0">
                          <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {comment.user.firstName} {comment.user.lastName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(comment.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-sm text-gray-700 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: comment.content }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment Form */}
                <form onSubmit={handleAddComment} className="border-t border-gray-200 pt-4">
                  <div className="flex space-x-3">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-gray-600" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <RichTextEditor
                        value={newComment}
                        onChange={setNewComment}
                        placeholder="Add a comment..."
                        minHeight="120px"
                        className="mb-2"
                      />
                      <div className="flex justify-end">
                        <Button 
                          type="submit" 
                          disabled={submittingComment || !newComment.trim()}
                          size="sm"
                        >
                          {submittingComment ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Posting...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Post Comment
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Message Info */}
            <Card>
              <CardHeader>
                <CardTitle>Message Details</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <Select
                    value={message.status?.id || ''}
                    onChange={(e) => handleStatusUpdate(e.target.value)}
                  >
                    <option value="">No Status</option>
                    {statuses.map((status) => (
                      <option key={status.id} value={status.id}>{status.name}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                  <Select
                    value={message.assignedTo || ''}
                    onChange={(e) => handleAssignmentUpdate(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName}
                      </option>
                    ))}
                  </Select>
                </div>

                {message.brand && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-900">{message.brand.name}</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-900">
                      {new Date(message.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {message.completedAt && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Completed</label>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-gray-900">
                        {new Date(message.completedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Integration Links */}
            {(message.orderId || message.shipmentId || message.productId) && (
              <Card>
                <CardHeader>
                  <CardTitle>Related Items</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  {message.orderId && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <ShoppingCart className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-700">Order</span>
                      </div>
                      <Button variant="outline" size="sm">
                        View Order
                      </Button>
                    </div>
                  )}
                  {message.shipmentId && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Truck className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-700">Shipment</span>
                      </div>
                      <Button variant="outline" size="sm">
                        View Shipment
                      </Button>
                    </div>
                  )}
                  {message.productId && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-700">Product</span>
                      </div>
                      <Button variant="outline" size="sm">
                        View Product
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
