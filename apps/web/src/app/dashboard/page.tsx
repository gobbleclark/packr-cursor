'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '../../lib/auth';
import { Building2, Users, Package, MessageSquare, LogOut, TrendingUp, AlertTriangle, CheckCircle, Clock, Filter, Calendar } from 'lucide-react';
import { Select } from '../../components/ui/select';
import { AuthenticatedLayout } from '../../components/layout/AuthenticatedLayout';

interface DashboardStats {
  totalOrders: number;
  unfulfilledOrders: number;
  fulfilledOrders: number;
  lateOrders: number;
  totalBrands: number;
  ordersByBrand: Array<{
    brandId: string;
    brandName: string;
    totalOrders: number;
    unfulfilledOrders: number;
    fulfilledOrders: number;
    lateOrders: number;
  }>;
  lateOrdersByBrand: Array<{
    brandId: string;
    brandName: string;
    lateOrders: number;
  }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('30');
  const [brands, setBrands] = useState<Array<{id: string, name: string}>>([]);

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

  const fetchDashboardStats = async () => {
    try {
      setStatsLoading(true);
      const token = authService.getToken();
      
      // Build query parameters for filters
      const params = new URLSearchParams();
      if (selectedBrand !== 'all') {
        params.append('brandId', selectedBrand);
      }
      if (dateRange !== 'all') {
        const days = parseInt(dateRange);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        params.append('startDate', startDate.toISOString());
      }

      const url = `http://localhost:4000/api/dashboard/stats${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        console.error('Failed to fetch dashboard stats');
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authResponse = await authService.verifyToken();
        if (authResponse) {
          setUser(authResponse.user);
          // Fetch brands and dashboard stats after successful auth
          await fetchBrands();
          await fetchDashboardStats();
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

  // Refetch stats when filters change
  useEffect(() => {
    if (user) {
      fetchDashboardStats();
    }
  }, [selectedBrand, dateRange]);

  const handleLogout = () => {
    authService.clearToken();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
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
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to {user.companyName}
          </h2>
          <p className="text-gray-600">
            You're logged in as a {user.role.replace('_', ' ').toLowerCase()}
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <label htmlFor="brand-filter" className="text-sm text-gray-600">Brand:</label>
              <Select
                id="brand-filter"
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-48"
              >
                <option value="all">All Brands</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <label htmlFor="date-filter" className="text-sm text-gray-600">Date Range:</label>
              <Select
                id="date-filter"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-40"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
                <option value="all">All time</option>
              </Select>
            </div>

            {(selectedBrand !== 'all' || dateRange !== '30') && (
              <button
                onClick={() => {
                  setSelectedBrand('all');
                  setDateRange('30');
                }}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {statsLoading ? '...' : stats?.totalOrders || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <Clock className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Unfulfilled Orders</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {statsLoading ? '...' : stats?.unfulfilledOrders || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Fulfilled Orders</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {statsLoading ? '...' : stats?.fulfilledOrders || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Late Orders</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {statsLoading ? '...' : stats?.lateOrders || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Orders by Brand */}
        {stats && stats.ordersByBrand.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Orders by Brand</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Brand
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Orders
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unfulfilled
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fulfilled
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Late Orders
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.ordersByBrand.map((brand) => (
                    <tr key={brand.brandId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {brand.brandName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {brand.totalOrders}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        {brand.unfulfilledOrders}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                        {brand.fulfilledOrders}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                        {brand.lateOrders}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Late Orders Alert */}
        {stats && stats.lateOrders > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-8">
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 text-orange-600 mr-3" />
              <div>
                <h3 className="text-lg font-medium text-orange-900">
                  {stats.lateOrders} Late Orders Require Attention
                </h3>
                <p className="text-sm text-orange-700 mt-1">
                  These orders have passed their required ship date and need immediate action.
                </p>
              </div>
            </div>
            {stats.lateOrdersByBrand.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-orange-900 mb-2">Late Orders by Brand:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {stats.lateOrdersByBrand.map((brand) => (
                    <div key={brand.brandId} className="bg-white rounded-md p-3 border border-orange-200">
                      <p className="text-sm font-medium text-gray-900">{brand.brandName}</p>
                      <p className="text-sm text-orange-600">{brand.lateOrders} late orders</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button 
              onClick={() => window.location.href = '/create-brand'}
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
            >
              <div className="text-center">
                <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600">Create Brand</p>
              </div>
            </button>
            
            <button 
              onClick={() => window.location.href = '/manage-brands'}
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
            >
              <div className="text-center">
                <Building2 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600">Manage Brands</p>
              </div>
            </button>
            
            <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <div className="text-center">
                <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600">View Orders</p>
              </div>
            </button>
            
            <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <div className="text-center">
                <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600">Check Messages</p>
              </div>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No recent activity to display</p>
            <p className="text-sm text-gray-400">Your activity will appear here as you use the platform</p>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
