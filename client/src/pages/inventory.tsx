import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Package, Search, AlertTriangle, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";

export default function Inventory() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

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

  const syncInventoryMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/shiphero/sync-inventory');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Success",
        description: "Inventory synced successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to sync inventory",
        variant: "destructive",
      });
    },
  });

  if (isLoading || productsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const filteredProducts = products?.filter((product: any) => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const lowStockProducts = products?.filter((product: any) => product.inventoryCount < 10) || [];
  const totalInventoryValue = products?.reduce((sum: number, product: any) => 
    sum + (parseFloat(product.price || 0) * product.inventoryCount), 0) || 0;

  const getStockStatus = (count: number) => {
    if (count === 0) return { label: 'Out of Stock', variant: 'destructive', icon: AlertTriangle };
    if (count < 10) return { label: 'Low Stock', variant: 'secondary', icon: TrendingDown };
    if (count < 50) return { label: 'In Stock', variant: 'default', icon: Package };
    return { label: 'High Stock', variant: 'outline', icon: TrendingUp };
  };

  return (
    <div className="min-h-screen bg-gray-50">
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
          {/* Inventory Header */}
          <div className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                    Inventory Management
                  </h2>
                </div>
                <div className="mt-4 flex md:mt-0 md:ml-4 space-x-2">
                  <Button variant="outline">
                    Export Data
                  </Button>
                  <Button 
                    onClick={() => syncInventoryMutation.mutate()}
                    disabled={syncInventoryMutation.isPending}
                    className="bg-primary-600 hover:bg-primary-700"
                  >
                    {syncInventoryMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sync with ShipHero
                  </Button>
                </div>
              </div>
              
              {/* Search */}
              <div className="mt-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search products by name or SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Inventory Stats */}
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{products?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">Active SKUs</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${totalInventoryValue.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Total value on hand</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{lowStockProducts.length}</div>
                  <p className="text-xs text-muted-foreground">Items below 10 units</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">5m</div>
                  <p className="text-xs text-muted-foreground">ago</p>
                </CardContent>
              </Card>
            </div>

            {/* Inventory Table */}
            {filteredProducts.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Package className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No products found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm 
                      ? 'Try adjusting your search terms'
                      : 'Products will appear here once they are synced from ShipHero'
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="min-w-full divide-y divide-gray-200">
                  {/* Table Header */}
                  <div className="bg-gray-50 px-6 py-3">
                    <div className="grid grid-cols-12 gap-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="col-span-1">SKU</div>
                      <div className="col-span-3">Product Name</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-1">On Hand</div>
                      <div className="col-span-1">Price</div>
                      <div className="col-span-2">Value</div>
                      <div className="col-span-2">Last Updated</div>
                    </div>
                  </div>
                  
                  {/* Table Body */}
                  <div className="bg-white divide-y divide-gray-200">
                    {filteredProducts.map((product: any) => {
                      const stockStatus = getStockStatus(product.inventoryCount);
                      const StatusIcon = stockStatus.icon;
                      
                      return (
                        <div key={product.id} className="px-6 py-4 hover:bg-gray-50">
                          <div className="grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-1">
                              <div className="text-sm font-medium text-gray-900">
                                {product.sku}
                              </div>
                            </div>
                            
                            <div className="col-span-3">
                              <div className="text-sm font-medium text-gray-900">{product.name}</div>
                              {product.description && (
                                <div className="text-xs text-gray-500 truncate">{product.description}</div>
                              )}
                            </div>
                            
                            <div className="col-span-2">
                              <Badge 
                                variant={stockStatus.variant as any}
                                className="inline-flex items-center"
                              >
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {stockStatus.label}
                              </Badge>
                            </div>
                            
                            <div className="col-span-1">
                              <div className="text-sm font-semibold text-gray-900">
                                {product.inventoryCount}
                              </div>
                            </div>
                            
                            <div className="col-span-1">
                              <div className="text-sm text-gray-900">
                                ${parseFloat(product.price || 0).toFixed(2)}
                              </div>
                            </div>
                            
                            <div className="col-span-2">
                              <div className="text-sm font-medium text-gray-900">
                                ${(parseFloat(product.price || 0) * product.inventoryCount).toFixed(2)}
                              </div>
                            </div>
                            
                            <div className="col-span-2">
                              <div className="text-sm text-gray-900">
                                {new Date(product.updatedAt).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(product.updatedAt).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
    </div>
  );
}
