'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Filter, 
  Package2, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  ChevronDown,
  RefreshCw,
  EyeOff,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';

interface InventoryItem {
  id: string;
  sku: string;
  productName: string;
  onHand: number;
  available: number;
  incoming: number;
  warehouseId: string;
  lastTrackstarUpdateAt: string;
  updatedAt: string;
  brandId: string;
  brand?: {
    id: string;
    name: string;
    slug: string;
  };
  freshness: 'live' | 'recent' | 'stale';
}

interface InventoryFilters {
  q: string;
  brandId: string;
  warehouseId: string;
  stock: 'in' | 'low' | 'out' | '';
  incoming: boolean | null;
}

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  
  const [filters, setFilters] = useState<InventoryFilters>({
    q: '',
    brandId: '',
    warehouseId: '',
    stock: '',
    incoming: null,
  });

  const [searchDebounce, setSearchDebounce] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, q: searchDebounce }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchDebounce]);

  // Fetch inventory data
  const fetchInventory = async (reset = false) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.q) params.append('q', filters.q);
      if (filters.brandId) params.append('brandId', filters.brandId);
      if (filters.warehouseId) params.append('warehouseId', filters.warehouseId);
      if (filters.stock) params.append('stock', filters.stock);
      if (filters.incoming !== null) params.append('incoming', filters.incoming.toString());
      if (!reset && nextCursor) params.append('after', nextCursor);
      params.append('limit', '50');

      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:4000/api/inventory?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch inventory');
      }

      const data = await response.json();
      
      if (reset) {
        setItems(data.data);
      } else {
        setItems(prev => [...prev, ...data.data]);
      }
      
      setHasMore(data.pagination.hasMore);
      setNextCursor(data.pagination.nextCursor);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory');
    } finally {
      setLoading(false);
    }
  };

  // Fetch brands for filter
  const fetchBrands = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:4000/api/brands', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBrands(data.brands || []);
      }
    } catch (err) {
      console.error('Failed to fetch brands:', err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchBrands();
  }, []);

  // Reload when filters change
  useEffect(() => {
    fetchInventory(true);
  }, [filters.q, filters.brandId, filters.warehouseId, filters.stock, filters.incoming]);

  const getFreshnessColor = (freshness: string) => {
    switch (freshness) {
      case 'live': return 'bg-green-100 text-green-800';
      case 'recent': return 'bg-yellow-100 text-yellow-800';
      case 'stale': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStockStatusColor = (available: number, onHand: number) => {
    if (available <= 0) return 'text-red-600';
    if (available <= 10) return 'text-yellow-600';
    return 'text-green-600';
  };

  const handleItemClick = (item: InventoryItem) => {
    // TODO: Open product details drawer/modal
    console.log('View item details:', item);
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(itemId);
      } else {
        newSet.delete(itemId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(items.map(item => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleBulkHideProducts = async () => {
    if (selectedItems.size === 0) return;

    try {
      setBulkActionLoading(true);
      
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:4000/api/inventory/bulk-hide', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemIds: Array.from(selectedItems)
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to hide products');
      }

      // Remove hidden items from the current view
      setItems(prev => prev.filter(item => !selectedItems.has(item.id)));
      setSelectedItems(new Set());
      
      // Show success message
      alert(`Successfully hid ${selectedItems.size} products`);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to hide products');
    } finally {
      setBulkActionLoading(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package2 className="h-6 w-6" />
              Inventory
            </h1>
            <p className="text-gray-600">Track and manage stock levels across warehouses</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedItems.size > 0 && (
              <Button 
                onClick={handleBulkHideProducts}
                disabled={bulkActionLoading}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <EyeOff className={`h-4 w-4 ${bulkActionLoading ? 'animate-spin' : ''}`} />
                Hide {selectedItems.size} Products
              </Button>
            )}
            <Button 
              onClick={() => fetchInventory(true)}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by SKU or name..."
              value={searchDebounce}
              onChange={(e) => setSearchDebounce(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Brand Filter */}
          <Select
            value={filters.brandId}
            onValueChange={(value) => setFilters(prev => ({ ...prev, brandId: value }))}
          >
            <option value="">All Brands</option>
            {brands.map(brand => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </Select>

          {/* Stock Status Filter */}
          <Select
            value={filters.stock}
            onValueChange={(value) => setFilters(prev => ({ ...prev, stock: value as any }))}
          >
            <option value="">All Stock</option>
            <option value="in">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </Select>

          {/* Incoming Filter */}
          <Select
            value={filters.incoming === null ? '' : filters.incoming.toString()}
            onValueChange={(value) => setFilters(prev => ({ 
              ...prev, 
              incoming: value === '' ? null : value === 'true' 
            }))}
          >
            <option value="">All Items</option>
            <option value="true">Has Incoming</option>
            <option value="false">No Incoming</option>
          </Select>

          {/* Clear Filters */}
          <Button 
            variant="outline" 
            onClick={() => {
              setFilters({
                q: '',
                brandId: '',
                warehouseId: '',
                stock: '',
                incoming: null,
              });
              setSearchDebounce('');
            }}
          >
            Clear Filters
          </Button>
        </div>
      </Card>

      {/* Results */}
      <Card>
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
                <div className="col-span-1 flex items-center">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedItems.size === items.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-3">Product</div>
                <div className="col-span-2">On Hand</div>
                <div className="col-span-2">Available</div>
                <div className="col-span-1">Incoming</div>
                <div className="col-span-2">Updated</div>
                <div className="col-span-1">Brand</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-200">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="grid grid-cols-12 gap-4 items-center">
                    {/* Checkbox */}
                    <div className="col-span-1 flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectItem(item.id, e.target.checked);
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>

                    {/* Product */}
                    <div 
                      className="col-span-3 cursor-pointer"
                      onClick={() => handleItemClick(item)}
                    >
                      <div className="font-medium text-gray-900">{item.sku}</div>
                      <div className="text-sm text-gray-500 truncate">
                        {item.productName || 'No name'}
                      </div>
                    </div>

                    {/* On Hand */}
                    <div className="col-span-2">
                      <span className={`font-medium ${getStockStatusColor(item.available, item.onHand)}`}>
                        {item.onHand.toLocaleString()}
                      </span>
                    </div>

                    {/* Available */}
                    <div className="col-span-2">
                      <span className={`font-medium ${getStockStatusColor(item.available, item.onHand)}`}>
                        {item.available.toLocaleString()}
                      </span>
                    </div>

                    {/* Incoming */}
                    <div className="col-span-1">
                      <span className="text-gray-900">
                        {item.incoming > 0 ? item.incoming.toLocaleString() : '-'}
                      </span>
                    </div>

                    {/* Updated */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${getFreshnessColor(item.freshness)}`}>
                          {item.freshness}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {new Date(item.lastTrackstarUpdateAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Brand */}
                    <div className="col-span-1">
                      {item.brand && (
                        <span className="text-sm text-gray-900">{item.brand.name}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Loading State */}
            {loading && (
              <div className="p-8 text-center">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-gray-400" />
                <p className="text-gray-500">Loading inventory...</p>
              </div>
            )}

            {/* Empty State */}
            {!loading && items.length === 0 && (
              <div className="p-8 text-center">
                <Package2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No inventory found</h3>
                <p className="text-gray-500">Try adjusting your filters or refresh the data.</p>
              </div>
            )}

            {/* Load More */}
            {hasMore && !loading && (
              <div className="p-4 border-t border-gray-200 text-center">
                <Button 
                  variant="outline" 
                  onClick={() => fetchInventory(false)}
                  className="flex items-center gap-2"
                >
                  <ChevronDown className="h-4 w-4" />
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
      </div>
    </AuthenticatedLayout>
  );
}
