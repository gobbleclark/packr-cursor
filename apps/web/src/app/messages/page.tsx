'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthenticatedLayout } from '../../components/layout/AuthenticatedLayout';
import { authService } from '../../lib/auth';
import { 
  MessageSquare, 
  Plus, 
  Search, 
  Filter, 
  AlertTriangle,
  Clock,
  CheckCircle,
  User,
  Calendar,
  MessageCircle,
  Paperclip,
  ArrowRight
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Select } from '../../components/ui/select';

interface Message {
  id: string;
  title: string;
  body: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  isUrgent: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  status?: {
    id: string;
    name: string;
    color: string;
  };
  brand?: {
    id: string;
    name: string;
  };
  _count: {
    comments: number;
    attachments: number;
  };
}

interface MessageStats {
  totalMessages: number;
  urgentMessages: number;
  uncompletedMessages: number;
  completedToday: number;
}

export default function MessagesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    brandId: '',
    status: '',
    priority: '',
    assignedTo: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authResponse = await authService.verifyToken();
        if (authResponse) {
          setUser(authResponse.user);
          await Promise.all([
            fetchMessages(),
            fetchStats(),
            fetchBrands(),
            fetchStatuses(),
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
  }, [router]);

  const fetchMessages = async () => {
    try {
      const token = authService.getToken();
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
      });

      const response = await fetch(`http://localhost:4000/api/messages?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch('http://localhost:4000/api/messages/stats/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchBrands = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch('http://localhost:4000/api/brands', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBrands(data.brands || []);
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
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

  const handleLogout = () => {
    authService.clearToken();
    router.push('/');
  };

  const getPriorityColor = (priority: string, isUrgent: boolean) => {
    if (isUrgent) return 'bg-red-100 text-red-800';
    switch (priority) {
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'NORMAL': return 'bg-blue-100 text-blue-800';
      case 'LOW': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AuthenticatedLayout user={user} onLogout={handleLogout}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
            <p className="text-gray-600">Manage communications with your team and brands</p>
          </div>
          <Button onClick={() => router.push('/messages/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Message
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <MessageSquare className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Messages</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.totalMessages}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Urgent Messages</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.urgentMessages}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Clock className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Open Messages</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.uncompletedMessages}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Completed Today</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.completedToday}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search messages..."
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                <Select
                  value={filters.brandId}
                  onChange={(e) => setFilters({...filters, brandId: e.target.value})}
                >
                  <option value="">All Brands</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <Select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                >
                  <option value="">All Statuses</option>
                  {statuses.map((status) => (
                    <option key={status.id} value={status.id}>{status.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <Select
                  value={filters.priority}
                  onChange={(e) => setFilters({...filters, priority: e.target.value})}
                >
                  <option value="">All Priorities</option>
                  <option value="URGENT">Urgent</option>
                  <option value="HIGH">High</option>
                  <option value="NORMAL">Normal</option>
                  <option value="LOW">Low</option>
                </Select>
              </div>

              <div className="flex items-end">
                <Button onClick={fetchMessages} className="w-full">
                  <Filter className="h-4 w-4 mr-2" />
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Messages List */}
        <div className="space-y-4">
          {messages.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No messages found</h3>
                <p className="text-gray-600 mb-6">Get started by creating your first message.</p>
                <Button onClick={() => router.push('/messages/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Message
                </Button>
              </CardContent>
            </Card>
          ) : (
            messages.map((message) => (
              <Card key={message.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{message.title}</h3>
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(message.priority, message.isUrgent)}`}>
                          {getPriorityIcon(message.priority, message.isUrgent)}
                          <span className="ml-1">
                            {message.isUrgent ? 'URGENT' : message.priority}
                          </span>
                        </div>
                        {message.status && (
                          <Badge className="bg-blue-100 text-blue-800">
                            {message.status.name}
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-gray-600 mb-3 line-clamp-2">{message.body}</p>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          {new Date(message.createdAt).toLocaleDateString()}
                        </div>
                        {message.brand && (
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-1" />
                            {message.brand.name}
                          </div>
                        )}
                        {message._count.comments > 0 && (
                          <div className="flex items-center">
                            <MessageCircle className="h-4 w-4 mr-1" />
                            {message._count.comments} comments
                          </div>
                        )}
                        {message._count.attachments > 0 && (
                          <div className="flex items-center">
                            <Paperclip className="h-4 w-4 mr-1" />
                            {message._count.attachments} attachments
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {message.completedAt && (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/messages/${message.id}`)}
                      >
                        View
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex justify-center items-center space-x-4 mt-8">
            <Button
              variant="outline"
              disabled={pagination.page === 1}
              onClick={() => setPagination({...pagination, page: pagination.page - 1})}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.pages}
            </span>
            <Button
              variant="outline"
              disabled={pagination.page === pagination.pages}
              onClick={() => setPagination({...pagination, page: pagination.page + 1})}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
