import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface SyncResult {
  success: boolean;
  strategiesCompleted: string[];
  dataCollected: {
    orders: number;
    products: number;
    shipments: number;
  };
  creditsUsed: number;
  nextSyncRecommendation: string;
}

interface SyncStatus {
  brandId: string;
  availableCredits: number;
  completedStrategies: string[];
  failedStrategies: string[];
  dataCollected: {
    orders: number;
    products: number;
    shipments: number;
  };
}

const strategies = [
  { name: 'critical_orders_today', description: "Today's Critical Orders", creditCost: 150, priority: 1 },
  { name: 'recent_orders_minimal', description: 'Recent Orders (Minimal)', creditCost: 300, priority: 2 },
  { name: 'product_inventory_summary', description: 'Product Inventory Summary', creditCost: 400, priority: 3 },
  { name: 'orders_with_line_items', description: 'Orders with Line Items', creditCost: 800, priority: 4 },
  { name: 'full_product_details', description: 'Full Product Details', creditCost: 1200, priority: 5 }
];

export default function CreditEfficientDemo() {
  const [selectedBrandId] = useState('dce4813e-aeb7-41fe-bb00-a36e314288f3'); // Mabē brand
  const queryClient = useQueryClient();
  
  // Query sync status
  const { data: syncStatus, refetch: refetchStatus } = useQuery<SyncStatus>({
    queryKey: ['/api/brands', selectedBrandId, 'sync/status'],
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Credit-efficient sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/brands/${selectedBrandId}/sync/credit-efficient`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/brands', selectedBrandId] });
      refetchStatus();
    },
  });

  // Reset sync session mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/brands/${selectedBrandId}/sync/reset`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      refetchStatus();
    },
  });

  const getStrategyStatus = (strategyName: string) => {
    if (!syncStatus) return 'pending';
    if (syncStatus.completedStrategies?.includes(strategyName)) return 'completed';
    if (syncStatus.failedStrategies?.includes(strategyName)) return 'failed';
    return 'pending';
  };

  const getTotalCreditsUsed = () => {
    if (!syncStatus?.completedStrategies) return 0;
    return syncStatus.completedStrategies.reduce((total, strategyName) => {
      const strategy = strategies.find(s => s.name === strategyName);
      return total + (strategy?.creditCost || 0);
    }, 0);
  };

  const getProgressPercentage = () => {
    if (!syncStatus?.completedStrategies) return 0;
    return (syncStatus.completedStrategies.length / strategies.length) * 100;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credit-Efficient Sync Demo</h1>
          <p className="text-muted-foreground">
            Intelligent ShipHero API synchronization that maximizes data collection within credit limits
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            {syncMutation.isPending ? 'Syncing...' : 'Start Credit-Efficient Sync'}
          </Button>
          <Button
            variant="outline"
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
          >
            Reset Session
          </Button>
        </div>
      </div>

      {/* Credit Usage Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Credit Management
          </CardTitle>
          <CardDescription>
            ShipHero account limit: 2,002 credits per operation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{getTotalCreditsUsed()}</div>
              <div className="text-sm text-muted-foreground">Credits Used</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {syncStatus?.availableCredits || 2002}
              </div>
              <div className="text-sm text-muted-foreground">Credits Remaining</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {syncStatus?.completedStrategies?.length || 0}/{strategies.length}
              </div>
              <div className="text-sm text-muted-foreground">Strategies Completed</div>
            </div>
          </div>
          
          <Progress value={getProgressPercentage()} className="mb-2" />
          <div className="text-sm text-muted-foreground text-center">
            {getProgressPercentage().toFixed(0)}% of sync strategies completed
          </div>
        </CardContent>
      </Card>

      {/* Data Collection Results */}
      <Card>
        <CardHeader>
          <CardTitle>Data Collection Results</CardTitle>
          <CardDescription>Real-time data synced from ShipHero API</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">
                {syncStatus?.dataCollected?.orders || 0}
              </div>
              <div className="text-sm text-muted-foreground">Orders Synced</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="text-3xl font-bold text-green-600">
                {syncStatus?.dataCollected?.products || 0}
              </div>
              <div className="text-sm text-muted-foreground">Products Synced</div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
              <div className="text-3xl font-bold text-purple-600">
                {syncStatus?.dataCollected?.shipments || 0}
              </div>
              <div className="text-sm text-muted-foreground">Shipments Synced</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Strategies */}
      <Card>
        <CardHeader>
          <CardTitle>5-Tier Priority System</CardTitle>
          <CardDescription>
            Strategies executed in order of business priority and credit efficiency
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {strategies.map((strategy) => {
              const status = getStrategyStatus(strategy.name);
              return (
                <div
                  key={strategy.name}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-sm font-medium">
                      {strategy.priority}
                    </div>
                    <div>
                      <div className="font-medium">{strategy.description}</div>
                      <div className="text-sm text-muted-foreground">
                        Credit Cost: {strategy.creditCost}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {status === 'completed' && (
                      <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Completed
                      </Badge>
                    )}
                    {status === 'failed' && (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Failed
                      </Badge>
                    )}
                    {status === 'pending' && (
                      <Badge variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sync Results */}
      {syncMutation.data && (
        <Card>
          <CardHeader>
            <CardTitle>Latest Sync Results</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-sm overflow-auto">
              {JSON.stringify(syncMutation.data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}