import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Store, MessageSquare, Warehouse, TrendingUp } from "lucide-react";

export default function StatsCards() {
  const { isAuthenticated } = useAuth();

  // Set date range to include historical Trackstar data (last 90 days to capture June 2025 data)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);
  const endDate = new Date();

  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ['/api/dashboard/stats', startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });
      const response = await fetch(`/api/dashboard/stats?${params}`);
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 60000, // Refetch every minute
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="animate-pulse">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gray-200 rounded-md"></div>
                  <div className="ml-5 w-0 flex-1">
                    <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const defaultStats = {
    totalOrders: 0,
    shippedOrders: 0,
    unfulfilledOrders: 0,
    openTickets: 0,
    urgentTickets: 0,
    activeBrands: 0,
  };

  const currentStats = stats || defaultStats;

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {/* Shipped Orders */}
      <Card className="stats-card">
        <CardContent className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                <Package className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Shipped Orders</dt>
                <dd className="text-lg font-semibold text-gray-900">{currentStats.shippedOrders?.toLocaleString() || '0'}</dd>
              </dl>
            </div>
          </div>
        </CardContent>
        <div className="bg-gray-50 px-5 py-3">
          <div className="text-sm">
            <span className="text-gray-600 font-medium">
              Fulfilled via WMS
            </span>
          </div>
        </div>
      </Card>

      {/* Unfulfilled Orders */}
      <Card className="stats-card">
        <CardContent className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-orange-500 rounded-md flex items-center justify-center">
                <Package className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Unfulfilled Orders</dt>
                <dd className="text-lg font-semibold text-gray-900">{currentStats.unfulfilledOrders?.toLocaleString() || '0'}</dd>
              </dl>
            </div>
          </div>
        </CardContent>
        <div className="bg-gray-50 px-5 py-3">
          <div className="text-sm">
            <span className="text-gray-600 font-medium">
              Pending fulfillment
            </span>
          </div>
        </div>
      </Card>

      {/* Active Brands */}
      <Card className="stats-card">
        <CardContent className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                <Store className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Active Brands</dt>
                <dd className="text-lg font-semibold text-gray-900">{currentStats.activeBrands}</dd>
              </dl>
            </div>
          </div>
        </CardContent>
        <div className="bg-gray-50 px-5 py-3">
          <div className="text-sm">
            <span className="text-gray-600 font-medium">
              Active brands
            </span>
          </div>
        </div>
      </Card>

      {/* Open Tickets */}
      <Card className="stats-card">
        <CardContent className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-orange-500 rounded-md flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Open Tickets</dt>
                <dd className="text-lg font-semibold text-gray-900">{currentStats.openTickets}</dd>
              </dl>
            </div>
          </div>
        </CardContent>
        <div className="bg-gray-50 px-5 py-3">
          <div className="text-sm">
            <span className="text-gray-600 font-medium">
              {currentStats.urgentTickets} urgent tickets
            </span>
          </div>
        </div>
      </Card>

      {/* Inventory Value */}
      <Card className="stats-card">
        <CardContent className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                <Warehouse className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Inventory Value</dt>
                <dd className="text-lg font-semibold text-gray-900">
                  {currentStats.inventoryValue ? `$${(currentStats.inventoryValue / 1000).toFixed(0)}K` : '$0'}
                </dd>
              </dl>
            </div>
          </div>
        </CardContent>
        <div className="bg-gray-50 px-5 py-3">
          <div className="text-sm">
            <span className="text-blue-600 font-medium">
              {currentStats.inStockPercentage}%
            </span>
            <span className="text-gray-500"> in stock</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
