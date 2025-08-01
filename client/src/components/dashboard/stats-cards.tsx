import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Store, MessageSquare, Warehouse, TrendingUp } from "lucide-react";

export default function StatsCards() {
  const { isAuthenticated } = useAuth();

  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ['/api/dashboard/stats'],
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
    openTickets: 0,
    urgentTickets: 0,
    activeBrands: 0,
  };

  const currentStats = stats || defaultStats;

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Orders */}
      <Card className="stats-card">
        <CardContent className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                <Package className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Total Orders</dt>
                <dd className="text-lg font-semibold text-gray-900">{currentStats.totalOrders.toLocaleString()}</dd>
              </dl>
            </div>
          </div>
        </CardContent>
        <div className="bg-gray-50 px-5 py-3">
          <div className="text-sm">
            <span className="text-green-600 font-medium flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              +12%
            </span>
            <span className="text-gray-500"> from last month</span>
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
            <span className="text-green-600 font-medium">+2</span>
            <span className="text-gray-500"> new this month</span>
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
            <span className="text-red-600 font-medium">{currentStats.urgentTickets}</span>
            <span className="text-gray-500"> marked urgent</span>
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
                <dd className="text-lg font-semibold text-gray-900">$487K</dd>
              </dl>
            </div>
          </div>
        </CardContent>
        <div className="bg-gray-50 px-5 py-3">
          <div className="text-sm">
            <span className="text-blue-600 font-medium">94%</span>
            <span className="text-gray-500"> in stock</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
