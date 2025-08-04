import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  PackageCheck, 
  PackageX, 
  AlertTriangle, 
  Pause, 
  TrendingUp, 
  TrendingDown,
  Boxes,
  AlertCircle
} from "lucide-react";

interface EnhancedStatsCardsProps {
  startDate: string;
  endDate: string;
}

export default function EnhancedStatsCards({ startDate, endDate }: EnhancedStatsCardsProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/dashboard/stats", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const response = await fetch(`/api/dashboard/stats?${params}`);
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="h-4 w-4 bg-gray-200 rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-12 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-24"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Total Orders",
      value: stats?.totalOrders || 0,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      description: "All orders in period"
    },
    {
      title: "Shipped Orders",
      value: stats?.shippedOrders || 0,
      icon: PackageCheck,
      color: "text-green-600",
      bgColor: "bg-green-50",
      description: "Fulfilled & delivered"
    },
    {
      title: "Unfulfilled Orders",
      value: stats?.unfulfilledOrders || 0,
      icon: PackageX,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      description: "Pending & processing"
    },
    {
      title: "Orders on Hold",
      value: stats?.ordersOnHold || 0,
      icon: Pause,
      color: "text-red-600",
      bgColor: "bg-red-50",
      description: "Requires attention"
    },
    {
      title: "Open Tickets",
      value: stats?.openTickets || 0,
      icon: AlertTriangle,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      description: "Active support cases"
    },
    {
      title: "Urgent Tickets",
      value: stats?.urgentTickets || 0,
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      description: "High priority issues"
    },
    {
      title: "Low Stock Products",
      value: stats?.lowStockProducts || 0,
      icon: TrendingDown,
      color: "text-orange-600",
      bgColor: "bg-orange-50",  
      description: "Below threshold"
    },
    {
      title: "Out of Stock",
      value: stats?.outOfStockProducts || 0,
      icon: Boxes,
      color: "text-red-600",
      bgColor: "bg-red-50",
      description: "Zero inventory"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const isWarning = card.value > 0 && (card.title.includes("Hold") || card.title.includes("Urgent") || card.title.includes("Out of Stock"));
        const isAlert = card.value > 0 && card.title.includes("Low Stock");
        
        return (
          <Card key={index} className={`transition-all hover:shadow-md ${isWarning ? 'border-red-200' : isAlert ? 'border-orange-200' : ''}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-gray-900">
                  {card.value.toLocaleString()}
                </div>
                {isWarning && (
                  <Badge variant="destructive" className="text-xs">
                    Urgent
                  </Badge>
                )}
                {isAlert && (
                  <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                    Alert
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}