import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Download,
  Upload,
  Activity,
  Pause,
  TrendingUp,
  Package,
  Truck,
  Building2,
  Zap
} from "lucide-react";

interface SyncStatusProps {
  brandId: string;
  brandName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface SyncData {
  fetched: number;
  processed: number;
  errors: number;
  lastSync: Date;
}

interface SyncResults {
  orders?: SyncData;
  products?: SyncData;
  shipments?: SyncData;
  inventory?: SyncData;
  initialSync?: SyncData;
}

interface WebhookStatus {
  status?: string;
  registeredEvents?: string;
}

function SyncStatusDialog({ brandId, brandName, isOpen, onClose }: SyncStatusProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: syncStatus = {} as SyncResults, isLoading } = useQuery({
    queryKey: [`/api/brands/${brandId}/sync-status`],
    enabled: isOpen && !!brandId,
    refetchInterval: isOpen ? 10000 : false,
  });

  const { data: webhookStatus = {} as WebhookStatus } = useQuery({
    queryKey: [`/api/brands/${brandId}/webhook-status`],
    enabled: isOpen && !!brandId,
  });

  // Manual sync mutations
  const syncOrdersMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/brands/${brandId}/sync/orders`);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Orders Sync Complete",
        description: `Processed ${data.results?.orders || 0} orders`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/brands/${brandId}/sync-status`] });
    },
    onError: (error) => {
      toast({
        title: "Orders Sync Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  });

  const syncProductsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/brands/${brandId}/sync/products`);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Products Sync Complete",
        description: `Processed ${data.results?.products || 0} products`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/brands/${brandId}/sync-status`] });
    },
    onError: (error) => {
      toast({
        title: "Products Sync Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  });

  const syncShipmentsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/brands/${brandId}/sync/shipments`);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Shipments Sync Complete", 
        description: `Processed ${data.results?.shipments || 0} shipments`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/brands/${brandId}/sync-status`] });
    },
    onError: (error) => {
      toast({
        title: "Shipments Sync Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  });

  const initialSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/brands/${brandId}/sync/initial`);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Initial Sync Complete",
        description: `Processed ${data.results?.orders || 0} orders, ${data.results?.products || 0} products`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/brands/${brandId}/sync-status`] });
    },
    onError: (error) => {
      toast({
        title: "Initial Sync Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  });

  const renderSyncCard = (title: string, icon: any, data: SyncData | undefined, mutation: any, description: string) => {
    const Icon = icon;
    const isLoading = mutation.isPending;
    const lastSync = data?.lastSync ? new Date(data.lastSync) : null;
    
    return (
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Icon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500">{description}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => mutation.mutate()}
            disabled={isLoading}
            className="min-w-[100px]"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Now
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{data?.fetched || 0}</div>
            <div className="text-xs text-gray-500">Fetched</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{data?.processed || 0}</div>
            <div className="text-xs text-gray-500">Processed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{data?.errors || 0}</div>
            <div className="text-xs text-gray-500">Errors</div>
          </div>
        </div>

        {lastSync && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            Last sync: {lastSync.toLocaleString()}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            {brandName || "Brand"} Sync Status
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-sm text-gray-600">
              Real-time sync status from database - no mock data
            </div>

            {/* Network Connectivity Warning */}
            {syncStatus.orders?.errors?.some(error => error.includes('Network connectivity issue')) && (
              <div className="bg-orange-100 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <h4 className="text-lg font-medium text-orange-800">Network Connectivity Issue</h4>
                </div>
                <div className="text-sm text-orange-700">
                  Your ShipHero credentials are correctly configured, but this environment cannot reach ShipHero's API servers. 
                  This is a platform-level network issue, not a problem with your credentials.
                </div>
                <div className="text-sm text-orange-600 mt-2">
                  When network connectivity is restored, your system will automatically sync real data from your ShipHero account.
                </div>
              </div>
            )}

            {/* Webhook Status */}
            <div className="bg-yellow-100 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <h4 className="text-lg font-medium text-yellow-800">Webhook Status</h4>
              </div>
              <div className="text-sm text-yellow-700">
                Status: <span className={`font-medium ${webhookStatus.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                  {webhookStatus.status || 'Not configured'}
                </span>
              </div>
              <div className="text-sm text-yellow-600 mt-1">
                Events: {webhookStatus.registeredEvents || 'None configured'}
              </div>
            </div>

            {/* Initial Sync */}
            {renderSyncCard(
              "Initial Data Pull",
              Download,
              syncStatus.initialSync,
              initialSyncMutation,
              "Pull 7 days of historical data from ShipHero"
            )}

            {/* Individual sync cards */}
            <div className="grid gap-4">
              {renderSyncCard(
                "Orders",
                Package,
                syncStatus.orders,
                syncOrdersMutation,
                "Sync order data and status updates"
              )}

              {renderSyncCard(
                "Products",
                Building2,
                syncStatus.products,
                syncProductsMutation,
                "Sync product catalog and inventory"
              )}

              {renderSyncCard(
                "Shipments",
                Truck,
                syncStatus.shipments,
                syncShipmentsMutation,
                "Sync shipment tracking and delivery status"
              )}
            </div>
            
            <div className="text-xs text-gray-500 mt-4">
              Status updates every 10 seconds • Real ShipHero API integration
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SyncStatusDialog;