import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMobile } from "@/hooks/use-mobile";
import { 
  BarChart3, 
  Store, 
  MessageSquare, 
  Package, 
  Warehouse, 
  Settings, 
  Plug,
  Users,
  Building2,
  Smartphone
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: any;
  badge?: string | number;
  badgeVariant?: 'default' | 'destructive' | 'outline' | 'secondary';
  roles?: string[];
}

export default function Sidebar() {
  const { user } = useAuth();
  const [location] = useLocation();

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
      badge: '12',
      roles: ['threePL', 'admin'],
    },
    {
      name: '3PL Companies',
      href: '/three-pls',
      icon: Building2,
      badge: '5',
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

  const filteredNavigation = navigation.filter(item => 
    !item.roles || item.roles.includes(user?.role || 'brand')
  );

  return (
    <div className="hidden md:flex md:w-64 md:flex-col">
      <div className="flex flex-col flex-grow pt-5 bg-white overflow-y-auto border-r border-gray-200">
        {/* Role Info */}
        <div className="flex items-center flex-shrink-0 px-4 mb-6">
          <div className="w-full">
            <div className="bg-primary-50 rounded-lg p-3">
              <div className="text-xs font-medium text-primary-600 uppercase tracking-wider">
                Current Role
              </div>
              <div className="text-sm font-semibold text-primary-700">
                {user?.role === 'threePL' ? '3PL Manager' : 
                 user?.role === 'brand' ? 'Brand User' :
                 user?.role === 'admin' ? 'Administrator' : 'User'}
              </div>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {filteredNavigation.map((item) => {
            const isActive = location === item.href || 
              (item.href !== '/' && location.startsWith(item.href));
            
            return (
              <a
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
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
        
        {/* Mobile App Toggle */}
        <div className="mt-auto px-2 pb-4">
          <Button
            variant="outline" 
            className="w-full justify-start text-sm"
            onClick={() => window.location.href = '/mobile'}
          >
            <Smartphone className="mr-3 h-4 w-4" />
            Mobile App
          </Button>
        </div>
      </div>
    </div>
  );
}
