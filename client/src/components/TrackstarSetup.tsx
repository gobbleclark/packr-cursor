/**
 * Trackstar Universal WMS Setup Component
 * Replaces ShipHero with universal WMS connectivity
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface TrackstarSetupProps {
  brandId: string;
}

export function TrackstarSetup({ brandId }: TrackstarSetupProps) {
  const [credentials, setCredentials] = useState({
    apiKey: '',
    accessToken: '',
    connectionId: ''
  });
  const [showCredentials, setShowCredentials] = useState(false);
  
  const queryClient = useQueryClient();

  // Check current Trackstar integration status
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/trackstar/status', brandId],
    queryFn: () => apiRequest(`/api/trackstar/status/${brandId}`)
  });

  // Setup Trackstar integration
  const setupMutation = useMutation({
    mutationFn: (credentials: any) => 
      apiRequest(`/api/trackstar/setup/${brandId}`, {
        method: 'POST',
        body: JSON.stringify(credentials)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trackstar/status', brandId] });
      setCredentials({ apiKey: '', accessToken: '', connectionId: '' });
      setShowCredentials(false);
    }
  });

  // Manual sync trigger
  const syncMutation = useMutation({
    mutationFn: ({ type = 'incremental', days = 7 }) =>
      apiRequest(`/api/trackstar/sync/${brandId}`, {
        method: 'POST',
        body: JSON.stringify({ type, days })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries();
    }
  });

  // Remove integration
  const removeMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/trackstar/integration/${brandId}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trackstar/status', brandId] });
    }
  });

  const handleSetup = () => {
    setupMutation.mutate(credentials);
  };

  const handleSync = (type: string, days?: number) => {
    syncMutation.mutate({ type, days });
  };

  if (statusLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading Trackstar status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isConnected = status?.hasIntegration;
  const integrationStatus = status?.integrationStatus || 'not_configured';

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Trackstar Universal WMS
              </CardTitle>
              <CardDescription>
                Connect to dozens of warehouse management systems through one universal API
              </CardDescription>
            </div>
            <Badge variant={isConnected ? 'default' : 'secondary'}>
              {isConnected ? 'Connected' : 'Not Connected'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Integration Active</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">API Key:</span>
                  <p className="font-mono">{status?.credentials?.apiKey}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Connection ID:</span>
                  <p className="font-mono">{status?.credentials?.connectionId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Sync:</span>
                  <p>{status?.lastSync ? new Date(status.lastSync).toLocaleString() : 'Never'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Recent Orders:</span>
                  <p>{status?.recentOrdersCount || 0}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={() => handleSync('incremental')}
                  disabled={syncMutation.isPending}
                  size="sm"
                >
                  {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Sync Orders
                </Button>
                <Button 
                  onClick={() => handleSync('products')}
                  disabled={syncMutation.isPending}
                  variant="outline"
                  size="sm"
                >
                  Sync Products
                </Button>
                <Button 
                  onClick={() => handleSync('inventory')}
                  disabled={syncMutation.isPending}
                  variant="outline"
                  size="sm"
                >
                  Sync Inventory
                </Button>
                <Button 
                  onClick={() => removeMutation.mutate()}
                  disabled={removeMutation.isPending}
                  variant="destructive"
                  size="sm"
                  className="ml-auto"
                >
                  {removeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">No Integration Configured</span>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Set up Trackstar to connect your warehouse management system and sync orders, 
                inventory, and shipping data in real-time.
              </p>

              <Button onClick={() => setShowCredentials(true)} className="w-full">
                Connect Trackstar WMS
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credentials Setup */}
      {showCredentials && !isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Setup Trackstar Integration</CardTitle>
            <CardDescription>
              Enter your Trackstar API credentials to connect your warehouse management system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={credentials.apiKey}
                onChange={(e) => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="Your Trackstar API key"
              />
            </div>
            
            <div>
              <Label htmlFor="accessToken">Access Token</Label>
              <Input
                id="accessToken"
                type="password"
                value={credentials.accessToken}
                onChange={(e) => setCredentials(prev => ({ ...prev, accessToken: e.target.value }))}
                placeholder="Access token for your warehouse connection"
              />
            </div>
            
            <div>
              <Label htmlFor="connectionId">Connection ID</Label>
              <Input
                id="connectionId"
                value={credentials.connectionId}
                onChange={(e) => setCredentials(prev => ({ ...prev, connectionId: e.target.value }))}
                placeholder="Warehouse connection identifier"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleSetup}
                disabled={setupMutation.isPending || !credentials.apiKey || !credentials.accessToken || !credentials.connectionId}
                className="flex-1"
              >
                {setupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Connect Integration
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowCredentials(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Messages */}
      {setupMutation.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Setup failed: {setupMutation.error.message}
          </AlertDescription>
        </Alert>
      )}

      {syncMutation.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Sync failed: {syncMutation.error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Success Messages */}
      {setupMutation.isSuccess && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Trackstar integration setup completed successfully! Initial data sync is in progress.
          </AlertDescription>
        </Alert>
      )}

      {syncMutation.isSuccess && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Sync completed successfully!
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}