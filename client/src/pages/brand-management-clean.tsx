import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Building2, 
  Mail, 
  Users, 
  Copy, 
  CheckCircle, 
  XCircle, 
  Clock,
  Settings,
  RefreshCw,
  Zap,
  TrendingUp
} from "lucide-react";
import { SyncStatusModal } from "@/components/sync-status-modal";

export default function BrandManagementClean() {
  // All hooks declared at top level in consistent order
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
  
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [brandEmail, setBrandEmail] = useState('');
  const [isIntegrationDialogOpen, setIsIntegrationDialogOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<any>(null);
  const [integrationType, setIntegrationType] = useState('');
  const [shipHeroUsername, setShipHeroUsername] = useState('');
  const [shipHeroPassword, setShipHeroPassword] = useState('');
  const [syncStatusDialogOpen, setSyncStatusDialogOpen] = useState(false);
  const [selectedBrandForSync, setSelectedBrandForSync] = useState<any>(null);

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
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/brands'] });
      setBrandName('');
      setBrandEmail('');
      setIsInviteDialogOpen(false);
      
      toast({
        title: "Brand Invitation Created",
        description: "Copy the invitation link and send it to the brand.",
      });
      
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
    mutationFn: async (data: { brandId: string; shipHeroUsername: string; shipHeroPassword: string }) => {
      const response = await apiRequest('PUT', `/api/brands/${data.brandId}/integrations`, {
        integrationType: 'shiphero',
        shipHeroUsername: data.shipHeroUsername,
        shipHeroPassword: data.shipHeroPassword
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/brands'] });
      setIsIntegrationDialogOpen(false);
      setSelectedBrand(null);
      setIntegrationType('');
      setShipHeroUsername('');
      setShipHeroPassword('');
      toast({
        title: "Integration Added",
        description: "ShipHero integration has been configured successfully!",
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

  const setupWebhooksMutation = useMutation({
    mutationFn: async (brandId: string) => {
      const response = await apiRequest('POST', `/api/brands/${brandId}/webhooks/setup`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Webhooks Configured",
        description: `${data.registeredEvents?.length || 0} webhook events registered for real-time sync`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/brands'] });
    },
    onError: (error) => {
      toast({
        title: "Webhook Setup Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const syncDataMutation = useMutation({
    mutationFn: async (brandId: string) => {
      const response = await apiRequest('POST', `/api/brands/${brandId}/sync`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sync Complete",
        description: `Synced ${data.results.orders} orders, ${data.results.products} products`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/brands'] });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    }
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

  // Early returns after all hooks
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

  const handleAddIntegration = (brand: any) => {
    setSelectedBrand(brand);
    setIsIntegrationDialogOpen(true);
  };

  const handleSaveIntegration = () => {
    if (!selectedBrand || !shipHeroUsername || !shipHeroPassword) {
      toast({
        title: "Error",
        description: "Please fill in all ShipHero credentials",
        variant: "destructive",
      });
      return;
    }

    addIntegrationMutation.mutate({
      brandId: selectedBrand.id,
      shipHeroUsername,
      shipHeroPassword
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Brand Management</h1>
            <Button onClick={() => setIsInviteDialogOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Invite Brand
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Brands ({brands.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {brands.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No brands</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by inviting your first brand.</p>
                  <div className="mt-6">
                    <Button onClick={() => setIsInviteDialogOpen(true)} className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Invite Brand
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {brands.map((brand: any) => (
                    <div key={brand.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{brand.name}</h3>
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {brand.contactEmail}
                          </p>
                        </div>
                        <Badge variant={brand.status === 'active' ? 'default' : 'secondary'}>
                          {brand.status === 'active' ? 'Active' : 'Invited'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        {brand.hasShipHeroIntegration ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className={brand.hasShipHeroIntegration ? "text-green-700" : "text-red-700"}>
                          {brand.hasShipHeroIntegration ? "ShipHero Connected" : "No Integration"}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {!brand.hasShipHeroIntegration ? (
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
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => syncDataMutation.mutate(brand.id)}
                              disabled={syncDataMutation.isPending}
                              className="flex items-center gap-2"
                            >
                              {syncDataMutation.isPending ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                              <span className="hidden sm:inline">Sync Data</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setupWebhooksMutation.mutate(brand.id)}
                              disabled={setupWebhooksMutation.isPending}
                              className="flex items-center gap-2"
                            >
                              {setupWebhooksMutation.isPending ? (
                                <Zap className="h-4 w-4 animate-pulse" />
                              ) : (
                                <Zap className="h-4 w-4" />
                              )}
                              <span className="hidden sm:inline">Setup Webhooks</span>
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invite Brand Dialog */}
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Invite Brand</DialogTitle>
                <DialogDescription>
                  Send an invitation to a new brand to join your 3PL platform.
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
                  variant="outline"
                  onClick={() => {
                    setIsInviteDialogOpen(false);
                    setBrandName('');
                    setBrandEmail('');
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleInviteBrand} disabled={inviteBrandMutation.isPending}>
                  {inviteBrandMutation.isPending && (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add Integration Dialog */}
          <Dialog open={isIntegrationDialogOpen} onOpenChange={setIsIntegrationDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add Integration for {selectedBrand?.name}</DialogTitle>
                <DialogDescription>
                  Configure ShipHero API integration for this brand to enable order and inventory sync.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="shiphero-username">ShipHero Username</Label>
                  <Input
                    id="shiphero-username"
                    value={shipHeroUsername}
                    onChange={(e) => setShipHeroUsername(e.target.value)}
                    placeholder="Enter your ShipHero username"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="shiphero-password">ShipHero Password</Label>
                  <Input
                    id="shiphero-password"
                    type="password"
                    value={shipHeroPassword}
                    onChange={(e) => setShipHeroPassword(e.target.value)}
                    placeholder="Enter your ShipHero password"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsIntegrationDialogOpen(false);
                    setSelectedBrand(null);
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
                  Save Integration
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Sync Status Modal */}
          {selectedBrandForSync && (
            <SyncStatusModal
              brandId={selectedBrandForSync.id}
              brandName={selectedBrandForSync.name}
              isOpen={syncStatusDialogOpen}
              onClose={() => {
                setSyncStatusDialogOpen(false);
                setSelectedBrandForSync(null);
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}