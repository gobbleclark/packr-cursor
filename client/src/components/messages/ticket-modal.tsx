import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import MessageThread from "./message-thread";
import { 
  X, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Paperclip, 
  Send, 
  User
} from "lucide-react";

interface TicketModalProps {
  ticketId: string;
  onClose: () => void;
}

export default function TicketModal({ ticketId, onClose }: TicketModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [replyContent, setReplyContent] = useState('');

  const { data: ticketDetails, isLoading } = useQuery<any>({
    queryKey: ['/api/tickets', ticketId],
    enabled: !!ticketId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await apiRequest('PUT', `/api/tickets/${ticketId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets', ticketId] });
      toast({
        title: "Success",
        description: "Ticket status updated successfully",
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
        description: "Failed to update ticket status",
        variant: "destructive",
      });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest('POST', `/api/tickets/${ticketId}/comments`, {
        content,
        attachments: null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets', ticketId] });
      setReplyContent('');
      toast({
        title: "Success",
        description: "Reply posted successfully",
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
        description: "Failed to post reply",
        variant: "destructive",
      });
    },
  });

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500 bg-opacity-75 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!ticketDetails?.ticket) {
    return null;
  }

  const { ticket, comments, attachments } = ticketDetails;

  const getPriorityBadge = (priority: string) => {
    const variants: any = {
      urgent: 'destructive',
      high: 'secondary', 
      normal: 'default',
      low: 'outline'
    };
    return <Badge variant={variants[priority] || 'default'}>{priority}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Clock className="h-4 w-4" />;
      case 'closed': return <CheckCircle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const handleReply = () => {
    if (!replyContent.trim()) {
      toast({
        title: "Error",
        description: "Please enter a reply message",
        variant: "destructive",
      });
      return;
    }
    replyMutation.mutate(replyContent);
  };

  const handleStatusUpdate = (status: string) => {
    updateStatusMutation.mutate(status);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Ticket Header */}
          <div className="bg-white px-6 py-4 border-b border-gray-200 sm:px-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  {getPriorityBadge(ticket.priority)}
                  <span className="text-sm text-gray-500">#{ticket.ticketNumber}</span>
                  {ticket.orderId && (
                    <>
                      <span className="text-sm text-gray-400">•</span>
                      <span className="text-sm text-gray-500">Linked to Order</span>
                    </>
                  )}
                </div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">{ticket.title}</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Created {new Date(ticket.createdAt).toLocaleDateString()} at {new Date(ticket.createdAt).toLocaleTimeString()}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {ticket.status === 'open' && (
                  <Button
                    onClick={() => handleStatusUpdate('closed')}
                    disabled={updateStatusMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Resolved
                  </Button>
                )}
                {ticket.status === 'closed' && (
                  <Button
                    onClick={() => handleStatusUpdate('open')}
                    disabled={updateStatusMutation.isPending}
                    variant="outline"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Reopen
                  </Button>
                )}
                <Button variant="ghost" onClick={onClose}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Ticket Content */}
          <div className="bg-white px-6 py-4 max-h-96 overflow-y-auto">
            {/* Original Ticket */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {user?.profileImageUrl ? (
                      <img 
                        className="h-10 w-10 rounded-full object-cover" 
                        src={user.profileImageUrl} 
                        alt="User avatar"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <User className="h-5 w-5 text-gray-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">Original Ticket</span>
                      <span className="text-gray-500"> • {new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                      {ticket.description}
                    </div>
                    
                    {/* Attachments */}
                    {attachments && attachments.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center space-x-2">
                          <Paperclip className="h-4 w-4 text-gray-400" />
                          <div className="flex space-x-2">
                            {attachments.map((attachment: any) => (
                              <span 
                                key={attachment.id}
                                className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 cursor-pointer hover:bg-gray-200"
                              >
                                {attachment.originalName}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Comments Thread */}
            {comments && comments.length > 0 && (
              <MessageThread comments={comments} />
            )}
          </div>

          {/* Reply Form */}
          <div className="bg-gray-50 px-6 py-4">
            <div className="space-y-4">
              <div>
                <label className="sr-only">Reply</label>
                <Textarea
                  rows={3}
                  className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md resize-none"
                  placeholder="Type your reply..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  disabled={replyMutation.isPending}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button type="button" variant="outline" size="sm">
                    <Paperclip className="h-4 w-4 mr-2" />
                    Attach Files
                  </Button>
                  <Button type="button" variant="outline" size="sm">
                    <User className="h-4 w-4 mr-2" />
                    Mention
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  {ticket.status === 'open' && (
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => handleStatusUpdate('closed')}
                      disabled={updateStatusMutation.isPending}
                    >
                      Close Ticket
                    </Button>
                  )}
                  <Button 
                    onClick={handleReply}
                    disabled={replyMutation.isPending || !replyContent.trim()}
                    className="bg-primary-600 hover:bg-primary-700"
                  >
                    {replyMutation.isPending ? (
                      "Posting..."
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Reply
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
