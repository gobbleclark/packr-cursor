import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useMobile } from "@/hooks/use-mobile";
import Layout from "@/components/layout/layout";
import { MobileRedirect } from "@/components/mobile-redirect";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import BrandDashboard from "@/pages/brand-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import BrandManagement from "@/pages/brand-management";
import BrandInvite from "@/pages/brand-invite";
import Messages from "@/pages/messages";
import Orders from "@/pages/orders";
import Inventory from "@/pages/inventory";
import Integrations from "@/pages/integrations";
import MobileApp from "@/pages/mobile-app";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isMobile } = useMobile();
  
  // Check if user prefers desktop view
  const preferDesktop = sessionStorage.getItem('preferDesktop') === 'true';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/invite/:token" component={BrandInvite} />
        </>
      ) : (
        <>
          <Route path="/mobile" component={MobileApp} />
          <MobileRedirect>
            <Layout>
              <Switch>
                <Route path="/" component={() => {
                  if (user?.role === 'brand') return <BrandDashboard />;
                  if (user?.role === 'admin') return <AdminDashboard />;
                  return <Dashboard />;
                }} />
                <Route path="/brands" component={BrandManagement} />
                <Route path="/messages" component={Messages} />
                <Route path="/orders" component={Orders} />
                <Route path="/inventory" component={Inventory} />
                <Route path="/integrations" component={Integrations} />
                <Route component={NotFound} />
              </Switch>
            </Layout>
          </MobileRedirect>
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
