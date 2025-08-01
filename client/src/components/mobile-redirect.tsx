import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, Monitor, ArrowRight } from 'lucide-react';

interface MobileRedirectProps {
  children: React.ReactNode;
}

export function MobileRedirect({ children }: MobileRedirectProps) {
  const { isMobile } = useMobile();
  const [location, setLocation] = useLocation();

  // Don't redirect if already on mobile page or landing page
  const shouldNotRedirect = location === '/mobile' || location === '/' || location.startsWith('/invite/');

  if (isMobile && !shouldNotRedirect) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
              <Smartphone className="h-8 w-8 text-primary-600" />
            </div>
            <CardTitle className="text-xl">Mobile App Available</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600 text-center">
              We've detected you're on a mobile device. For the best experience, use our mobile-optimized interface.
            </p>
            
            <div className="space-y-3">
              <Button 
                className="w-full" 
                onClick={() => setLocation('/mobile')}
              >
                <Smartphone className="h-4 w-4 mr-2" />
                Open Mobile App
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  // Set a flag to prevent future redirects in this session
                  sessionStorage.setItem('preferDesktop', 'true');
                  window.location.reload();
                }}
              >
                <Monitor className="h-4 w-4 mr-2" />
                Continue with Desktop View
              </Button>
            </div>
            
            <p className="text-xs text-gray-500 text-center">
              You can switch between views anytime from the menu.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}