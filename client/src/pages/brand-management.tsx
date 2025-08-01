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
  
  // All state hooks at the top level - never conditional
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [brandEmail, setBrandEmail] = useState('');

  // All query hooks at the top level - never conditional
  const { data: brands = [], isLoading: brandsLoading } = useQuery<any[]>({
    queryKey: ['/api/brands'],
    enabled: isAuthenticated && user?.role === 'threePL',
  });

  // All mutation hooks at the top level - never conditional
  const inviteBrandMutation = useMutation({
    mutationFn: async (data: { name: string; email: string }) => {
      const response = await apiRequest('POST', '/api/brands/invite', data);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/brands'] });
      setBrandName('');
      setBrandEmail('');
      setIsInviteDialogOpen(false);
      
      toast({
        title: "Brand Invitation Created",
        description: "Copy the invitation link and send it to the brand.",
      });
      
      // Try to copy to clipboard, but don't fail if it doesn't work
      try {
        await navigator.clipboard.writeText(data.invitationLink);
      } catch (clipboardError) {
        console.warn("Failed to copy to clipboard:", clipboardError);
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
        description: "Failed to create brand invitation",
        variant: "destructive",
      });
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (brandId: string) => {
      const response = await apiRequest('POST', `/api/brands/${brandId}/resend-invite`, {});
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/brands'] });
      
      toast({
        title: "Invitation Resent",
        description: data.emailFailed 
          ? "Invitation updated, but email failed. Please share the link manually." 
          : "Brand invitation has been resent successfully!",
        variant: data.emailFailed ? "destructive" : "default",
      });
      
      if (data.invitationLink) {
        try {
          await navigator.clipboard.writeText(data.invitationLink);
        } catch (clipboardError) {
          console.warn("Failed to copy to clipboard:", clipboardError);
        }
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

  // Effects after all hooks
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
    }
  }, [isAuthenticated, isLoading, toast]);

  useEffect(() => {
    if (!isLoading && user && user.role !== 'threePL') {
      toast({
        title: "Access Denied",
        description: "Only 3PL managers can access brand management.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  }, [user, isLoading, toast]);

  // Conditional rendering AFTER all hooks
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

  if (!isAuthenticated || (user && user.role !== 'threePL')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting...</p>
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

  const handleCopyInviteLink = async (inviteToken: string) => {
    const inviteLink = `${window.location.origin}/brand-invite/${inviteToken}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast({
        title: "Link Copied",
        description: "Invitation link copied to clipboard",
      });
    } catch (clipboardError) {
      console.warn("Failed to copy to clipboard:", clipboardError);
      // Fallback: show the link in a toast so user can copy manually
      toast({
        title: "Copy Link Manually",
        description: inviteLink,
        variant: "outline",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Brand Management</h1>
                <p className="mt-2 text-gray-600">
                  Manage your brand clients and their integrations
                </p>
              </div>
              <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Invite Brand</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Invite New Brand</DialogTitle>
                    <DialogDescription>
                      Create an invitation for a new brand to join your 3PL platform.
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
                      <Label htmlFor="brand-email">Contact Email</Label>
                      <Input
                        id="brand-email"
                        type="email"
                        value={brandEmail}
                        onChange={(e) => setBrandEmail(e.target.value)}
                        placeholder="Enter contact email"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      onClick={handleInviteBrand}
                      disabled={inviteBrandMutation.isPending}
                    >
                      {inviteBrandMutation.isPending && (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create Invitation
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Brands</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{brands.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Brands</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {brands.filter(brand => brand.isActive).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Invites</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {brands.filter(brand => !brand.isActive).length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Brands List */}
          <Card>
            <CardHeader>
              <CardTitle>Brand Clients</CardTitle>
            </CardHeader>
            <CardContent>
              {brands.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No brands yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Get started by inviting your first brand client.
                  </p>
                  <div className="mt-6">
                    <Button onClick={() => setIsInviteDialogOpen(true)} className="inline-flex items-center">
                      <Plus className="mr-2 h-4 w-4" />
                      Invite Brand
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {brands.map((brand) => (
                    <div
                      key={brand.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg bg-white"
                    >
                      <div className="flex-1 mb-4 sm:mb-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{brand.name}</h3>
                          {getBrandStatusBadge(brand)}
                          {getIntegrationStatus(brand)}
                        </div>
                        <p className="text-sm text-gray-600">{brand.email}</p>
                        {brand.createdAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            Invited: {new Date(brand.createdAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!brand.isActive && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyInviteLink(brand.inviteToken)}
                              className="flex items-center gap-2"
                            >
                              <Copy className="h-4 w-4" />
                              <span className="hidden sm:inline">Copy Link</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResendInvite(brand.id)}
                              disabled={resendInviteMutation.isPending}
                              className="flex items-center gap-2"
                            >
                              {resendInviteMutation.isPending ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Mail className="h-4 w-4" />
                              )}
                              <span className="hidden sm:inline">Resend</span>
                            </Button>
                          </>
                        )}
                        {brand.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            <Settings className="h-4 w-4" />
                            <span className="hidden sm:inline">Manage</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}