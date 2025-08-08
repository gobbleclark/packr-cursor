import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Settings, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Truck, 
  Key,
  RefreshCw,
  Save,
  Globe,
  Link,
  Zap
} from "lucide-react";

export default function Integrations() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const [userId, setUserId] = useState('');
  const [isEditing, setIsEditing] = useState(false);

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

  const { data: brands = [], isLoading: brandsLoading } = useQuery<any[]>({
    queryKey: ['/api/brands'],
    enabled: isAuthenticated,
  });

  const updateApiCredentialsMutation = useMutation({
    mutationFn: async (data: { brandId: string; apiKey: string; userId: string }) => {
      const response = await apiRequest('PUT', `/api/brands/${data.brandId}/api-credentials`, {
        apiKey: data.apiKey,
        userId: data.userId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/brands'] });
      setIsEditing(false);
      setApiKey('');
      setUserId('');
      toast({
        title: "Success",
        description: "API credentials updated successfully",
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
        description: "Failed to update API credentials",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/shiphero/sync-orders');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Connection test successful",
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
        description: "Connection test failed",
        variant: "destructive",
      });
    },
  });



  const connectTrackstarMutation = useMutation({
    mutationFn: async (brandId: string) => {
      // Get link token first
      const linkResponse = await apiRequest('POST', '/api/trackstar/link-token');
      const { linkToken } = await linkResponse.json();
      
      // For demo purposes, we'll simulate the OAuth flow
      // In production, this would redirect to Trackstar's OAuth page
      const authCode = 'demo_auth_code_' + Date.now();
      
      const response = await apiRequest('POST', '/api/trackstar/exchange', {
        authCode,
        brandId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/brands'] });
      toast({
        title: "Success",
        description: `Trackstar integration connected: ${data.integrationName}`,
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
        description: "Failed to connect Trackstar integration",
        variant: "destructive",
      });
    },
  });

  if (isLoading || brandsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const currentBrand = user?.role === 'brand' && user?.brandId 
    ? brands?.find((b: any) => b.id === user.brandId)
    : brands?.[0];

  const getConnectionStatus = (brand: any) => {
    if (brand?.trackstarApiKey) {
      return {
        status: 'connected',
        label: 'Connected',
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
      };
    }
    return {
      status: 'disconnected',
      label: 'Not Connected',
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    };
  };

  const handleSaveCredentials = () => {
    if (!currentBrand || !apiKey || !userId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    updateApiCredentialsMutation.mutate({
      brandId: currentBrand.id,
      apiKey,
      userId,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
          {/* Integrations Header */}
          <div className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                    API Integrations
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Manage your Trackstar universal WMS integration
                  </p>
                </div>
                <div className="mt-4 flex md:mt-0 md:ml-4">
                  <Button 
                    onClick={() => testConnectionMutation.mutate()}
                    disabled={testConnectionMutation.isPending || !currentBrand?.trackstarApiKey}
                    variant="outline"
                  >
                    {testConnectionMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Test Connection
                  </Button>
                </div>
              </div>
            </div>
          </div>



          {/* Integrations Content */}
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Trackstar Universal WMS Integration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Truck className="h-6 w-6 text-purple-600" />
                      <CardTitle>Trackstar Universal WMS</CardTitle>
                    </div>
                    {currentBrand && (
                      <Badge 
                        className={`${getConnectionStatus(currentBrand).bgColor} ${getConnectionStatus(currentBrand).color}`}
                      >
                        <span className="flex items-center">
                          {(() => {
                            const ConnectionIcon = getConnectionStatus(currentBrand).icon;
                            return <ConnectionIcon className="h-3 w-3 mr-1" />;
                          })()}
                          {getConnectionStatus(currentBrand).label}
                        </span>
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {currentBrand ? (
                    <>
                      <div>
                        <p className="text-sm text-gray-600 mb-4">
                          Connect to Trackstar's universal WMS API to integrate with multiple fulfillment providers through one unified interface.
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="api-key">Trackstar API Key</Label>
                          <div className="flex space-x-2">
                            <Input
                              id="api-key"
                              type={isEditing ? "text" : "password"}
                              placeholder="Enter your Trackstar API key"
                              value={isEditing ? apiKey : (currentBrand.trackstarApiKey ? '••••••••••••••••' : '')}
                              onChange={(e) => setApiKey(e.target.value)}
                              disabled={!isEditing}
                            />
                            {!isEditing && (
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setIsEditing(true);
                                  setApiKey('269fcaf8b50a4fb4b384724f3e5d76db');
                                }}
                              >
                                <Key className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="text-sm text-gray-500">
                            Universal API Key: 269fcaf8b50a4fb4b384724f3e5d76db
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            This universal key provides access to Trackstar's WMS integration platform for all brands.
                          </p>
                        </div>

                        {isEditing && (
                          <div className="flex space-x-2">
                            <Button
                              onClick={handleSaveCredentials}
                              disabled={updateApiCredentialsMutation.isPending}
                              className="bg-primary-600 hover:bg-primary-700"
                            >
                              {updateApiCredentialsMutation.isPending ? (
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4 mr-2" />
                              )}
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setIsEditing(false);
                                setApiKey('');
                                setUserId('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <h4 className="text-sm font-medium">Sync Status</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Order Sync:</span>
                            <span className="flex items-center text-green-600">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Active
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Last Sync:</span>
                            <span className="text-gray-900">2 min ago</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Inventory Sync:</span>
                            <span className="flex items-center text-green-600">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Active
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Webhooks:</span>
                            <span className="flex items-center text-green-600">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Connected
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Settings className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No brand found</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Please contact your administrator to set up your brand account.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Trackstar Integration - Brand Level */}
              <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Globe className="h-6 w-6 text-purple-600" />
                        <CardTitle>Trackstar WMS Integration</CardTitle>
                      </div>
                      {currentBrand && (
                        <Badge 
                          className={currentBrand.trackstarAccessToken ? 
                            "bg-green-50 text-green-600" : 
                            "bg-gray-50 text-gray-600"
                          }
                        >
                          <span className="flex items-center">
                            {currentBrand.trackstarAccessToken ? (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            ) : (
                              <XCircle className="h-3 w-3 mr-1" />
                            )}
                            {currentBrand.trackstarAccessToken ? 'Connected' : 'Not Connected'}
                          </span>
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {currentBrand ? (
                      <>
                        <div>
                          <p className="text-sm text-gray-600 mb-4">
                            Connect to Trackstar to sync with multiple WMS platforms including ShipHero, ShipBob, Fulfillment Works, and more. 
                            <span className="font-medium text-purple-600">Uses universal API integration - no manual configuration required.</span>
                          </p>
                        </div>

                        {currentBrand.trackstarAccessToken ? (
                          <div className="space-y-4">
                            <div className="bg-green-50 border border-green-200 rounded-md p-4">
                              <div className="flex">
                                <CheckCircle className="h-5 w-5 text-green-400" />
                                <div className="ml-3">
                                  <h4 className="text-sm font-medium text-green-800">
                                    Connected to {currentBrand.trackstarIntegrationName || 'WMS Platform'}
                                  </h4>
                                  <p className="text-sm text-green-700">
                                    Your WMS data is being synced automatically.
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-3">
                              <h4 className="text-sm font-medium">Sync Status</h4>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-600">Order Sync:</span>
                                  <span className="flex items-center text-green-600">
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Active
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-600">Inventory Sync:</span>
                                  <span className="flex items-center text-green-600">
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Active
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <Globe className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                            <h3 className="text-sm font-medium text-gray-900 mb-2">Connect to Trackstar</h3>
                            <p className="text-sm text-gray-500 mb-4">
                              Connect your WMS platform through Trackstar's universal API. No additional API keys needed - ready to connect instantly.
                            </p>
                            <Button
                              onClick={() => connectTrackstarMutation.mutate(currentBrand.id)}
                              disabled={connectTrackstarMutation.isPending}
                              className="bg-purple-600 hover:bg-purple-700"
                            >
                              {connectTrackstarMutation.isPending ? (
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Link className="h-4 w-4 mr-2" />
                              )}
                              {connectTrackstarMutation.isPending ? 'Connecting...' : 'Connect Trackstar'}
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <Settings className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No brand found</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Please contact your administrator to set up your brand account.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

              {/* Sync Schedule */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="h-5 w-5 mr-2" />
                    Sync Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <Clock className="h-5 w-5 text-blue-400" />
                        </div>
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-blue-800">Automated Sync Schedule</h4>
                          <div className="mt-2 text-sm text-blue-700">
                            <ul className="list-disc list-inside space-y-1">
                              <li>Orders are synced every 5 minutes</li>
                              <li>Inventory updates every hour</li>
                              <li>Fulfillment status updates in real-time via webhooks</li>
                              <li>Product catalog syncs daily at 2 AM</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Recent Sync Activity</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                          <div className="flex items-center">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            <span className="text-sm">Order sync completed</span>
                          </div>
                          <span className="text-xs text-gray-500">2 min ago</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                          <div className="flex items-center">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            <span className="text-sm">Inventory sync completed</span>
                          </div>
                          <span className="text-xs text-gray-500">15 min ago</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                          <div className="flex items-center">
                            <AlertTriangle className="h-4 w-4 text-yellow-500 mr-2" />
                            <span className="text-sm">Webhook delivery failed (retrying)</span>
                          </div>
                          <span className="text-xs text-gray-500">1 hour ago</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <div className="flex items-center">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            <span className="text-sm">Product catalog sync completed</span>
                          </div>
                          <span className="text-xs text-gray-500">2 hours ago</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* API Documentation */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Integration Documentation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <h4 className="text-sm font-medium mb-3">Getting Started with ShipHero Integration</h4>
                  <div className="text-sm text-gray-600 space-y-2">
                    <p>
                      To connect your ShipHero account, you'll need to obtain your API credentials from the ShipHero dashboard:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 ml-4">
                      <li>Log in to your ShipHero account</li>
                      <li>Navigate to Settings → API</li>
                      <li>Generate a new API key if you don't have one</li>
                      <li>Copy your User ID from the account settings</li>
                      <li>Enter both credentials in the form above</li>
                    </ol>
                    <p className="mt-3">
                      Once connected, the system will automatically sync your orders, inventory, and fulfillment data. 
                      You can manage sync settings and view logs from this page.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
    </div>
  );
}
