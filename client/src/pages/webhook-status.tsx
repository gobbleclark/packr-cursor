import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Zap, Clock, AlertCircle } from "lucide-react";

interface WebhookStatusProps {
  brandId: string;
  brandName: string;
}

function WebhookStatus({ brandId, brandName }: WebhookStatusProps) {
  const { data: webhookStatus, isLoading } = useQuery({
    queryKey: [`/api/brands/${brandId}/webhook-status`],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Real-time Webhooks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 animate-spin" />
            <span>Checking webhook status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!webhookStatus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Webhooks Not Configured
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Set up webhooks to receive real-time updates for orders, shipments, and inventory changes.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          Real-time Webhooks Active
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">Status</p>
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            {webhookStatus.status}
          </Badge>
        </div>
        
        <div>
          <p className="text-sm font-medium mb-2">Webhook URL</p>
          <code className="text-xs bg-muted p-2 rounded block break-all">
            {webhookStatus.webhookUrl}
          </code>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Active Events ({webhookStatus.registeredEvents?.length || 0})</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {webhookStatus.registeredEvents?.map((event: string) => (
              <Badge key={event} variant="outline" className="text-xs">
                {event}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-1">Last Update</p>
          <p className="text-xs text-muted-foreground">
            {new Date(webhookStatus.lastWebhookReceived).toLocaleString()}
          </p>
        </div>

        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-sm font-medium text-blue-900">Real-time Sync Active</p>
          <p className="text-xs text-blue-700 mt-1">
            Your {brandName} data automatically updates within seconds of changes in ShipHero.
            No manual syncing required for orders, shipments, or inventory.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Main Webhook Status Page Component  
function WebhookStatusPage() {
  const { user } = useAuth();
  const { data: brands } = useQuery({
    queryKey: ['/api/brands'],
  });

  if (!brands || brands.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Webhook Status</h1>
        <Card>
          <CardContent className="p-6 text-center">
            <p>No brands with integrations found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Webhook Status</h1>
      <div className="grid gap-4">
        {brands.map((brand: any) => (
          <Card key={brand.id}>
            <CardHeader>
              <CardTitle>{brand.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Webhook monitoring for {brand.name}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default WebhookStatusPage;