'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Search, 
  Filter, 
  Truck, 
  Calendar,
  Package,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Edit,
  RefreshCw
} from 'lucide-react';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { authService } from '@/lib/auth';

interface InboundShipment {
  id: string;
  externalId?: string;
  trackingNumber?: string;
  status: 'PENDING' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
  expectedDate?: string;
  receivedDate?: string;
  brandId: string;
  brandName?: string;
  warehouseId?: string;
  warehouseName?: string;
  totalItems: number;
  totalQuantity: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface InboundFilters {
  q: string;
  brandId: string;
  warehouseId: string;
  status: 'PENDING' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED' | '';
}

export default function InboundShipmentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState<InboundShipment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  
  const [filters, setFilters] = useState<InboundFilters>({
    q: '',
    brandId: '',
    warehouseId: '',
    status: ''
  });

  const handleLogout = () => {
    authService.logout();
    router.push('/');
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authResponse = await authService.verifyToken();
        if (!authResponse) {
          router.push('/');
          return;
        }

        setUser(authResponse.user);
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchInboundShipments();
      fetchBrands();
      // fetchWarehouses(); // TODO: Implement warehouses endpoint
    }
  }, [user, filters]);

  const fetchInboundShipments = async () => {
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams();
      
      if (filters.q) queryParams.append('q', filters.q);
      if (filters.brandId) queryParams.append('brandId', filters.brandId);
      if (filters.warehouseId) queryParams.append('warehouseId', filters.warehouseId);
      if (filters.status) queryParams.append('status', filters.status);

      const response = await fetch(`http://localhost:4000/api/inbound-shipments?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch inbound shipments');
      }

      const data = await response.json();
      setShipments(data.data || []);
    } catch (error) {
      console.error('Failed to fetch inbound shipments:', error);
      setError('Failed to load inbound shipments');
    }
  };

  const fetchBrands = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:4000/api/brands', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBrands(data.brands || []);
      }
    } catch (error) {
      console.error('Failed to fetch brands:', error);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:4000/api/warehouses', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWarehouses(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch warehouses:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'IN_TRANSIT':
        return <Truck className="h-4 w-4 text-blue-500" />;
      case 'RECEIVED':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'CANCELLED':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'IN_TRANSIT':
        return 'bg-blue-100 text-blue-800';
      case 'RECEIVED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading inbound shipments...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Inbound Shipments</h1>
            <p className="text-gray-600">Manage incoming inventory shipments</p>
          </div>
          <button
            onClick={() => router.push('/inbound-shipments/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center space-x-2 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New Shipment</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by tracking number..."
                  value={filters.q}
                  onChange={(e) => setFilters(prev => ({ ...prev, q: e.target.value }))}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {user?.role?.includes('THREEPL') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
                <select
                  value={filters.brandId}
                  onChange={(e) => setFilters(prev => ({ ...prev, brandId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Brands</option>
                  {brands.map(brand => (
                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Warehouse</label>
              <select
                value={filters.warehouseId}
                onChange={(e) => setFilters(prev => ({ ...prev, warehouseId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Warehouses</option>
                {warehouses.map(warehouse => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="RECEIVED">Received</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Shipments Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-400 text-red-700">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                {error}
              </div>
            </div>
          )}

          {!error && (
            <>
              {/* Table Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-700">
                  <div className="col-span-2">Tracking Number</div>
                  <div className="col-span-2">Brand</div>
                  <div className="col-span-2">Warehouse</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Items</div>
                  <div className="col-span-2">Expected Date</div>
                  <div className="col-span-2">Actions</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {shipments.map((shipment) => (
                  <div
                    key={shipment.id}
                    className="px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Tracking Number */}
                      <div className="col-span-2">
                        <div className="font-medium text-gray-900">
                          {shipment.trackingNumber || 'No tracking'}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {shipment.id.slice(0, 8)}...
                        </div>
                      </div>

                      {/* Brand */}
                      <div className="col-span-2">
                        <span className="text-sm text-gray-900">
                          {shipment.brandName || 'Unknown Brand'}
                        </span>
                      </div>

                      {/* Warehouse */}
                      <div className="col-span-2">
                        <span className="text-sm text-gray-900">
                          {shipment.warehouseName || 'No warehouse'}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="col-span-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(shipment.status)}`}>
                          {getStatusIcon(shipment.status)}
                          <span className="ml-1">{shipment.status}</span>
                        </span>
                      </div>

                      {/* Items */}
                      <div className="col-span-1">
                        <div className="text-sm text-gray-900">{shipment.totalItems}</div>
                        <div className="text-xs text-gray-500">{shipment.totalQuantity} units</div>
                      </div>

                      {/* Expected Date */}
                      <div className="col-span-2">
                        <div className="text-sm text-gray-900">
                          {shipment.expectedDate 
                            ? new Date(shipment.expectedDate).toLocaleDateString()
                            : 'Not set'
                          }
                        </div>
                        {shipment.receivedDate && (
                          <div className="text-xs text-green-600">
                            Received: {new Date(shipment.receivedDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="col-span-2">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => router.push(`/inbound-shipments/${shipment.id}`)}
                            className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                          >
                            <Eye className="h-4 w-4" />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => router.push(`/inbound-shipments/${shipment.id}/edit`)}
                            className="text-gray-600 hover:text-gray-900 flex items-center space-x-1"
                          >
                            <Edit className="h-4 w-4" />
                            <span>Edit</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Empty State */}
              {!loading && shipments.length === 0 && (
                <div className="p-12 text-center">
                  <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No inbound shipments</h3>
                  <p className="text-gray-600 mb-4">Get started by creating your first inbound shipment.</p>
                  <button
                    onClick={() => router.push('/inbound-shipments/new')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center space-x-2 mx-auto transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>New Shipment</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
