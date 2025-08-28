'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Users, Settings, Calendar } from 'lucide-react';
import { AuthenticatedLayout } from '../../components/layout/AuthenticatedLayout';
import { authService } from '../../lib/auth';
import { buildApiUrl } from '../../lib/api-config';

interface Brand {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    invitations: number;
  };
}

export default function BrandsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const userData = await authService.verifyToken();
        if (!userData) {
          router.push('/');
          return;
        }
        setUser(userData.user);
        await fetchBrands();
      } catch (error) {
        console.error('Auth initialization failed:', error);
        router.push('/');
      }
    };

    initializeAuth();
  }, [router]);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      const response = await fetch(buildApiUrl('brands'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch brands');
      }

      const data = await response.json();
      setBrands(data.brands || []);
    } catch (error) {
      console.error('Failed to fetch brands:', error);
      setError('Failed to load brands');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    authService.clearToken();
    router.push('/');
  };

  const handleCreateBrand = () => {
    router.push('/create-brand');
  };

  const handleEditBrand = (brandId: string) => {
    router.push(`/brands/${brandId}/edit`);
  };

  const handleManageUsers = (brandId: string) => {
    router.push(`/brands/${brandId}/users`);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthenticatedLayout user={user} onLogout={handleLogout}>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Brands</h1>
              <p className="mt-2 text-gray-600">
                Manage your brand clients and their integrations
              </p>
            </div>
            <button
              onClick={handleCreateBrand}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Brand
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading brands...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Brands Grid */}
        {!loading && !error && (
          <>
            {brands.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No brands</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by creating your first brand client.
                </p>
                <div className="mt-6">
                  <button
                    onClick={handleCreateBrand}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Brand
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {brands.map((brand) => (
                  <div
                    key={brand.id}
                    className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="p-6">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <Building2 className="h-8 w-8 text-blue-600" />
                        </div>
                        <div className="ml-4 flex-1">
                          <h3 className="text-lg font-medium text-gray-900 truncate">
                            {brand.name}
                          </h3>
                          <p className="text-sm text-gray-500">/{brand.slug}</p>
                        </div>
                      </div>
                      
                      <div className="mt-4 flex items-center text-sm text-gray-500">
                        <Calendar className="h-4 w-4 mr-1" />
                        Created {new Date(brand.createdAt).toLocaleDateString()}
                      </div>

                      {brand._count.invitations > 0 && (
                        <div className="mt-2 flex items-center text-sm text-orange-600">
                          <Users className="h-4 w-4 mr-1" />
                          {brand._count.invitations} pending invitation{brand._count.invitations !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-gray-50 px-6 py-3">
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleEditBrand(brand.id)}
                          className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Settings
                        </button>
                        <button
                          onClick={() => handleManageUsers(brand.id)}
                          className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Users className="h-4 w-4 mr-1" />
                          Users
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
