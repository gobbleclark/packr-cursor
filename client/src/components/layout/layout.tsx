import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { 
  Menu,
  X,
  BarChart3, 
  Store, 
  MessageSquare, 
  Package, 
  Warehouse, 
  Settings, 
  Plug,
  Users,
  Building2,
  Truck,
  LogOut
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: any;
  badge?: string | number;
  badgeVariant?: 'default' | 'destructive' | 'outline' | 'secondary';
  roles?: string[];
}

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: BarChart3,
    roles: ['threePL', 'brand', 'admin'],
  },
  {
    name: 'Brand Clients',
    href: '/brands',
    icon: Store,
    roles: ['threePL', 'admin'],
  },
  {
    name: '3PL Companies',
    href: '/three-pls',
    icon: Building2,
    roles: ['admin'],
  },
  {
    name: 'Messages & Tickets',
    href: '/messages',
    icon: MessageSquare,
    badge: '3',
    badgeVariant: 'destructive',
    roles: ['threePL', 'brand', 'admin'],
  },
  {
    name: 'Orders',
    href: '/orders',
    icon: Package,
    badge: '47',
    badgeVariant: 'default',
    roles: ['threePL', 'brand', 'admin'],
  },
  {
    name: 'Inventory',
    href: '/inventory',
    icon: Warehouse,
    roles: ['threePL', 'brand', 'admin'],
  },
  {
    name: 'API Integrations',
    href: '/integrations',
    icon: Plug,
    roles: ['threePL', 'brand', 'admin'],
  },
  {
    name: 'User Management',
    href: '/users',
    icon: Users,
    roles: ['admin'],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['threePL', 'brand', 'admin'],
  },
];

function NavigationItems({ onItemClick }: { onItemClick?: () => void }) {
  const { user } = useAuth();
  const [location] = useLocation();

  const filteredNavigation = navigation.filter(item => 
    !item.roles || item.roles.includes(user?.role || 'brand')
  );

  return (
    <nav className="space-y-1">
      {filteredNavigation.map((item) => {
        const isActive = location === item.href || 
          (item.href !== '/' && location.startsWith(item.href));
        
        return (
          <a
            key={item.name}
            href={item.href}
            onClick={onItemClick}
            className={cn(
              "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
              isActive
                ? "bg-primary-100 text-primary-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <item.icon
              className={cn(
                "mr-3 h-5 w-5 flex-shrink-0",
                isActive ? "text-primary-500" : "text-gray-400"
              )}
            />
            <span className="flex-1">{item.name}</span>
            {item.badge && (
              <Badge 
                variant={item.badgeVariant || 'secondary'} 
                className="ml-auto"
              >
                {item.badge}
              </Badge>
            )}
          </a>
        );
      })}
    </nav>
  );
}

function UserInfo() {
  const { user } = useAuth();
  
  return (
    <div className="bg-primary-50 rounded-lg p-3 mb-6">
      <div className="text-xs font-medium text-primary-600 uppercase tracking-wider">
        Current Role
      </div>
      <div className="text-sm font-semibold text-primary-700">
        {user?.role === 'threePL' ? '3PL Manager' : 
         user?.role === 'brand' ? 'Brand User' :
         user?.role === 'admin' ? 'Administrator' : 'User'}
      </div>
      <div className="text-xs text-primary-600 mt-1">
        {user?.email}
      </div>
    </div>
  );
}

// Desktop Sidebar
function DesktopSidebar() {
  return (
    <div className="hidden md:flex md:w-64 md:flex-col">
      <div className="flex flex-col flex-grow pt-5 bg-white overflow-y-auto border-r border-gray-200">
        {/* Logo */}
        <div className="flex items-center flex-shrink-0 px-4 mb-6">
          <Truck className="h-8 w-8 text-primary-600 mr-3" />
          <span className="text-xl font-bold text-gray-900">3PL Hub</span>
        </div>

        {/* User Info */}
        <div className="px-4">
          <UserInfo />
        </div>
        
        {/* Navigation */}
        <div className="mt-5 flex-1 px-2">
          <NavigationItems />
        </div>

        {/* Logout */}
        <div className="p-4 border-t border-gray-200">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = '/api/logout'}
            className="w-full justify-start"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}

// Mobile Header
function MobileHeader() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      {/* Mobile header bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <Truck className="h-7 w-7 text-primary-600 mr-2" />
          <span className="text-lg font-bold text-gray-900">3PL Hub</span>
        </div>
        
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="p-2">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Truck className="h-7 w-7 text-primary-600 mr-2" />
                    <span className="text-lg font-bold text-gray-900">3PL Hub</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpen(false)}
                    className="p-2"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* User Info */}
              <div className="p-4">
                <UserInfo />
              </div>

              {/* Navigation */}
              <div className="flex-1 px-4">
                <NavigationItems onItemClick={() => setOpen(false)} />
              </div>

              {/* Logout */}
              <div className="p-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    window.location.href = '/api/logout';
                  }}
                  className="w-full justify-start"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="h-screen flex bg-gray-50">
      {/* Desktop Sidebar */}
      <DesktopSidebar />
      
      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <MobileHeader />
        
        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}