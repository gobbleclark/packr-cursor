'use client';

import { useState, useEffect } from 'react';
import { Settings, CheckCircle, AlertCircle, Trash2, RefreshCw } from 'lucide-react';
import { TrackstarConnectButton } from '@trackstar/react-trackstar-link';
import { authService } from '../../lib/auth';
import { buildApiUrl } from '../../lib/api-config';

interface TrackstarIntegrationProps {
  brandId: string;
  onIntegrationUpdate?: () => void;
}

interface TrackstarConnection {
  id: string;
  connectionId: string;
  integrationName: string;
  status: string;
  createdAt: string;
  lastSyncAt?: string;
}

export default function TrackstarIntegration({ brandId, onIntegrationUpdate }: TrackstarIntegrationProps) {
  const [connection, setConnection] = useState<TrackstarConnection | null>(null);
  const [isLoadingConnection, setIsLoadingConnection] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check for existing connection
  useEffect(() => {
    fetchConnection();
  }, [brandId]);

  const fetchConnection = async () => {
    try {
      setIsLoadingConnection(true);
      const token = authService.getToken();
      const response = await fetch(buildApiUrl(`brands/${brandId}/integrations/trackstar`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Map the integration data to connection format
        if (data.integration) {
          setConnection({
            id: data.integration.id,
            connectionId: data.integration.connectionId,
            integrationName: data.integration.integrationName,
            status: data.integration.status,
            createdAt: data.integration.createdAt,
            lastSyncAt: data.integration.lastSyncedAt
          });
        }
      } else if (response.status !== 404) {
        console.error('Failed to fetch connection');
      }
    } catch (error) {
      console.error('Error fetching connection:', error);
    } finally {
      setIsLoadingConnection(false);
    }
  };

  // Function to get link token for Trackstar component
  const getLinkToken = async (): Promise<string> => {
    try {
      const token = authService.getToken();
      const response = await fetch(buildApiUrl(`brands/${brandId}/integrations/trackstar/link-token`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create link token');
      }

      const data = await response.json();
      return data.linkToken;
    } catch (error) {
      console.error('Error getting link token:', error);
      setError(error instanceof Error ? error.message : 'Failed to create link token');
      throw error;
    }
  };

  // Function to handle successful connection
  const onSuccess = async (authCode: string, integrationName: string) => {
    try {
      setError(null);
      const token = authService.getToken();
      const response = await fetch(buildApiUrl(`brands/${brandId}/integrations/trackstar/exchange`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          authCode,
          integrationName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to complete integration');
      }

      setSuccess(`Successfully connected to ${integrationName}!`);
      
      // Refresh connection data
      await fetchConnection();
      
      // Notify parent component
      if (onIntegrationUpdate) {
        onIntegrationUpdate();
      }

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      console.error('Error completing integration:', error);
      setError(error instanceof Error ? error.message : 'Failed to complete integration');
    }
  };

  const handleDisconnect = async () => {
    if (!connection || !confirm('Are you sure you want to disconnect from Trackstar? This will stop all data syncing.')) {
      return;
    }

    try {
      setIsDisconnecting(true);
      setError(null);
      
      const token = authService.getToken();
      const response = await fetch(buildApiUrl(`brands/${brandId}/integrations/trackstar/disconnect`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to disconnect');
      }

      setConnection(null);
      setSuccess('Successfully disconnected from Trackstar');
      
      if (onIntegrationUpdate) {
        onIntegrationUpdate();
      }

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      console.error('Error disconnecting:', error);
      setError(error instanceof Error ? error.message : 'Failed to disconnect');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSync = async () => {
    if (!connection) return;

    try {
      setIsSyncing(true);
      setError(null);
      
      const token = authService.getToken();
      const response = await fetch(buildApiUrl(`brands/${brandId}/integrations/trackstar/sync`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          functionsToSync: ['get_orders', 'get_products', 'get_inventory', 'get_shipments', 'get_inbound_shipments']
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync');
      }

      setSuccess('Sync initiated successfully');
      
      // Refresh connection data to get updated lastSyncAt
      await fetchConnection();

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      console.error('Error syncing:', error);
      setError(error instanceof Error ? error.message : 'Failed to sync');
    } finally {
      setIsSyncing(false);
    }
  };

  const onClose = () => {
    console.log('Trackstar modal closed');
  };

  const onLoad = () => {
    console.log('Trackstar modal loaded');
  };

  if (isLoadingConnection) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Loading Trackstar integration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Settings className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">Trackstar Integration</h3>
            <p className="text-sm text-gray-500">Connect to your WMS for automated order management</p>
          </div>
        </div>
        
        {connection && (
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium text-green-700">Connected</span>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center">
            <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}

      {connection ? (
        /* Connected State */
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-md p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Integration:</span>
                <p className="text-gray-900 capitalize">{connection.integrationName}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Status:</span>
                <p className="text-gray-900 capitalize">{connection.status}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Connected:</span>
                <p className="text-gray-900">{new Date(connection.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Last Sync:</span>
                <p className="text-gray-900">
                  {connection.lastSyncAt 
                    ? new Date(connection.lastSyncAt).toLocaleString()
                    : 'Never'
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync Now
                </>
              )}
            </button>
            
            <button
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDisconnecting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Disconnect
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Not Connected State */
        <div className="text-center py-6">
          <p className="text-gray-600 mb-6">
            Connect your WMS to automatically sync orders, inventory, and shipments.
          </p>
          
          {/* Official Trackstar Connect Button */}
          <TrackstarConnectButton
            getLinkToken={getLinkToken}
            onSuccess={onSuccess}
            onClose={onClose}
            onLoad={onLoad}
            integrationType="wms"
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.75rem 1.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s'
            }}
          >
            Connect to Trackstar
          </TrackstarConnectButton>
          
          <p className="text-xs text-gray-500 mt-4">
            You'll be guided through connecting your WMS credentials securely.
          </p>
        </div>
      )}
    </div>
  );
}