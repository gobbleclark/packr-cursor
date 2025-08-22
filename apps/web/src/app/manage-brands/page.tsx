'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Edit, Users, Plus, ArrowLeft, Trash2, Eye, Settings } from 'lucide-react';

interface Brand {
  id: string;
  name: string;
  slug: string;
  integrationType?: string;
  createdAt: string;
  _count?: {
    invitations: number;
  };
}

export default function ManageBrandsPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const response = await fetch('http://localhost:4000/api/brands', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch brands');
      }

      const data = await response.json();
      setBrands(data.brands || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch brands');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBrand = () => {
    router.push('/create-brand');
  };

  const handleViewBrand = (brandId: string) => {
    router.push(`/brands/${brandId}`);
  };

  const handleEditBrand = (brandId: string) => {
    router.push(`/brands/${brandId}/edit`);
  };

  const handleManageUsers = (brandId: string) => {
    router.push(`/brands/${brandId}/users`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading brands...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <Building2 className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Manage Brands</h1>
            </div>
            <button
              onClick={handleCreateBrand}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              <span>Create Brand</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {brands.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No brands yet</h3>
            <p className="text-gray-600 mb-6">Get started by creating your first brand</p>
            <button
              onClick={handleCreateBrand}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              <span>Create Your First Brand</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brands.map((brand) => (
              <div key={brand.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 mb-1">{brand.name}</h3>
                      <p className="text-sm text-gray-500">packr.co/{brand.slug}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleViewBrand(brand.id)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="View brand details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleEditBrand(brand.id)}
                        className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                        title="Edit brand"
                      >
                        <Edit size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    {brand.integrationType && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Settings size={14} className="mr-2" />
                        <span className="capitalize">{brand.integrationType}</span>
                      </div>
                    )}
                    <div className="flex items-center text-sm text-gray-600">
                      <Building2 size={14} className="mr-2" />
                      <span>Created {formatDate(brand.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <button
                      onClick={() => handleManageUsers(brand.id)}
                      className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <Users size={14} />
                      <span>Manage Users</span>
                    </button>
                    <span className="text-xs text-gray-400">
                      {brand._count?.invitations || 0} invitations
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
