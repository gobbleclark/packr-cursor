import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  Building2, 
  Mail, 
  ArrowRight,
  AlertCircle
} from "lucide-react";

export default function BrandInvite() {
  const { toast } = useToast();
  const { token } = useParams();
  const [, setLocation] = useLocation();
  const [isAccepting, setIsAccepting] = useState(false);

  const { data: invitationData, isLoading, error } = useQuery<any>({
    queryKey: ['/api/brands/invite', token],
    enabled: !!token,
  });

  const acceptInvitationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/brands/invite/${token}/accept`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Invitation Accepted",
        description: data.message,
      });
      setIsAccepting(false);
      // Redirect to login after 3 seconds
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 3000);
    },
    onError: (error) => {
      console.error("Error accepting invitation:", error);
      toast({
        title: "Error",
        description: "Failed to accept invitation. Please try again.",
        variant: "destructive",
      });
      setIsAccepting(false);
    },
  });

  const handleAcceptInvitation = () => {
    setIsAccepting(true);
    acceptInvitationMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !invitationData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-xl font-bold text-red-900">Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              This invitation link is invalid or has expired. Please contact your 3PL provider for a new invitation.
            </p>
            <Button 
              variant="outline" 
              onClick={() => setLocation("/")}
              className="w-full"
            >
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAccepting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-xl font-bold text-green-900">Invitation Accepted!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Welcome to the 3PL platform! You'll be redirected to sign in shortly.
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { brand } = invitationData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">You're Invited!</CardTitle>
          <p className="text-gray-600 mt-2">
            Join the 3PL platform as a brand partner
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Brand Information */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Brand Name:</span>
              <Badge variant="outline" className="text-blue-600 border-blue-300">
                {brand.name}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Email:</span>
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Mail className="h-3 w-3" />
                {brand.email}
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">What you'll get access to:</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Order management and tracking
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Real-time inventory visibility
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Support ticket system
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Integration with WMS platforms
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={handleAcceptInvitation}
              disabled={acceptInvitationMutation.isPending}
              className="w-full flex items-center justify-center gap-2"
            >
              {acceptInvitationMutation.isPending ? (
                "Accepting..."
              ) : (
                <>
                  Accept Invitation
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setLocation("/")}
              className="w-full"
            >
              Not now
            </Button>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              By accepting this invitation, you agree to join the 3PL platform and can access your dashboard by signing in.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}