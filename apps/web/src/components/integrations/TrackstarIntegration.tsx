'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ExternalLink, RefreshCw, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react';

interface TrackstarIntegrationProps {
  brandId: string;
  onIntegrationChange?: () => void;
}

interface IntegrationData {
  id: string;
  status: string;
  integrationName: string;
  connectionId: string;
  lastSyncedAt: string | null;
  lastWebhookAt: string | null;
  availableActions: string[];
}

interface HealthData {
  integration: {
    status: string;
    lastSyncedAt: string | null;
    lastWebhookAt: string | null;
    connectionId: string;
    integrationName: string;
  };
  connection: any;
  queues: {
    sync: any;
    webhook: any;
  };
  recentWebhooks: Array<{
    eventType: string;
    status: string;
    createdAt: string;
    error: string | null;
  }>;
}

export default function TrackstarIntegration({ brandId, onIntegrationChange }: TrackstarIntegrationProps) {
  const [integration, setIntegration] = useState<IntegrationData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTrackstarLink, setShowTrackstarLink] = useState(false);

  useEffect(() => {
    loadIntegration();
  }, [brandId]);

  const loadIntegration = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/brands/${brandId}/integrations/trackstar`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setIntegration(data.integration);
        await loadHealth();
      } else if (response.status === 404) {
        setIntegration(null);
      } else {
        throw new Error('Failed to load integration');
      }
    } catch (error) {
      setError('Failed to load integration details');
      console.error('Error loading integration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadHealth = async () => {
    try {
      const response = await fetch(`/api/brands/${brandId}/integrations/trackstar/health`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHealth(data.health);
      }
    } catch (error) {
      console.error('Error loading health:', error);
    }
  };

  const createLinkToken = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      const response = await fetch(`/api/brands/${brandId}/integrations/trackstar/link-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const data = await response.json();
        // Open Trackstar Link in a new window
        const trackstarLinkUrl = `https://link.trackstarhq.com?link_token=${data.linkToken}`;
        window.open(trackstarLinkUrl, '_blank', 'width=800,height=600');
        
        // Show instructions for completing the connection
        setShowTrackstarLink(true);
      } else {
        throw new Error('Failed to create link token');
      }
    } catch (error) {
      setError('Failed to create link token');
      console.error('Error creating link token:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleManualSync = async (functions: string[]) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/brands/${brandId}/integrations/trackstar/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ functionsToSync: functions }),
      });

      if (response.ok) {
        // Reload health data after sync
        await loadHealth();
        onIntegrationChange?.();
      } else {
        throw new Error('Failed to trigger sync');
      }
    } catch (error) {
      setError('Failed to trigger manual sync');
      console.error('Error triggering sync:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectIntegration = async () => {
    if (!confirm('Are you sure you want to disconnect this integration? This will stop all data synchronization.')) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/brands/${brandId}/integrations/trackstar`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        setIntegration(null);
        setHealth(null);
        onIntegrationChange?.();
      } else {
        throw new Error('Failed to disconnect integration');
      }
    } catch (error) {
      setError('Failed to disconnect integration');
      console.error('Error disconnecting integration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
      case 'PENDING':
        return <Badge variant="secondary">Pending</Badge>;
      case 'ERROR':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getWebhookStatusIcon = (status: string) => {
    switch (status) {
      case 'PROCESSED':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'FAILED':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'PENDING':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="ml-2">Loading integration...</span>
        </CardContent>
      </Card>
    );
  }

  if (!integration) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="w-5 h-5" />
            Trackstar Integration
          </CardTitle>
          <CardDescription>
            Connect your WMS through Trackstar to automatically sync orders, products, inventory, and shipments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <Button 
            onClick={createLinkToken} 
            disabled={isConnecting}
            className="w-full"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4 mr-2" />
                Connect WMS via Trackstar
              </>
            )}
          </Button>

          {showTrackstarLink && (
            <Alert className="mt-4">
              <AlertDescription>
                <strong>Trackstar Link opened!</strong> Complete the connection in the new window. 
                Once connected, return here and refresh to see your integration status.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              Trackstar Integration
            </span>
            {getStatusBadge(integration.status)}
          </CardTitle>
          <CardDescription>
            Connected to {integration.integrationName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Connection ID:</span>
              <p className="text-gray-600 font-mono text-xs">{integration.connectionId}</p>
            </div>
            <div>
              <span className="font-medium">Last Synced:</span>
              <p className="text-gray-600">
                {integration.lastSyncedAt 
                  ? new Date(integration.lastSyncedAt).toLocaleString()
                  : 'Never'
                }
              </p>
            </div>
            <div>
              <span className="font-medium">Last Webhook:</span>
              <p className="text-gray-600">
                {integration.lastWebhookAt 
                  ? new Date(integration.lastWebhookAt).toLocaleString()
                  : 'Never'
                }
              </p>
            </div>
            <div>
              <span className="font-medium">Available Actions:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {integration.availableActions.map((action, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {action}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleManualSync(['get_orders', 'get_products', 'get_inventory', 'get_shipments'])}
              disabled={isLoading}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync All Data
            </Button>
            <Button
              variant="outline"
              onClick={() => handleManualSync(['get_orders'])}
              disabled={isLoading}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Orders
            </Button>
            <Button
              variant="destructive"
              onClick={disconnectIntegration}
              disabled={isLoading}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Health Status */}
      {health && (
        <Card>
          <CardHeader>
            <CardTitle>Integration Health</CardTitle>
            <CardDescription>
              Real-time status of your Trackstar integration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-medium">Queue Status:</span>
                <div className="text-sm text-gray-600 mt-1">
                  <p>Sync: {health.queues.sync.waiting || 0} waiting</p>
                  <p>Webhook: {health.queues.webhook.waiting || 0} waiting</p>
                </div>
              </div>
              <div>
                <span className="font-medium">Recent Webhooks:</span>
                <div className="text-sm text-gray-600 mt-1">
                  {health.recentWebhooks.slice(0, 3).map((webhook, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {getWebhookStatusIcon(webhook.status)}
                      <span className="text-xs">{webhook.eventType}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
