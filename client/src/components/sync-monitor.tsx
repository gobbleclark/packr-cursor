import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, Clock } from "lucide-react";

interface SyncMonitorProps {
  totalProducts: number;
  syncedProducts: number;
  onSyncComplete?: () => void;
}

export default function SyncMonitor({ totalProducts, syncedProducts, onSyncComplete }: SyncMonitorProps) {
  const { toast } = useToast();
  const [previousSyncedCount, setPreviousSyncedCount] = useState(syncedProducts);
  const [isComplete, setIsComplete] = useState(false);

  const syncPercentage = totalProducts > 0 ? (syncedProducts / totalProducts) * 100 : 0;
  const remainingProducts = totalProducts - syncedProducts;

  useEffect(() => {
    // Check if sync progress increased
    if (syncedProducts > previousSyncedCount && previousSyncedCount > 0) {
      const newlySynced = syncedProducts - previousSyncedCount;
      toast({
        title: "Sync Progress",
        description: `${newlySynced} more products synced. ${remainingProducts} remaining.`,
        variant: "default",
      });
    }

    // Check if sync is complete
    if (syncedProducts === totalProducts && totalProducts > 0 && !isComplete) {
      setIsComplete(true);
      toast({
        title: "Sync Complete!",
        description: `All ${totalProducts} products now have warehouse inventory data.`,
        variant: "default",
      });
      onSyncComplete?.();
    }

    setPreviousSyncedCount(syncedProducts);
  }, [syncedProducts, totalProducts, previousSyncedCount, remainingProducts, isComplete, toast, onSyncComplete]);

  if (totalProducts === 0) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      {isComplete ? (
        <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Sync Complete
        </Badge>
      ) : (
        <Badge variant="secondary" className="flex items-center gap-1">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Syncing {Math.round(syncPercentage)}%
        </Badge>
      )}
      
      {!isComplete && remainingProducts > 0 && (
        <span className="text-gray-600 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {remainingProducts} products pending
        </span>
      )}
    </div>
  );
}