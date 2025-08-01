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
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Plus, 
  Building2, 
  Mail, 
  Users, 
  Copy, 
  CheckCircle, 
  XCircle, 
  Clock,
  ExternalLink,
  Settings,
  RefreshCw
} from "lucide-react";

export default function BrandManagement() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [brandEmail, setBrandEmail] = useState('');

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

  // Redirect if not 3PL user
  useEffect(() => {
    if (!isLoading && user && user.role !== 'threePL') {
      toast({
        title: "Access Denied",
        description: "Only 3PL managers can access brand management.",
        variant: "destructive",
      });
      window.location.href = "/";
      return;
    }
  }, [user, isLoading, toast]);

  const { data: brands = [], isLoading: brandsLoading } = useQuery<any[]>({
    queryKey: ['/api/brands'],
    enabled: isAuthenticated && user?.role === 'threePL',
  });



  const inviteBrandMutation = useMutation({
    mutationFn: async (data: { name: string; email: string }) => {
      const response = await apiRequest('POST', '/api/brands/invite', data);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/brands'] });
      setBrandName('');
      setBrandEmail('');
      setIsInviteDialogOpen(false);
      
      // Show invitation link to copy
      toast({
        title: "Brand Invitation Created",
        description: "Copy the invitation link and send it to the brand.",
      });
      
      // Copy invitation link to clipboard
      navigator.clipboard.writeText(data.invitationLink);
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
        description: "Failed to create brand invitation",
        variant: "destructive",
      });
    },
  });



  if (isLoading || brandsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading brand management...</p>
        </div>
      </div>
    );
  }

  const handleInviteBrand = () => {
    if (!brandName.trim() || !brandEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter both brand name and email",
        variant: "destructive",
      });
      return;
    }
    inviteBrandMutation.mutate({ name: brandName, email: brandEmail });
  };

  const resendInviteMutation = useMutation({
    mutationFn: async (brandId: string) => {
      const response = await apiRequest('POST', `/api/brands/${brandId}/resend-invite`, {});
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/brands'] });
      
      toast({
        title: "Invitation Resent",
        description: data.emailFailed 
          ? "Invitation updated, but email failed. Please share the link manually." 
          : "Brand invitation has been resent successfully!",
        variant: data.emailFailed ? "destructive" : "default",
      });
      
      // Copy new invitation link to clipboard if available
      if (data.invitationLink) {
        navigator.clipboard.writeText(data.invitationLink);
      }
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
        description: "Failed to resend brand invitation",
        variant: "destructive",
      });
    },
  });

  const handleResendInvite = (brandId: string) => {
    resendInviteMutation.mutate(brandId);
  };



  const getBrandStatusBadge = (brand: any) => {
    if (!brand.isActive) {
      return <Badge variant="outline" className="text-yellow-600 border-yellow-300">Pending Invitation</Badge>;
    }
    return <Badge variant="default" className="text-green-600 border-green-300 bg-green-50">Active</Badge>;
  };

  const getIntegrationStatus = (brand: any) => {
    const hasShipHero = brand.shipHeroApiKey;
    const hasTrackstar = brand.trackstarAccessToken;
    
    if (hasShipHero && hasTrackstar) {
      return <Badge variant="default" className="bg-blue-50 text-blue-600">ShipHero + Trackstar</Badge>;
    } else if (hasShipHero) {
      return <Badge variant="secondary">ShipHero Only</Badge>;
    } else if (hasTrackstar) {
      return <Badge variant="secondary">Trackstar Only</Badge>;
    } else {
      return <Badge variant="outline">No Integration</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Brand Management</h1>
                  <p className="mt-2 text-gray-600">
                    Manage your brand clients and their integrations
                  </p>
                </div>
                <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Invite Brand
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Invite New Brand</DialogTitle>
                      <DialogDescription>
                        Create an invitation for a brand to join your 3PL platform.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="brand-name">Brand Name</Label>
                        <Input
                          id="brand-name"
                          value={brandName}
                          onChange={(e) => setBrandName(e.target.value)}
                          placeholder="Enter brand name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="brand-email">Email Address</Label>
                        <Input
                          id="brand-email"
                          type="email"
                          value={brandEmail}
                          onChange={(e) => setBrandEmail(e.target.value)}
                          placeholder="Enter brand email"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleInviteBrand}
                        disabled={inviteBrandMutation.isPending}
                      >
                        {inviteBrandMutation.isPending ? "Creating..." : "Create Invitation"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>



            {/* Brands Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {brands.map((brand) => (
                <Card key={brand.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{brand.name}</CardTitle>
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {brand.email}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Status:</span>
                        {getBrandStatusBadge(brand)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Integration:</span>
                        {getIntegrationStatus(brand)}
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex flex-col gap-2 text-sm text-gray-600">
                      <div className="flex items-center justify-between">
                        <span>Created:</span>
                        <span>{new Date(brand.createdAt).toLocaleDateString()}</span>
                      </div>
                      {brand.invitationSentAt && !brand.isActive && (
                        <div className="flex items-center justify-between">
                          <span>Invited:</span>
                          <span>{new Date(brand.invitationSentAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {!brand.isActive && brand.invitationToken && (
                      <div className="mt-4 space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            const invitationLink = `${window.location.origin}/brand-invite/${brand.invitationToken}`;
                            navigator.clipboard.writeText(invitationLink);
                            toast({
                              title: "Invitation Link Copied",
                              description: "The invitation link has been copied to your clipboard.",
                            });
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Invitation Link
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => handleResendInvite(brand.id)}
                          disabled={resendInviteMutation.isPending}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${resendInviteMutation.isPending ? 'animate-spin' : ''}`} />
                          {resendInviteMutation.isPending ? "Resending..." : "Resend Invite"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {brands.length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No brands yet</h3>
                  <p className="text-gray-600 mb-6">
                    Start by inviting your first brand to join your 3PL platform.
                  </p>
                  <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Invite Your First Brand
                      </Button>
                    </DialogTrigger>
                  </Dialog>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
    </div>
  );
}