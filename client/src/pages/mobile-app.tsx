import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Smartphone,
  Package,
  Truck,
  MessageSquare,
  BarChart3,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertTriangle,
  Plus,
  Bell,
  User,
  Settings as SettingsIcon,
  Menu,
  X
} from "lucide-react";

export default function MobileApp() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // PWA Installation
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

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

  const { data: dashboardStats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ['/api/dashboard/stats'],
    enabled: isAuthenticated,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: ['/api/orders'],
    enabled: isAuthenticated,
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<any[]>({
    queryKey: ['/api/tickets'],
    enabled: isAuthenticated,
  });

  const { data: brands = [], isLoading: brandsLoading } = useQuery<any[]>({
    queryKey: ['/api/brands'],
    enabled: isAuthenticated && user?.role === 'threePL',
  });

  const refreshDataMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/orders'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/tickets'] }),
      ]);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Data refreshed successfully",
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
        description: "Failed to refresh data",
        variant: "destructive",
      });
    },
  });

  if (isLoading || statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading mobile app...</p>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: "bg-yellow-50 text-yellow-600 border-yellow-300", icon: Clock },
      processing: { color: "bg-blue-50 text-blue-600 border-blue-300", icon: RefreshCw },
      shipped: { color: "bg-green-50 text-green-600 border-green-300", icon: Truck },
      delivered: { color: "bg-green-50 text-green-600 border-green-300", icon: CheckCircle },
      cancelled: { color: "bg-red-50 text-red-600 border-red-300", icon: X },
      open: { color: "bg-blue-50 text-blue-600 border-blue-300", icon: MessageSquare },
      closed: { color: "bg-gray-50 text-gray-600 border-gray-300", icon: CheckCircle },
      urgent: { color: "bg-red-50 text-red-600 border-red-300", icon: AlertTriangle }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} border`}>
        <Icon className="h-3 w-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const filteredOrders = orders.filter(order =>
    order.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.customerName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTickets = tickets.filter(ticket =>
    ticket.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.priority?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Smartphone className="h-6 w-6 text-primary-600" />
            <h1 className="text-lg font-semibold text-gray-900">3PL Mobile</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshDataMutation.mutate()}
              disabled={refreshDataMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${refreshDataMutation.isPending ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setIsMenuOpen(false)}>
          <div className="fixed right-0 top-0 h-full w-64 bg-white shadow-lg">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Menu</h2>
                <Button variant="ghost" size="sm" onClick={() => setIsMenuOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                <User className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="font-medium text-sm">{user?.email}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.role} User</p>
                </div>
              </div>
              <div className="space-y-2">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start"
                  onClick={() => window.location.href = "/"}
                >
                  <BarChart3 className="h-4 w-4 mr-3" />
                  Dashboard
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start"
                  onClick={() => window.location.href = "/orders"}
                >
                  <Package className="h-4 w-4 mr-3" />
                  Orders
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start"
                  onClick={() => window.location.href = "/messages"}
                >
                  <MessageSquare className="h-4 w-4 mr-3" />
                  Messages
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start"
                  onClick={() => window.location.href = "/integrations"}
                >
                  <SettingsIcon className="h-4 w-4 mr-3" />
                  Integrations
                </Button>
              </div>
              <div className="pt-4 border-t">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => window.location.href = "/api/logout"}
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="px-4 py-3 bg-white border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search orders, tickets, customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Mobile Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="grid w-full grid-cols-4 bg-white border-b">
          <TabsTrigger value="dashboard" className="flex flex-col items-center py-2">
            <BarChart3 className="h-4 w-4" />
            <span className="text-xs mt-1">Stats</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex flex-col items-center py-2">
            <Package className="h-4 w-4" />
            <span className="text-xs mt-1">Orders</span>
          </TabsTrigger>
          <TabsTrigger value="tickets" className="flex flex-col items-center py-2">
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs mt-1">Tickets</span>
          </TabsTrigger>
          {user?.role === 'threePL' && (
            <TabsTrigger value="brands" className="flex flex-col items-center py-2">
              <Truck className="h-4 w-4" />
              <span className="text-xs mt-1">Brands</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="mt-0 px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Package className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold text-blue-600">
                  {dashboardStats?.totalOrders || 0}
                </div>
                <div className="text-sm text-gray-600">Total Orders</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold text-green-600">
                  {dashboardStats?.openTickets || 0}
                </div>
                <div className="text-sm text-gray-600">Open Tickets</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-600" />
                <div className="text-2xl font-bold text-red-600">
                  {dashboardStats?.urgentTickets || 0}
                </div>
                <div className="text-sm text-gray-600">Urgent</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <Truck className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold text-purple-600">
                  {dashboardStats?.pendingOrders || 0}
                </div>
                <div className="text-sm text-gray-600">Pending</div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {orders.slice(0, 3).map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">#{order.orderNumber}</p>
                    <p className="text-xs text-gray-500">{order.customerName}</p>
                  </div>
                  {getStatusBadge(order.status)}
                </div>
              ))}
              {orders.length === 0 && (
                <p className="text-gray-500 text-center py-4">No recent orders</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="mt-0">
          <ScrollArea className="h-[calc(100vh-180px)]">
            <div className="px-4 py-4 space-y-3">
              {ordersLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading orders...</p>
                </div>
              ) : filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <Card key={order.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-sm">#{order.orderNumber}</p>
                          <p className="text-xs text-gray-500">{order.customerName}</p>
                        </div>
                        {getStatusBadge(order.status)}
                      </div>
                      
                      <div className="space-y-1 text-xs text-gray-600">
                        <div className="flex justify-between">
                          <span>Amount:</span>
                          <span className="font-medium">${order.totalAmount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Shipping:</span>
                          <span>{order.shippingMethod || 'Standard'}</span>
                        </div>
                        {order.trackingNumber && (
                          <div className="flex justify-between">
                            <span>Tracking:</span>
                            <span className="font-mono">{order.trackingNumber}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Date:</span>
                          <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">
                    {searchQuery ? 'No orders match your search' : 'No orders found'}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Tickets Tab */}
        <TabsContent value="tickets" className="mt-0">
          <ScrollArea className="h-[calc(100vh-180px)]">
            <div className="px-4 py-4 space-y-3">
              {ticketsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading tickets...</p>
                </div>
              ) : filteredTickets.length > 0 ? (
                filteredTickets.map((ticket) => (
                  <Card key={ticket.id} className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{ticket.subject}</p>
                          <p className="text-xs text-gray-500">#{ticket.id.slice(0, 8)}</p>
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                          {getStatusBadge(ticket.status)}
                          {getStatusBadge(ticket.priority)}
                        </div>
                      </div>
                      
                      <div className="space-y-1 text-xs text-gray-600">
                        <div className="flex justify-between">
                          <span>Brand:</span>
                          <span>{ticket.brand?.name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Created:</span>
                          <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="mt-2">
                          <p className="text-xs text-gray-700 line-clamp-2">
                            {ticket.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">
                    {searchQuery ? 'No tickets match your search' : 'No support tickets found'}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Brands Tab (3PL Users Only) */}
        {user?.role === 'threePL' && (
          <TabsContent value="brands" className="mt-0">
            <ScrollArea className="h-[calc(100vh-180px)]">
              <div className="px-4 py-4 space-y-3">
                {brandsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading brands...</p>
                  </div>
                ) : brands.length > 0 ? (
                  brands.map((brand) => (
                    <Card key={brand.id} className="border-l-4 border-l-purple-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-sm">{brand.name}</p>
                            <p className="text-xs text-gray-500">{brand.email}</p>
                          </div>
                          <Badge className={brand.isActive ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}>
                            {brand.isActive ? 'Active' : 'Pending'}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1 text-xs text-gray-600">
                          <div className="flex justify-between">
                            <span>ShipHero:</span>
                            <span>{brand.shipHeroApiKey ? '✓ Connected' : '✗ Not Connected'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Trackstar:</span>
                            <span>{brand.trackstarAccessToken ? '✓ Connected' : '✗ Not Connected'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Created:</span>
                            <span>{new Date(brand.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Truck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">No brand clients found</p>
                    <Button 
                      className="mt-4" 
                      onClick={() => window.location.href = "/brand-management"}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Invite Brand
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}