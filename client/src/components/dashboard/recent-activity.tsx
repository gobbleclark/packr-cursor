import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Package, User, Clock, AlertTriangle } from "lucide-react";

export default function RecentActivity() {
  const { isAuthenticated } = useAuth();

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<any[]>({
    queryKey: ['/api/tickets'],
    enabled: isAuthenticated,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: ['/api/orders'],
    enabled: isAuthenticated,
  });

  const recentTickets = tickets?.slice(0, 3) || [];
  const recentOrders = orders?.slice(0, 3) || [];

  const getStatusBadge = (status: string, type: 'ticket' | 'order') => {
    if (type === 'ticket') {
      switch (status) {
        case 'open':
          return <Badge variant="secondary" className="ticket-status-open">Open</Badge>;
        case 'closed':
          return <Badge variant="default" className="ticket-status-closed">Closed</Badge>;
        default:
          return <Badge variant="outline">{status}</Badge>;
      }
    } else {
      switch (status) {
        case 'pending':
          return <Badge className="order-status-pending">Pending</Badge>;
        case 'processing':
          return <Badge className="order-status-processing">Processing</Badge>;
        case 'shipped':
          return <Badge className="order-status-shipped">Shipped</Badge>;
        case 'delivered':
          return <Badge className="order-status-delivered">Delivered</Badge>;
        case 'cancelled':
          return <Badge className="order-status-cancelled">Cancelled</Badge>;
        default:
          return <Badge variant="outline">{status}</Badge>;
      }
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive" className="ticket-priority-urgent">Urgent</Badge>;
      case 'high':
        return <Badge variant="secondary" className="ticket-priority-high">High</Badge>;
      case 'normal':
        return <Badge className="ticket-priority-normal">Normal</Badge>;
      case 'low':
        return <Badge variant="outline" className="ticket-priority-low">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  if (ticketsLoading || ordersLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-32"></div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="animate-pulse">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Recent Messages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="h-5 w-5 mr-2" />
            Recent Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentTickets.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="mx-auto h-8 w-8 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No recent messages</h3>
              <p className="mt-1 text-sm text-gray-500">Messages and tickets will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentTickets.map((ticketData: any) => {
                const { ticket, createdBy, brand } = ticketData;
                
                return (
                  <div key={ticket.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div className="flex-shrink-0">
                      {createdBy?.profileImageUrl ? (
                        <img 
                          className="h-8 w-8 rounded-full object-cover" 
                          src={createdBy.profileImageUrl} 
                          alt="User avatar"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                          <User className="h-4 w-4 text-gray-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">
                          {createdBy?.firstName} {createdBy?.lastName}
                          {brand && ` - ${brand.name}`}
                        </p>
                        {getPriorityBadge(ticket.priority)}
                      </div>
                      <p className="text-sm text-gray-500 mt-1 truncate">{ticket.title}</p>
                      <div className="flex items-center mt-1 text-xs text-gray-400">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 text-center border-t pt-4">
            <Button variant="ghost" size="sm" className="text-primary-600 hover:text-primary-500">
              View All Messages
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Package className="h-5 w-5 mr-2" />
            Recent Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-8 w-8 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No recent orders</h3>
              <p className="mt-1 text-sm text-gray-500">Orders will appear here once synced</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentOrders.map((order: any) => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">#{order.orderNumber}</p>
                    <p className="text-sm text-gray-500">
                      {order.customerName || 'Unknown Customer'} • {Array.isArray(order.orderItems) ? order.orderItems.length : 0} items
                    </p>
                    <div className="flex items-center mt-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3 mr-1" />
                      {new Date(order.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(order.status, 'order')}
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      ${parseFloat(order.totalAmount || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 text-center border-t pt-4">
            <Button variant="ghost" size="sm" className="text-primary-600 hover:text-primary-500">
              View All Orders
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
