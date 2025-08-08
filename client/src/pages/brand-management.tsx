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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  RefreshCw,
  UserPlus,
  Edit,
  Trash2,
  Zap,
  TrendingUp
} from "lucide-react";


export default function BrandManagement() {
  // ALL hooks must be called at the top level, in the same order every render
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
  
  // State hooks - MUST be called every render in the same order
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [brandEmail, setBrandEmail] = useState('');
  const [isIntegrationDialogOpen, setIsIntegrationDialogOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<any>(null);
  const [integrationType, setIntegrationType] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [userId, setUserId] = useState('');
  const [shipHeroUsername, setShipHeroUsername] = useState('');
  const [shipHeroPassword, setShipHeroPassword] = useState('');
  const [isUserManagementDialogOpen, setIsUserManagementDialogOpen] = useState(false);
  const [selectedBrandForUsers, setSelectedBrandForUsers] = useState<any>(null);
  const [selectedBrandForSync, setSelectedBrandForSync] = useState<any>(null);
  const [syncStatusDialogOpen, setSyncStatusDialogOpen] = useState(false);

  // Query hooks - MUST be called every render
  const { data: brands = [], isLoading: brandsLoading } = useQuery<any[]>({
    queryKey: ['/api/brands'],
    enabled: isAuthenticated && user?.role === 'threePL',
  });

  // Mutation hooks - MUST be called every render in the same order
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

  const addIntegrationMutation = useMutation({
    mutationFn: async (data: { brandId: string; integrationType: string; apiKey: string; userId?: string }) => {
      const response = await apiRequest('PUT', `/api/brands/${data.brandId}/integrations`, {
        integrationType: data.integrationType,
        apiKey: data.apiKey,
        userId: data.userId
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/brands'] });
      setIsIntegrationDialogOpen(false);
      setSelectedBrand(null);
      setIntegrationType('');
      setApiKey('');
      setUserId('');
      setShipHeroUsername('');
      setShipHeroPassword('');
      
      const integrationName = integrationType === 'trackstar' ? 'Trackstar (Universal WMS)' : 'ShipHero';
      toast({
        title: "Integration Added",
        description: `${integrationName} integration has been configured successfully!`,
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
        description: "Failed to add integration",
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

  const handleAddIntegration = (brand: any) => {
    setSelectedBrand(brand);
    setIntegrationType('trackstar'); // Auto-select Trackstar as the only option
    setIsIntegrationDialogOpen(true);
  };

  const handleEditIntegration = (brand: any) => {
    setSelectedBrand(brand);
    setIntegrationType('trackstar');
    setIsIntegrationDialogOpen(true);
  };

  const handleSaveIntegration = () => {
    if (!selectedBrand || !integrationType) {
      toast({
        title: "Error",
        description: "Please select an integration type",
        variant: "destructive",
      });
      return;
    }

    // Redirect to Trackstar's connection interface
    const trackstarConnectUrl = `https://app.trackstar.com/connect?client_id=269fcaf8b50a4fb4b384724f3e5d76db&brand_id=${selectedBrand.id}&redirect_uri=${encodeURIComponent(window.location.origin)}/api/trackstar/callback`;
    
    toast({
      title: "Redirecting to Trackstar", 
      description: "Opening Trackstar's WMS selection interface...",
    });

    // Open Trackstar connection in new window
    window.open(trackstarConnectUrl, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
    
    // Close the dialog
    setIsIntegrationDialogOpen(false);
    setSelectedBrand(null);
    setIntegrationType('');
  };

  const handleManageUsers = (brand: any) => {
    setSelectedBrandForUsers(brand);
    setIsUserManagementDialogOpen(true);
  };

  const syncBrandMutation = useMutation({
    mutationFn: async (brandId: string) => {
      const response = await apiRequest('POST', `/api/brands/${brandId}/sync`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sync Completed Successfully",
        description: `Orders: ${data.results.orders}, Products: ${data.results.products}, Shipments: ${data.results.shipments}`,
      });
      // Refresh the page data to show any new orders/products
      queryClient.invalidateQueries({ queryKey: ['/api/brands'] });
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
        title: "Sync Failed",
        description: "Failed to sync brand data",
        variant: "destructive",
      });
    },
  });

  const handleSyncBrand = (brandId: string) => {
    syncBrandMutation.mutate(brandId);
  };

  // Setup webhooks for real-time updates
  const setupWebhooksMutation = useMutation({
    mutationFn: async (brandId: string) => {
      const response = await apiRequest(`/api/brands/${brandId}/setup-webhooks`, {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Webhooks Setup Complete",
        description: "Real-time updates are now active for orders, shipments, and inventory",
      });
    },
    onError: (error) => {
      toast({
        title: "Webhook Setup Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSetupWebhooks = (brandId: string) => {
    setupWebhooksMutation.mutate(brandId);
  };

  const getBrandStatusBadge = (brand: any) => {
    if (!brand.isActive) {
      return <Badge variant="outline" className="text-yellow-600 border-yellow-300">Pending Invitation</Badge>;
    }
    return <Badge variant="default" className="text-green-600 border-green-300 bg-green-50">Active</Badge>;
  };

  const getIntegrationStatus = (brand: any) => {
    const hasTrackstar = brand.trackstarApiKey;
    
    if (hasTrackstar) {
      return <Badge variant="default" className="bg-purple-50 text-purple-600 border-purple-200">Trackstar Connected</Badge>;
    } else {
      return <Badge variant="secondary" className="bg-gray-50 text-gray-600 border-gray-200">No Integration</Badge>;
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
                          <>
                            {!brand.trackstarApiKey ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddIntegration(brand)}
                                className="flex items-center gap-2"
                              >
                                <Settings className="h-4 w-4" />
                                <span className="hidden sm:inline">Add Integration</span>
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditIntegration(brand)}
                                className="flex items-center gap-2"
                              >
                                <Settings className="h-4 w-4" />
                                <span className="hidden sm:inline">Edit Integration</span>
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleManageUsers(brand)}
                              className="flex items-center gap-2"
                            >
                              <Users className="h-4 w-4" />
                              <span className="hidden sm:inline">Manage Users</span>
                            </Button>
                            {brand.trackstarApiKey && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSyncBrand(brand.id)}
                                  disabled={syncBrandMutation.isPending}
                                  className="flex items-center gap-2"
                                >
                                  {syncBrandMutation.isPending ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                  <span className="hidden sm:inline">
                                    {syncBrandMutation.isPending ? 'Syncing...' : 'Sync Data'}
                                  </span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSetupWebhooks(brand.id)}
                                  disabled={setupWebhooksMutation.isPending}
                                  className="flex items-center gap-2"
                                >
                                  {setupWebhooksMutation.isPending ? (
                                    <Zap className="h-4 w-4 animate-pulse" />
                                  ) : (
                                    <Zap className="h-4 w-4" />
                                  )}
                                  <span className="hidden sm:inline">
                                    {setupWebhooksMutation.isPending ? 'Setting up...' : 'Setup Webhooks'}
                                  </span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedBrandForSync(brand);
                                    setSyncStatusDialogOpen(true);
                                  }}
                                  className="flex items-center gap-2"
                                >
                                  <TrendingUp className="h-4 w-4" />
                                  <span className="hidden sm:inline">Sync Status</span>
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Integration Dialog */}
          <Dialog open={isIntegrationDialogOpen} onOpenChange={setIsIntegrationDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {(selectedBrand?.trackstar_api_key || selectedBrand?.trackstarApiKey) 
                    ? `Edit Integration for ${selectedBrand?.name}` 
                    : `Add Integration for ${selectedBrand?.name}`}
                </DialogTitle>
                <DialogDescription>
                  Configure Trackstar universal WMS integration for this brand to enable order and inventory sync across all platforms.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="integration-type">Integration Type</Label>
                  <Select value={integrationType} onValueChange={setIntegrationType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select integration type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trackstar">Trackstar Universal WMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-4">
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <h4 className="font-semibold text-purple-900 mb-2">Universal WMS Integration</h4>
                    <p className="text-sm text-purple-700 mb-3">
                      Trackstar provides a unified connection to multiple warehouse management systems including:
                    </p>
                    <ul className="text-sm text-purple-700 space-y-1 mb-3">
                      <li>• ShipHero</li>
                      <li>• ShipBob</li>
                      <li>• Fulfillment Works</li>
                      <li>• And 20+ other WMS providers</li>
                    </ul>
                    <p className="text-sm text-purple-600">
                      Click "Connect to Trackstar" to choose your WMS provider and configure the connection.
                    </p>
                  </div>
                </div>
                

              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsIntegrationDialogOpen(false);
                    setSelectedBrand(null);
                    setIntegrationType('');
                    setApiKey('');
                    setUserId('');
                    setShipHeroUsername('');
                    setShipHeroPassword('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveIntegration}
                  disabled={addIntegrationMutation.isPending}
                >
                  {addIntegrationMutation.isPending && (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {(selectedBrand?.trackstar_api_key || selectedBrand?.trackstarApiKey) 
                    ? 'Reconnect to Trackstar' 
                    : 'Connect to Trackstar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* User Management Dialog */}
          <Dialog open={isUserManagementDialogOpen} onOpenChange={setIsUserManagementDialogOpen}>
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle>Manage Users for {selectedBrandForUsers?.name}</DialogTitle>
                <DialogDescription>
                  View and manage brand users. Brand users can access their brand's dashboard and create support tickets.
                </DialogDescription>
              </DialogHeader>
              <UserManagement 
                brandId={selectedBrandForUsers?.id} 
                isOpen={isUserManagementDialogOpen}
              />
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}

// User Management Component - Fixed hooks order
function UserManagement({ brandId, isOpen }: { brandId: string; isOpen: boolean }) {
  // All hooks MUST be called at the top level, every render
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserFirstName, setNewUserFirstName] = useState('');
  const [newUserLastName, setNewUserLastName] = useState('');

  // Query hook MUST be called every render, not conditionally
  const { data: brandUsers = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/brands', brandId, 'users'],
    enabled: isOpen && !!brandId,
  });

  const addUserMutation = useMutation({
    mutationFn: async (userData: { email: string; firstName: string; lastName: string }) => {
      const response = await apiRequest('POST', `/api/brands/${brandId}/users`, userData);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/brands', brandId, 'users'] });
      setIsAddUserDialogOpen(false);
      setNewUserEmail('');
      setNewUserFirstName('');
      setNewUserLastName('');
      toast({
        title: "User Added",
        description: "Brand user has been created successfully!",
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
        description: "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest('DELETE', `/api/brands/${brandId}/users/${userId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/brands', brandId, 'users'] });
      toast({
        title: "User Deleted",
        description: "Brand user has been deleted successfully!",
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
        description: "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const handleAddUser = () => {
    if (!newUserEmail || !newUserFirstName || !newUserLastName) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    addUserMutation.mutate({
      email: newUserEmail,
      firstName: newUserFirstName,
      lastName: newUserLastName,
    });
  };

  if (isLoading) {
    return <div className="p-4">Loading users...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          {brandUsers.length} user{brandUsers.length !== 1 ? 's' : ''} found
        </div>
        <Button
          onClick={() => setIsAddUserDialogOpen(true)}
          size="sm"
          className="flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="space-y-2">
        {brandUsers.map((user: any) => (
          <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex-1">
              <div className="font-medium">{user.firstName} {user.lastName}</div>
              <div className="text-sm text-gray-500">{user.email}</div>
              <Badge variant="outline" className="mt-1">Brand User</Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => deleteUserMutation.mutate(user.id)}
                disabled={deleteUserMutation.isPending}
                className="flex items-center gap-2 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        ))}
        
        {brandUsers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No users found for this brand
          </div>
        )}
      </div>

      {/* Add User Dialog */}
      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Brand User</DialogTitle>
            <DialogDescription>
              Create a new user account for this brand.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="Enter user email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={newUserFirstName}
                onChange={(e) => setNewUserFirstName(e.target.value)}
                placeholder="Enter first name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={newUserLastName}
                onChange={(e) => setNewUserLastName(e.target.value)}
                placeholder="Enter last name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddUserDialogOpen(false);
                setNewUserEmail('');
                setNewUserFirstName('');
                setNewUserLastName('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddUser}
              disabled={addUserMutation.isPending}
            >
              {addUserMutation.isPending && (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
}