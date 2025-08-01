import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  Play, 
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

export function SyncStatusDialog({ brandId, brandName, isOpen, onClose }: SyncStatusProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: syncStatus, isLoading } = useQuery({
    queryKey: [`/api/brands/${brandId}/sync-status`],
    enabled: isOpen,
    refetchInterval: 10000, // Refresh every 10 seconds when dialog is open
  });

  const { data: webhookStatus } = useQuery({
    queryKey: [`/api/brands/${brandId}/webhook-status`],
    enabled: isOpen,
  });

  // Manual sync mutations for different data types
  const syncOrdersMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/brands/${brandId}/sync/orders`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Orders Sync Complete",
        description: `Processed ${data.results.orders} orders`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/brands/${brandId}/sync-status`] });
    },
    onError: (error) => {
      toast({
        title: "Orders Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const syncProductsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/brands/${brandId}/sync/products`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Products Sync Complete",
        description: `Processed ${data.results.products} products`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/brands/${brandId}/sync-status`] });
    },
    onError: (error) => {
      toast({
        title: "Products Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const syncShipmentsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/brands/${brandId}/sync/shipments`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Shipments Sync Complete",
        description: `Processed ${data.results.shipments} shipments`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/brands/${brandId}/sync-status`] });
    },
    onError: (error) => {
      toast({
        title: "Shipments Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const initialSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/brands/${brandId}/sync/initial`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Initial Sync Complete",
        description: `Historical data: ${data.results.orders} orders, ${data.results.products} products, ${data.results.shipments} shipments`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/brands/${brandId}/sync-status`] });
    },
    onError: (error) => {
      toast({
        title: "Initial Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Success</Badge>;
      case 'running':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Running</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sync Status - {brandName}</DialogTitle>
            <DialogDescription>
              Loading sync status and webhook information...
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Sync Status - {brandName}
          </DialogTitle>
          <DialogDescription>
            Monitor and control data synchronization with ShipHero
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Webhook Status */}
          {webhookStatus && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-500" />
                  Real-time Webhooks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{webhookStatus.status}</p>
                    <p className="text-sm text-muted-foreground">
                      {webhookStatus.registeredEvents?.length || 0} events registered
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Active
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Initial Sync */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-500" />
                Initial Data Pull
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-medium">Historical Data (1 Week)</p>
                  <p className="text-sm text-muted-foreground">
                    One-time pull of orders, products, and shipments
                  </p>
                </div>
                <Button
                  onClick={() => initialSyncMutation.mutate()}
                  disabled={initialSyncMutation.isPending}
                  size="sm"
                >
                  {initialSyncMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Run Initial Sync
                </Button>
              </div>
              {syncStatus?.initialSync && (
                <div className="text-sm text-muted-foreground">
                  Last run: {new Date(syncStatus.initialSync.lastRun).toLocaleString()}
                  {getStatusBadge(syncStatus.initialSync.status)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sync Jobs */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Orders Sync */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4 text-blue-500" />
                  Orders
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  {getStatusIcon(syncStatus?.orders?.status || 'pending')}
                  {getStatusBadge(syncStatus?.orders?.status || 'pending')}
                </div>
                
                <div className="text-sm space-y-1">
                  <p>
                    <span className="font-medium">Last sync:</span>{' '}
                    {syncStatus?.orders?.lastSync 
                      ? new Date(syncStatus.orders.lastSync).toLocaleString()
                      : 'Never'
                    }
                  </p>
                  <p>
                    <span className="font-medium">Frequency:</span> Every 2 minutes
                  </p>
                  <p>
                    <span className="font-medium">Records:</span>{' '}
                    {syncStatus?.orders?.recordCount || 0}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncOrdersMutation.mutate()}
                  disabled={syncOrdersMutation.isPending}
                  className="w-full"
                >
                  {syncOrdersMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Sync Now
                </Button>
              </CardContent>
            </Card>

            {/* Products Sync */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4 text-green-500" />
                  Products
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  {getStatusIcon(syncStatus?.products?.status || 'pending')}
                  {getStatusBadge(syncStatus?.products?.status || 'pending')}
                </div>
                
                <div className="text-sm space-y-1">
                  <p>
                    <span className="font-medium">Last sync:</span>{' '}
                    {syncStatus?.products?.lastSync 
                      ? new Date(syncStatus.products.lastSync).toLocaleString()
                      : 'Never'
                    }
                  </p>
                  <p>
                    <span className="font-medium">Frequency:</span> Every 15 minutes
                  </p>
                  <p>
                    <span className="font-medium">Records:</span>{' '}
                    {syncStatus?.products?.recordCount || 0}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncProductsMutation.mutate()}
                  disabled={syncProductsMutation.isPending}
                  className="w-full"
                >
                  {syncProductsMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Sync Now
                </Button>
              </CardContent>
            </Card>

            {/* Shipments Sync */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="h-4 w-4 text-orange-500" />
                  Shipments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  {getStatusIcon(syncStatus?.shipments?.status || 'pending')}
                  {getStatusBadge(syncStatus?.shipments?.status || 'pending')}
                </div>
                
                <div className="text-sm space-y-1">
                  <p>
                    <span className="font-medium">Last sync:</span>{' '}
                    {syncStatus?.shipments?.lastSync 
                      ? new Date(syncStatus.shipments.lastSync).toLocaleString()
                      : 'Never'
                    }
                  </p>
                  <p>
                    <span className="font-medium">Frequency:</span> Every 2 minutes
                  </p>
                  <p>
                    <span className="font-medium">Records:</span>{' '}
                    {syncStatus?.shipments?.recordCount || 0}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncShipmentsMutation.mutate()}
                  disabled={syncShipmentsMutation.isPending}
                  className="w-full"
                >
                  {syncShipmentsMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Sync Now
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sync Strategy */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sync Strategy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>Primary:</strong> Real-time webhooks for instant updates</p>
                <p><strong>Backup:</strong> Scheduled sync jobs to catch missed webhooks</p>
                <p><strong>Failsafe:</strong> Manual sync buttons for immediate data pull</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}