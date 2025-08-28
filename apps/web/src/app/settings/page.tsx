'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthenticatedLayout } from '../../components/layout/AuthenticatedLayout';
import { authService } from '../../lib/auth';
import { 
  Settings, 
  Plus, 
  Edit,
  Trash2,
  Save,
  MessageSquare,
  Palette,
  Bell,
  Shield,
  Building2,
  Info,
  Users,
  Package,
  ShoppingCart,
  Zap
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { NotificationSettings } from '../../components/settings/NotificationSettings';

interface MessageStatus {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
}

interface SystemStats {
  users: number;
  brands: number;
  messages: number;
  orders: number;
  integrations: number;
}

interface ThreePLSettings {
  general: {
    name: string;
    slug: string;
    settings: any;
  };
  messaging: {
    statuses: MessageStatus[];
  };
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [settings, setSettings] = useState<ThreePLSettings | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editingStatus, setEditingStatus] = useState<MessageStatus | null>(null);
  const [statusForm, setStatusForm] = useState({
    name: '',
    color: '#3B82F6',
    isDefault: false,
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authResponse = await authService.verifyToken();
        if (authResponse) {
          setUser(authResponse.user);
          // Allow both 3PL and Brand users to access settings
          if (!['THREEPL_ADMIN', 'THREEPL_USER', 'BRAND_ADMIN', 'BRAND_USER'].includes(authResponse.user.role)) {
            router.push('/dashboard');
            return;
          }
          await Promise.all([
            fetchSettings(),
            fetchSystemStats(),
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

  const fetchSettings = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch('http://localhost:4000/api/settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchSystemStats = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch('http://localhost:4000/api/settings/system', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSystemStats(data.system.stats);
      }
    } catch (error) {
      console.error('Error fetching system stats:', error);
    }
  };

  const handleCreateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = authService.getToken();
      const response = await fetch('http://localhost:4000/api/settings/message-statuses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(statusForm)
      });

      if (response.ok) {
        setShowStatusModal(false);
        setStatusForm({ name: '', color: '#3B82F6', isDefault: false });
        await fetchSettings();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create status');
      }
    } catch (error) {
      console.error('Error creating status:', error);
      alert('Failed to create status');
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStatus) return;

    try {
      const token = authService.getToken();
      const response = await fetch(`http://localhost:4000/api/settings/message-statuses/${editingStatus.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(statusForm)
      });

      if (response.ok) {
        setShowStatusModal(false);
        setEditingStatus(null);
        setStatusForm({ name: '', color: '#3B82F6', isDefault: false });
        await fetchSettings();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    if (!confirm('Are you sure you want to delete this status?')) return;

    try {
      const token = authService.getToken();
      const response = await fetch(`http://localhost:4000/api/settings/message-statuses/${statusId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchSettings();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete status');
      }
    } catch (error) {
      console.error('Error deleting status:', error);
      alert('Failed to delete status');
    }
  };

  const handleInitializeStatuses = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch('http://localhost:4000/api/settings/message-statuses/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchSettings();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to initialize statuses');
      }
    } catch (error) {
      console.error('Error initializing statuses:', error);
      alert('Failed to initialize statuses');
    }
  };

  const openEditModal = (status: MessageStatus) => {
    setEditingStatus(status);
    setStatusForm({
      name: status.name,
      color: status.color,
      isDefault: status.isDefault,
    });
    setShowStatusModal(true);
  };

  const openCreateModal = () => {
    setEditingStatus(null);
    setStatusForm({ name: '', color: '#3B82F6', isDefault: false });
    setShowStatusModal(true);
  };

  const handleLogout = () => {
    authService.clearToken();
    router.push('/');
  };

  // Filter tabs based on user role
  const allTabs = [
    { id: 'general', name: 'General', icon: Building2, roles: ['SUPER_ADMIN', 'THREEPL_ADMIN', 'THREEPL_USER', 'BRAND_ADMIN', 'BRAND_USER'] },
    { id: 'messaging', name: 'Messaging', icon: MessageSquare, roles: ['SUPER_ADMIN', 'THREEPL_ADMIN', 'THREEPL_USER'] },
    { id: 'notifications', name: 'Notifications', icon: Bell, roles: ['SUPER_ADMIN', 'THREEPL_ADMIN', 'THREEPL_USER', 'BRAND_ADMIN', 'BRAND_USER'] },
    { id: 'system', name: 'System Info', icon: Info, roles: ['SUPER_ADMIN', 'THREEPL_ADMIN', 'THREEPL_USER'] },
  ];

  const tabs = allTabs.filter(tab => 
    user?.role ? tab.roles.includes(user.role) : false
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!user || !settings) {
    return null;
  }

  return (
    <AuthenticatedLayout user={user} onLogout={handleLogout}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600">
              {user?.role?.includes('BRAND') 
                ? 'Manage your profile and notification preferences' 
                : 'Manage your 3PL configuration and preferences'
              }
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64">
            <Card>
              <CardContent className="p-0">
                <nav className="space-y-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                        activeTab === tab.id ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600' : 'text-gray-700'
                      }`}
                    >
                      <tab.icon className="h-5 w-5 mr-3" />
                      {tab.name}
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {activeTab === 'general' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building2 className="h-5 w-5 mr-2" />
                    {user?.role?.includes('BRAND') ? 'Profile Information' : 'General Settings'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {user?.role?.includes('BRAND') ? (
                    // Brand user profile view
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                        <input
                          type="text"
                          value={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                          readOnly
                        />
                        <p className="text-xs text-gray-500 mt-1">Contact your 3PL administrator to update your profile</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input
                          type="email"
                          value={user?.email || ''}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                          readOnly
                        />
                        <p className="text-xs text-gray-500 mt-1">Your login email address</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                        <input
                          type="text"
                          value={user?.role?.replace('_', ' ').toLowerCase() || ''}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                          readOnly
                        />
                        <p className="text-xs text-gray-500 mt-1">Your access level in the system</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                        <input
                          type="text"
                          value={user?.companyName || settings.general.name}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                          readOnly
                        />
                        <p className="text-xs text-gray-500 mt-1">Your brand organization</p>
                      </div>
                    </>
                  ) : (
                    // 3PL user general settings view
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                        <input
                          type="text"
                          value={settings.general.name}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          readOnly
                        />
                        <p className="text-xs text-gray-500 mt-1">Contact support to change your company name</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Company Slug</label>
                        <input
                          type="text"
                          value={settings.general.slug}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                          readOnly
                        />
                        <p className="text-xs text-gray-500 mt-1">Used in URLs and API endpoints</p>
                      </div>

                      <div className="pt-4">
                        <Button disabled>
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </Button>
                        <p className="text-xs text-gray-500 mt-2">General settings are managed by system administrators</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === 'messaging' && (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center">
                      <MessageSquare className="h-5 w-5 mr-2" />
                      Message Statuses
                    </CardTitle>
                    <div className="flex space-x-2">
                      {settings.messaging.statuses.length === 0 && (
                        <Button variant="outline" onClick={handleInitializeStatuses}>
                          Initialize Default Statuses
                        </Button>
                      )}
                      <Button onClick={openCreateModal}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Status
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {settings.messaging.statuses.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No message statuses</h3>
                      <p className="text-gray-600 mb-6">Create custom statuses for your message workflow.</p>
                      <Button onClick={handleInitializeStatuses}>
                        Initialize Default Statuses
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {settings.messaging.statuses.map((status) => (
                        <div key={status.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: status.color }}
                            />
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-gray-900">{status.name}</span>
                                {status.isDefault && (
                                  <Badge className="bg-blue-100 text-blue-800">Default</Badge>
                                )}
                              </div>
                              <span className="text-sm text-gray-500">{status.color}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditModal(status)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteStatus(status.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <NotificationSettings />
              </div>
            )}

            {activeTab === 'system' && (
              <div className="space-y-6">
                {/* System Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Info className="h-5 w-5 mr-2" />
                      System Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {systemStats && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Users className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Users</p>
                            <p className="text-2xl font-semibold text-gray-900">{systemStats.users}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <Building2 className="h-6 w-6 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Brands</p>
                            <p className="text-2xl font-semibold text-gray-900">{systemStats.brands}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <MessageSquare className="h-6 w-6 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Messages</p>
                            <p className="text-2xl font-semibold text-gray-900">{systemStats.messages}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-orange-100 rounded-lg">
                            <ShoppingCart className="h-6 w-6 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Orders</p>
                            <p className="text-2xl font-semibold text-gray-900">{systemStats.orders}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-yellow-100 rounded-lg">
                            <Zap className="h-6 w-6 text-yellow-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Integrations</p>
                            <p className="text-2xl font-semibold text-gray-900">{systemStats.integrations}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* System Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>System Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Version</span>
                        <span className="font-medium">1.0.0</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Environment</span>
                        <Badge className="bg-green-100 text-green-800">Development</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Company</span>
                        <span className="font-medium">{settings.general.name}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Status Modal */}
        {showStatusModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {editingStatus ? 'Edit Status' : 'Create Status'}
                </h2>
                <p className="text-gray-600">
                  {editingStatus ? 'Update the message status' : 'Add a new message status'}
                </p>
              </div>

              <form onSubmit={editingStatus ? handleUpdateStatus : handleCreateStatus} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={statusForm.name}
                    onChange={(e) => setStatusForm({...statusForm, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      className="h-10 w-16 border border-gray-300 rounded-md"
                      value={statusForm.color}
                      onChange={(e) => setStatusForm({...statusForm, color: e.target.value})}
                    />
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={statusForm.color}
                      onChange={(e) => setStatusForm({...statusForm, color: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={statusForm.isDefault}
                      onChange={(e) => setStatusForm({...statusForm, isDefault: e.target.checked})}
                    />
                    <span className="text-sm font-medium text-gray-700">Set as default status</span>
                  </label>
                </div>

                <div className="flex space-x-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowStatusModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1">
                    {editingStatus ? 'Update Status' : 'Create Status'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
