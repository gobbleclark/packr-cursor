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
import { Package, Search, Filter, Eye, Edit, Truck } from "lucide-react";

export default function Orders() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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

  const { data: orders = [], isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: ['/api/orders'],
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const response = await apiRequest('PUT', `/api/orders/${orderId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: "Success",
        description: "Order status updated successfully",
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
        description: "Failed to update order status",
        variant: "destructive",
      });
    },
  });

  if (isLoading || ordersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const filteredOrders = orders?.filter((order: any) => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: 'secondary',
      processing: 'default',
      shipped: 'outline',
      delivered: 'default',
      cancelled: 'destructive'
    };
    const colors: any = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return (
      <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  const orderCounts = {
    all: orders?.length || 0,
    pending: orders?.filter((o: any) => o.status === 'pending').length || 0,
    processing: orders?.filter((o: any) => o.status === 'processing').length || 0,
    shipped: orders?.filter((o: any) => o.status === 'shipped').length || 0,
    delivered: orders?.filter((o: any) => o.status === 'delivered').length || 0,
  };

  return (
    <div className="min-h-screen bg-gray-50">
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
          {/* Orders Header */}
          <div className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                    Orders
                  </h2>
                </div>
                <div className="mt-4 flex md:mt-0 md:ml-4 space-x-2">
                  <Button variant="outline">
                    <Filter className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button 
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
                      toast({ title: "Refreshed", description: "Orders data refreshed" });
                    }}
                    className="bg-primary-600 hover:bg-primary-700"
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Sync Orders
                  </Button>
                </div>
              </div>
              
              {/* Search and Filters */}
              <div className="mt-4 flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search orders by number or customer..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant={statusFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                  >
                    All <Badge className="ml-1">{orderCounts.all}</Badge>
                  </Button>
                  <Button 
                    variant={statusFilter === 'pending' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('pending')}
                  >
                    Pending <Badge className="ml-1">{orderCounts.pending}</Badge>
                  </Button>
                  <Button 
                    variant={statusFilter === 'processing' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('processing')}
                  >
                    Processing <Badge className="ml-1">{orderCounts.processing}</Badge>
                  </Button>
                  <Button 
                    variant={statusFilter === 'shipped' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('shipped')}
                  >
                    Shipped <Badge className="ml-1">{orderCounts.shipped}</Badge>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Orders Content */}
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            {filteredOrders.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Package className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No orders found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm || statusFilter !== 'all' 
                      ? 'Try adjusting your search or filters'
                      : 'Orders will appear here once they are synced from ShipHero'
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
                      <div className="col-span-2">Order Number</div>
                      <div className="col-span-2">Customer</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-1">Items</div>
                      <div className="col-span-1">Total</div>
                      <div className="col-span-2">Date</div>
                      <div className="col-span-2">Actions</div>
                    </div>
                  </div>
                  
                  {/* Table Body */}
                  <div className="bg-white divide-y divide-gray-200">
                    {filteredOrders.map((order: any) => (
                      <div key={order.id} className="px-6 py-4 hover:bg-gray-50">
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-2">
                            <div className="text-sm font-medium text-gray-900">
                              #{order.orderNumber}
                            </div>
                            {order.trackingNumber && (
                              <div className="text-xs text-gray-500">
                                <Truck className="h-3 w-3 inline mr-1" />
                                {order.trackingNumber}
                              </div>
                            )}
                          </div>
                          
                          <div className="col-span-2">
                            <div className="text-sm text-gray-900">{order.customerName || 'N/A'}</div>
                            <div className="text-xs text-gray-500">{order.customerEmail || ''}</div>
                          </div>
                          
                          <div className="col-span-2">
                            {getStatusBadge(order.status)}
                          </div>
                          
                          <div className="col-span-1">
                            <div className="text-sm text-gray-900">
                              {Array.isArray(order.orderItems) ? order.orderItems.length : 0}
                            </div>
                          </div>
                          
                          <div className="col-span-1">
                            <div className="text-sm font-medium text-gray-900">
                              ${order.totalAmount || '0.00'}
                            </div>
                          </div>
                          
                          <div className="col-span-2">
                            <div className="text-sm text-gray-900">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(order.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                          
                          <div className="col-span-2">
                            <div className="flex space-x-2">
                              <Button size="sm" variant="outline">
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline">
                                <Edit className="h-3 w-3" />
                              </Button>
                              {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                <Button 
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const nextStatus = order.status === 'pending' ? 'processing' : 
                                                     order.status === 'processing' ? 'shipped' : 'delivered';
                                    updateOrderStatusMutation.mutate({ orderId: order.id, status: nextStatus });
                                  }}
                                  disabled={updateOrderStatusMutation.isPending}
                                >
                                  {updateOrderStatusMutation.isPending ? '...' : 'Update'}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
    </div>
  );
}
