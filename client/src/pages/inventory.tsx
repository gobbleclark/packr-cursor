import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Search, Filter, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import SyncMonitor from "@/components/sync-monitor";

export default function Inventory() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: products = [], isLoading: productsLoading } = useQuery<any[]>({
    queryKey: ['/api/products'],
    enabled: isAuthenticated,
    refetchInterval: 60000, // Refetch every minute
  });

  const { data: brands = [] } = useQuery<any[]>({
    queryKey: ['/api/brands'],
    enabled: isAuthenticated && user?.role === 'threePL',
  });

  const { data: warehouses = [] } = useQuery<any[]>({
    queryKey: ['/api/warehouses'],
    enabled: isAuthenticated,
  });

  // Filter products based on search term, brand, stock level, and warehouse
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBrand = brandFilter === 'all' || product.brandId === brandFilter;
    
    const matchesStock = stockFilter === 'all' ||
                        (stockFilter === 'low' && (product.inventory_count || product.quantity || 0) < 10) ||
                        (stockFilter === 'out' && (product.inventory_count || product.quantity || 0) === 0) ||
                        (stockFilter === 'in-stock' && (product.inventory_count || product.quantity || 0) > 0);
    
    const matchesWarehouse = warehouseFilter === 'all' || 
                            (product.warehouses && product.warehouses.some(w => w.warehouseId === warehouseFilter));
    
    return matchesSearch && matchesBrand && matchesStock && matchesWarehouse;
  });

  const getStockBadge = (quantity: number) => {
    if (quantity === 0) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Out of Stock
      </Badge>;
    } else if (quantity < 10) {
      return <Badge variant="secondary" className="flex items-center gap-1">
        <TrendingDown className="h-3 w-3" />
        Low Stock
      </Badge>;
    } else {
      return <Badge variant="default" className="flex items-center gap-1">
        <TrendingUp className="h-3 w-3" />
        In Stock
      </Badge>;
    }
  };

  const getBrandName = (brandId: string) => {
    const brand = brands.find(b => b.id === brandId);
    return brand?.name || 'Unknown Brand';
  };

  if (isLoading || productsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-8 w-8 text-primary-600" />
            <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          </div>
          <p className="text-gray-600">
            {user?.role === 'threePL' 
              ? 'Monitor inventory levels across all your brand clients' 
              : 'View your product inventory and stock levels'
            }
          </p>
        </div>

        {/* Sync Progress Card */}
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">Warehouse Sync Progress</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-blue-600">
                    {products.filter(p => p.warehouses && p.warehouses.length > 0).length} of {products.length} products have warehouse data
                  </p>
                  <SyncMonitor 
                    totalProducts={products.length}
                    syncedProducts={products.filter(p => p.warehouses && p.warehouses.length > 0).length}
                    onSyncComplete={() => {
                      // Refresh data when sync is complete
                      window.location.reload();
                    }}
                  />
                </div>
                <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${products.length > 0 ? (products.filter(p => p.warehouses && p.warehouses.length > 0).length / products.length) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Products</p>
                  <p className="text-2xl font-bold text-gray-900">{filteredProducts.length}</p>
                </div>
                <Package className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">In Stock</p>
                  <p className="text-2xl font-bold text-green-600">
                    {filteredProducts.filter(p => (p.inventory_count || p.quantity || 0) > 0).length}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Low Stock</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {filteredProducts.filter(p => {
                      const qty = p.inventory_count || p.quantity || 0;
                      return qty > 0 && qty < (p.lowStockThreshold || 10);
                    }).length}
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                  <p className="text-2xl font-bold text-red-600">
                    {filteredProducts.filter(p => (p.inventory_count || p.quantity || 0) === 0).length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by product name or SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {user?.role === 'threePL' && (
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by brand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Brands</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stock Levels</SelectItem>
                  <SelectItem value="in-stock">In Stock</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="out">Out of Stock</SelectItem>
                </SelectContent>
              </Select>

              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.warehouseId} value={warehouse.warehouseId}>
                      {warehouse.warehouseName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Product Inventory ({filteredProducts.length} items)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>SKU</TableHead>
                    {user?.role === 'threePL' && <TableHead>Brand</TableHead>}
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Stock Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={user?.role === 'threePL' ? 8 : 7} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <Package className="h-12 w-12 text-gray-400" />
                          <p className="text-gray-500">No products found matching your filters</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            {product.description && (
                              <p className="text-sm text-gray-500 truncate max-w-xs">
                                {product.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                            {product.sku}
                          </code>
                        </TableCell>
                        {user?.role === 'threePL' && (
                          <TableCell>
                            <span className="text-sm font-medium">
                              {getBrandName(product.brandId)}
                            </span>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="space-y-1">
                            {product.warehouses && product.warehouses.length > 0 ? (
                              product.warehouses.map((warehouse, index) => (
                                <div key={index} className="text-sm">
                                  <Badge variant="outline" className="text-xs">
                                    {warehouse.warehouseName}
                                  </Badge>
                                </div>
                              ))
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Sync Pending
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {product.warehouses && product.warehouses.length > 0 ? (
                              product.warehouses.map((warehouse, index) => (
                                <div key={index} className="text-sm font-bold">
                                  {warehouse.available || 0}
                                </div>
                              ))
                            ) : (
                              <span className="text-lg font-bold text-gray-400">
                                {product.inventoryCount || 0}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStockBadge(product.inventory_count || product.quantity || 0)}
                        </TableCell>
                        <TableCell>
                          {product.price ? `$${parseFloat(product.price).toFixed(2)}` : 'N/A'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {product.updatedAt ? new Date(product.updatedAt).toLocaleDateString() : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}