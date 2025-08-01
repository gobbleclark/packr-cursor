import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Users, MessageSquare, Package, BarChart3, Settings } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Truck className="h-8 w-8 text-blue-600 mr-3" />
              <span className="text-xl font-bold text-gray-900">3PL Hub</span>
            </div>
            <div className="flex items-center">
              <Button 
                onClick={() => window.location.href = '/api/login'}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Complete 3PL Management Platform
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600 max-w-3xl mx-auto">
            Streamline your third-party logistics operations with our comprehensive SaaS platform. 
            Manage brand clients, sync orders, handle tickets, and integrate with ShipHero seamlessly.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button 
              size="lg"
              onClick={() => window.location.href = '/api/login'}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-lg"
            >
              Get Started
            </Button>
            <Button variant="outline" size="lg" className="px-8 py-3 text-lg">
              Learn More
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need for 3PL management
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Built for 3PL companies to efficiently manage their brand clients
            </p>
          </div>

          <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <Users className="h-8 w-8 text-blue-600" />
                <CardTitle>Multi-Tenant Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Manage multiple brand clients with role-based access control. 
                  Each brand gets their own secure dashboard and login.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Package className="h-8 w-8 text-blue-600" />
                <CardTitle>ShipHero Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Seamless integration with ShipHero API for order sync, inventory management, 
                  and fulfillment tracking with real-time updates.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <MessageSquare className="h-8 w-8 text-blue-600" />
                <CardTitle>Messaging & Ticketing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Comprehensive ticket system with threading, file attachments, 
                  priority levels, and email notifications.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-8 w-8 text-blue-600" />
                <CardTitle>Real-time Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Track key metrics, monitor order flow, and get insights 
                  into your 3PL operations with detailed dashboards.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Settings className="h-8 w-8 text-blue-600" />
                <CardTitle>Order Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Full order lifecycle management with ability to update shipping, 
                  modify items, and place holds directly through ShipHero.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Truck className="h-8 w-8 text-blue-600" />
                <CardTitle>Inventory Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Live inventory visibility per brand with automated sync 
                  and low stock alerts to prevent stockouts.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              Ready to streamline your 3PL operations?
            </h2>
            <p className="mt-4 text-lg text-blue-100">
              Join leading 3PL companies using our platform to manage their brand clients efficiently.
            </p>
            <div className="mt-8">
              <Button 
                size="lg"
                onClick={() => window.location.href = '/api/login'}
                className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-3 text-lg"
              >
                Start Your Free Trial
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center">
            <Truck className="h-6 w-6 text-blue-400 mr-2" />
            <span className="text-lg font-semibold text-white">3PL Hub</span>
          </div>
          <p className="mt-4 text-center text-gray-400">
            © 2024 3PL Hub. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
