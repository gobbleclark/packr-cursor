import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";

import TicketModal from "@/components/messages/ticket-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Clock, AlertTriangle, CheckCircle, Plus } from "lucide-react";

export default function Messages() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

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

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<any[]>({
    queryKey: ['/api/tickets'],
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: any) => {
      const response = await apiRequest('POST', '/api/tickets', ticketData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      toast({
        title: "Success",
        description: "Ticket created successfully",
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
        description: "Failed to create ticket",
        variant: "destructive",
      });
    },
  });

  if (isLoading || ticketsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const filteredTickets = tickets?.filter((ticket: any) => {
    if (filterStatus !== 'all' && ticket.ticket.status !== filterStatus) return false;
    if (filterPriority !== 'all' && ticket.ticket.priority !== filterPriority) return false;
    return true;
  }) || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Clock className="h-4 w-4" />;
      case 'closed': return <CheckCircle className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const variants: any = {
      urgent: 'destructive',
      high: 'secondary',
      normal: 'default',
      low: 'outline'
    };
    return <Badge variant={variants[priority] || 'default'}>{priority}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
          {/* Messages Header */}
          <div className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                    Messages & Tickets
                  </h2>
                </div>
                <div className="mt-4 flex md:mt-0 md:ml-4">
                  <Button 
                    onClick={() => {
                      // TODO: Open new ticket modal
                      console.log('Open new ticket modal');
                    }}
                    className="bg-primary-600 hover:bg-primary-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Ticket
                  </Button>
                </div>
              </div>
              
              {/* Filters */}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button 
                  variant={filterStatus === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('all')}
                >
                  All <Badge className="ml-1">{tickets?.length || 0}</Badge>
                </Button>
                <Button 
                  variant={filterStatus === 'open' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('open')}
                >
                  Open <Badge className="ml-1">{tickets?.filter((t: any) => t.ticket.status === 'open').length || 0}</Badge>
                </Button>
                <Button 
                  variant={filterPriority === 'urgent' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterPriority('urgent')}
                >
                  Urgent <Badge className="ml-1 bg-red-100 text-red-900">{tickets?.filter((t: any) => t.ticket.priority === 'urgent').length || 0}</Badge>
                </Button>
                <Button 
                  variant={filterStatus === 'closed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('closed')}
                >
                  Closed <Badge className="ml-1">{tickets?.filter((t: any) => t.ticket.status === 'closed').length || 0}</Badge>
                </Button>
              </div>
            </div>
          </div>

          {/* Tickets List */}
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="bg-white shadow rounded-lg">
              {filteredTickets.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No tickets found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {filterStatus !== 'all' || filterPriority !== 'all' 
                      ? 'Try adjusting your filters'
                      : 'Get started by creating a new ticket'
                    }
                  </p>
                  <div className="mt-6">
                    <Button onClick={() => console.log('Create ticket')}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Ticket
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredTickets.map((ticketData: any) => {
                    const { ticket, createdBy, brand, order, commentCount } = ticketData;
                    
                    return (
                      <div 
                        key={ticket.id}
                        className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedTicket(ticket.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              {getPriorityBadge(ticket.priority)}
                              <span className="text-xs text-gray-500">#{ticket.ticketNumber}</span>
                              {order && (
                                <>
                                  <span className="text-xs text-gray-400">•</span>
                                  <span className="text-xs text-gray-500">Order #{order.orderNumber}</span>
                                </>
                              )}
                            </div>
                            <h4 className="mt-1 text-sm font-medium text-gray-900">{ticket.title}</h4>
                            <p className="mt-1 text-sm text-gray-600 line-clamp-2">{ticket.description}</p>
                            <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                              <span className="flex items-center">
                                <i className="fas fa-user mr-1"></i>
                                {createdBy?.firstName} {createdBy?.lastName}
                                {brand && ` (${brand.name})`}
                              </span>
                              {commentCount > 0 && (
                                <span className="flex items-center">
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                  {commentCount} replies
                                </span>
                              )}
                              <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="ml-4 flex-shrink-0 flex items-center space-x-2">
                            {getStatusIcon(ticket.status)}
                            {createdBy?.profileImageUrl && (
                              <img 
                                className="h-8 w-8 rounded-full object-cover" 
                                src={createdBy.profileImageUrl} 
                                alt="User avatar"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>

      {/* Ticket Modal */}
      {selectedTicket && (
        <TicketModal 
          ticketId={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}
