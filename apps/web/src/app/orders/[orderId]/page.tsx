'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Package, 
  MapPin, 
  Truck, 
  User, 
  Mail, 
  DollarSign, 
  Edit3, 
  Save, 
  X, 
  Plus,
  MessageSquare,
  ExternalLink,
  Calendar,
  Phone
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { AuthenticatedLayout } from '../../../components/layout/AuthenticatedLayout';
import { authService } from '../../../lib/auth';

interface OrderItem {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  price: number;
  total: number;
}

interface Shipment {
  id: string;
  trackingNumber: string;
  carrier: string;
  service: string;
  shippedAt: string;
  status: string;
}

interface ShippingAddress {
  fullName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone?: string;
  email?: string;
}

interface OrderNote {
  id: string;
  content: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  status: string;
  total: number;
  subtotal: number;
  tax: number;
  shipping: number;
  orderDate: string;
  dueDate: string;
  brandName: string;
  orderItems: OrderItem[];
  shipments: Shipment[];
  shippingAddress: ShippingAddress;
  notes: OrderNote[];
  rawData: any;
}

const ORDER_STATUSES = [
  { value: 'PENDING', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'PROCESSING', label: 'Processing', color: 'bg-blue-100 text-blue-800' },
  { value: 'SHIPPED', label: 'Shipped', color: 'bg-green-100 text-green-800' },
  { value: 'DELIVERED', label: 'Delivered', color: 'bg-green-100 text-green-800' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
];

const SHIPPING_CARRIERS = [
  { value: 'UPS', label: 'UPS' },
  { value: 'FedEx', label: 'FedEx' },
  { value: 'USPS', label: 'USPS' },
  { value: 'DHL', label: 'DHL' },
  { value: 'OnTrac', label: 'OnTrac' },
];

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Edit states
  const [editingAddress, setEditingAddress] = useState(false);
  const [editingItems, setEditingItems] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingShipping, setEditingShipping] = useState(false);
  
  // Form states
  const [addressForm, setAddressForm] = useState<ShippingAddress | null>(null);
  const [statusForm, setStatusForm] = useState('');
  const [shippingForm, setShippingForm] = useState({ carrier: '', service: '' });
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [shipMethods, setShipMethods] = useState<any[]>([]);
  const [loadingShipMethods, setLoadingShipMethods] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authResponse = await authService.verifyToken();
        if (authResponse) {
          setUser(authResponse.user);
          await fetchOrder();
        } else {
          router.push('/');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, orderId]);

  const handleLogout = () => {
    authService.clearToken();
    router.push('/');
  };

  const fetchOrder = async () => {
    try {
      const response = await fetch(`http://localhost:4000/api/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const orderData = data.order;
        
        // Extract shipping address from rawData
        const shippingAddress = extractShippingAddress(orderData.rawData);
        
        setOrder({
          ...orderData,
          shippingAddress,
          notes: [] // TODO: Fetch from API when implemented
        });
        
        // Initialize form states
        setAddressForm(shippingAddress);
        setStatusForm(orderData.status);
        setShippingForm({
          carrier: orderData.shipments?.[0]?.carrier || '',
          service: orderData.shipments?.[0]?.service || ''
        });
      } else {
        setError('Failed to fetch order details');
      }
    } catch (error) {
      console.error('Failed to fetch order:', error);
      setError('Failed to fetch order details');
    }
  };

  const extractShippingAddress = (rawData: any): ShippingAddress => {
    const shipTo = rawData?.ship_to_address || {};
    return {
      fullName: shipTo.full_name || rawData?.customer_name || '',
      company: shipTo.company || '',
      address1: shipTo.address1 || shipTo.street_address || '',
      address2: shipTo.address2 || '',
      city: shipTo.city || '',
      state: shipTo.state || shipTo.province || '',
      zipCode: shipTo.zip_code || shipTo.postal_code || '',
      country: shipTo.country || 'US',
      phone: shipTo.phone || '',
      email: shipTo.email || rawData?.customer_email || ''
    };
  };

  const handleSaveAddress = async () => {
    if (!addressForm) return;
    
    try {
      const response = await fetch(`http://localhost:4000/api/orders/${orderId}/address`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(addressForm)
      });

      if (response.ok) {
        setOrder(prev => prev ? { ...prev, shippingAddress: addressForm } : null);
        setEditingAddress(false);
      } else {
        alert('Failed to update shipping address');
      }
    } catch (error) {
      console.error('Failed to update address:', error);
      alert('Failed to update shipping address');
    }
  };

  const handleSaveStatus = async () => {
    try {
      const response = await fetch(`http://localhost:4000/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: statusForm })
      });

      if (response.ok) {
        setOrder(prev => prev ? { ...prev, status: statusForm } : null);
        setEditingStatus(false);
      } else {
        alert('Failed to update order status');
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update order status');
    }
  };

  const handleSaveShipping = async () => {
    try {
      console.log('Saving shipping form:', shippingForm);
      
      const response = await fetch(`http://localhost:4000/api/orders/${orderId}/shipping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(shippingForm)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Shipping update result:', result);
        
        // Update the order with new shipping info
        setEditingShipping(false);
        await fetchOrder(); // Refresh to get updated data
        alert('Shipping information updated successfully!');
      } else {
        const errorData = await response.json();
        console.error('Failed to update shipping:', errorData);
        
        if (errorData.code === 'ORDER_NOT_FOUND_IN_TRACKSTAR') {
          alert(`⚠️ Order Sync Issue\n\nThis order no longer exists in the Trackstar/ShipHero system and cannot be updated.\n\n${errorData.suggestion || 'The order may have been deleted from ShipHero.'}`);
        } else {
          alert(`Failed to update shipping information: ${errorData.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Failed to update shipping:', error);
      alert('Failed to update shipping information');
    }
  };

  const fetchShipMethods = async () => {
    if (!orderId) return;
    
    setLoadingShipMethods(true);
    try {
      const response = await fetch(`http://localhost:4000/api/orders/${orderId}/ship-methods`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setShipMethods(data.shipMethods || []);
      } else {
        console.error('Failed to fetch ship methods');
        // Use fallback methods
        setShipMethods([
          { id: 'ups-ground', name: 'UPS Ground', carrier: 'UPS' },
          { id: 'fedex-ground', name: 'FedEx Ground', carrier: 'FedEx' },
          { id: 'usps-priority', name: 'USPS Priority Mail', carrier: 'USPS' }
        ]);
      }
    } catch (error) {
      console.error('Error fetching ship methods:', error);
      // Use fallback methods
      setShipMethods([
        { id: 'ups-ground', name: 'UPS Ground', carrier: 'UPS' },
        { id: 'fedex-ground', name: 'FedEx Ground', carrier: 'FedEx' },
        { id: 'usps-priority', name: 'USPS Priority Mail', carrier: 'USPS' }
      ]);
    } finally {
      setLoadingShipMethods(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    try {
      const response = await fetch(`http://localhost:4000/api/orders/${orderId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content: newNote })
      });

      if (response.ok) {
        const noteData = await response.json();
        setOrder(prev => prev ? { 
          ...prev, 
          notes: [...prev.notes, noteData.note] 
        } : null);
        setNewNote('');
        setAddingNote(false);
      } else {
        alert('Failed to add note');
      }
    } catch (error) {
      console.error('Failed to add note:', error);
      alert('Failed to add note');
    }
  };

  const getStatusColor = (status: string) => {
    const statusConfig = ORDER_STATUSES.find(s => s.value === status?.toUpperCase());
    return statusConfig?.color || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTrackingUrl = (carrier: string, trackingNumber: string) => {
    const urls: { [key: string]: string } = {
      'UPS': `https://www.ups.com/track?tracknum=${trackingNumber}`,
      'FedEx': `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
      'USPS': `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
      'DHL': `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${trackingNumber}`,
    };
    return urls[carrier] || '#';
  };

  if (loading) {
    return (
      <AuthenticatedLayout user={user} onLogout={handleLogout}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading order details...</p>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (!user || error || !order) {
    return (
      <AuthenticatedLayout user={user} onLogout={handleLogout}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <Package className="h-12 w-12 mx-auto mb-2" />
              <p className="text-lg font-semibold">Order Not Found</p>
              <p className="text-gray-600">{error || 'Unable to load order details'}</p>
            </div>
            <Button onClick={() => router.push('/orders')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Orders
            </Button>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  const is3PL = user?.role?.includes('THREEPL');

  return (
    <AuthenticatedLayout user={user} onLogout={handleLogout}>
      {/* Header */}
      <header className="bg-white shadow-sm border-b mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                onClick={() => router.push('/orders')}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Orders
              </Button>
              <Package className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Order #{order.orderNumber || order.id}
                </h1>
                <p className="text-sm text-gray-600">
                  {order.customerName} • {formatDate(order.orderDate)}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {editingStatus ? (
                <div className="flex items-center space-x-2">
                  <Select 
                    value={statusForm} 
                    onChange={(e) => setStatusForm(e.target.value)}
                    className="w-32"
                  >
                    {ORDER_STATUSES.map(status => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" onClick={handleSaveStatus}>
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingStatus(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Badge className={getStatusColor(order.status)}>
                    {order.status || 'Unknown'}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingStatus(true)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping Address */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <MapPin className="h-5 w-5 mr-2" />
                    Ship To Address
                  </CardTitle>
                  {!editingAddress && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingAddress(true)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editingAddress && addressForm ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Full Name
                        </label>
                        <Input
                          value={addressForm.fullName}
                          onChange={(e) => setAddressForm({...addressForm, fullName: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Company
                        </label>
                        <Input
                          value={addressForm.company || ''}
                          onChange={(e) => setAddressForm({...addressForm, company: e.target.value})}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address Line 1
                      </label>
                      <Input
                        value={addressForm.address1}
                        onChange={(e) => setAddressForm({...addressForm, address1: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address Line 2
                      </label>
                      <Input
                        value={addressForm.address2 || ''}
                        onChange={(e) => setAddressForm({...addressForm, address2: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          City
                        </label>
                        <Input
                          value={addressForm.city}
                          onChange={(e) => setAddressForm({...addressForm, city: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          State
                        </label>
                        <Input
                          value={addressForm.state}
                          onChange={(e) => setAddressForm({...addressForm, state: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ZIP Code
                        </label>
                        <Input
                          value={addressForm.zipCode}
                          onChange={(e) => setAddressForm({...addressForm, zipCode: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone
                        </label>
                        <Input
                          value={addressForm.phone || ''}
                          onChange={(e) => setAddressForm({...addressForm, phone: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <Input
                          value={addressForm.email || ''}
                          onChange={(e) => setAddressForm({...addressForm, email: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button onClick={handleSaveAddress}>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </Button>
                      <Button variant="ghost" onClick={() => setEditingAddress(false)}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="font-medium">{order.shippingAddress.fullName}</p>
                    {order.shippingAddress.company && (
                      <p className="text-gray-600">{order.shippingAddress.company}</p>
                    )}
                    <p className="text-gray-600">{order.shippingAddress.address1}</p>
                    {order.shippingAddress.address2 && (
                      <p className="text-gray-600">{order.shippingAddress.address2}</p>
                    )}
                    <p className="text-gray-600">
                      {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                    </p>
                    {order.shippingAddress.phone && (
                      <p className="text-gray-600 flex items-center">
                        <Phone className="h-4 w-4 mr-2" />
                        {order.shippingAddress.phone}
                      </p>
                    )}
                    {order.shippingAddress.email && (
                      <p className="text-gray-600 flex items-center">
                        <Mail className="h-4 w-4 mr-2" />
                        {order.shippingAddress.email}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Order Items ({order.orderItems?.length || 0})</CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingItems(!editingItems)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {order.orderItems && order.orderItems.length > 0 ? (
                  <div className="space-y-4">
                    {order.orderItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-sm text-gray-600">SKU: {item.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{item.quantity} × {formatCurrency(item.price)}</p>
                          <p className="text-lg font-semibold text-blue-600">
                            {formatCurrency(item.total)}
                          </p>
                        </div>
                        {editingItems && (
                          <div className="ml-4">
                            <Button size="sm" variant="ghost">
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No order items found</p>
                )}
              </CardContent>
            </Card>

            {/* Shipping Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Truck className="h-5 w-5 mr-2" />
                    Shipping Information
                  </CardTitle>
                  {!editingShipping && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingShipping(true)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editingShipping ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Carrier
                        </label>
                        <Select 
                          value={shippingForm.carrier} 
                          onChange={(e) => setShippingForm({...shippingForm, carrier: e.target.value})}
                        >
                          <option value="">Select carrier</option>
                          {SHIPPING_CARRIERS.map(carrier => (
                            <option key={carrier.value} value={carrier.value}>
                              {carrier.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Service Type
                        </label>
                        <Input
                          value={shippingForm.service}
                          onChange={(e) => setShippingForm({...shippingForm, service: e.target.value})}
                          placeholder="e.g., Ground, Express, Priority"
                        />
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button onClick={handleSaveShipping}>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </Button>
                      <Button variant="ghost" onClick={() => setEditingShipping(false)}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {order.shipments && order.shipments.length > 0 ? (
                      <div className="space-y-4">
                        {order.shipments.map((shipment) => (
                          <div key={shipment.id} className="p-4 border rounded-lg">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm font-medium text-gray-500">Carrier</p>
                                <p className="font-medium">{shipment.carrier || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-500">Service</p>
                                <p className="font-medium">{shipment.service || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-500">Tracking</p>
                                <div className="flex items-center space-x-2">
                                  <p className="font-medium font-mono">{shipment.trackingNumber || 'N/A'}</p>
                                  {shipment.trackingNumber && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => window.open(getTrackingUrl(shipment.carrier, shipment.trackingNumber), '_blank')}
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-500">Shipped</p>
                                <p className="font-medium">{formatDate(shipment.shippedAt)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No shipments yet</p>
                        <p className="text-sm text-gray-400">Shipping information will appear here once the order is shipped</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Notes */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Order Notes ({order.notes?.length || 0})
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => setAddingNote(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {addingNote && (
                  <div className="mb-4 p-4 border rounded-lg bg-gray-50">
                    <textarea
                      className="w-full p-3 border rounded-lg resize-none"
                      rows={3}
                      placeholder="Add a note about this order..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                    />
                    <div className="flex space-x-2 mt-3">
                      <Button size="sm" onClick={handleAddNote}>
                        <Save className="h-4 w-4 mr-2" />
                        Save Note
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setAddingNote(false);
                        setNewNote('');
                      }}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                
                {order.notes && order.notes.length > 0 ? (
                  <div className="space-y-4">
                    {order.notes.map((note) => (
                      <div key={note.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-sm">{note.createdByName}</span>
                          </div>
                          <div className="flex items-center text-xs text-gray-500">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(note.createdAt)}
                          </div>
                        </div>
                        <p className="text-gray-700">{note.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No notes yet</p>
                    <p className="text-sm text-gray-400">Add notes to keep track of important information about this order</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="h-5 w-5 mr-2" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Order Number</p>
                    <p className="text-lg font-semibold">#{order.orderNumber || order.id}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Order Date</p>
                    <p className="font-medium">{formatDate(order.orderDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Due Date</p>
                    <p className="font-medium">{formatDate(order.dueDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Brand</p>
                    <p className="font-medium">{order.brandName || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Carrier */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Truck className="h-5 w-5 mr-2" />
                    Shipping Carrier
                  </CardTitle>
                  {!editingShipping && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const shippingMethod = order.rawData?.shipping_method;
                        setShippingForm({
                          carrier: shippingMethod?.carrier || '',
                          service: shippingMethod?.service || ''
                        });
                        setEditingShipping(true);
                        await fetchShipMethods();
                      }}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editingShipping ? (
                  <div className="space-y-4">
                    {loadingShipMethods ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-sm text-gray-500 mt-2">Loading ship methods...</p>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Ship Method
                          </label>
                          <Select 
                            value={shippingForm.carrier && shippingForm.service ? `${shippingForm.carrier}|${shippingForm.service}` : ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              console.log('Selected ship method:', value);
                              const [carrier, ...serviceParts] = value.split('|');
                              const service = serviceParts.join('|'); // In case service name contains |
                              console.log('Parsed carrier:', carrier, 'service:', service);
                              setShippingForm({ carrier, service });
                            }}
                          >
                            <option value="">Select ship method</option>
                            {shipMethods.map(method => (
                              <option key={method.id} value={`${method.carrier}|${method.name}`}>
                                {method.name} ({method.carrier})
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div className="flex space-x-2">
                          <Button size="sm" onClick={handleSaveShipping}>
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingShipping(false)}>
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Carrier</p>
                      <p className="font-medium">{order.rawData?.shipping_method?.carrier || 'Not assigned'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Service</p>
                      <p className="font-medium">{order.rawData?.shipping_method?.service || 'Not assigned'}</p>
                    </div>
                    {!order.rawData?.shipping_method?.carrier && (
                      <div className="text-center py-4">
                        <Truck className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No shipping method assigned</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="h-5 w-5 mr-2" />
                  Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Subtotal</span>
                    <span className="font-medium">{formatCurrency(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Tax</span>
                    <span className="font-medium">{formatCurrency(order.tax)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Shipping</span>
                    <span className="font-medium">{formatCurrency(order.shipping)}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between">
                    <span className="text-lg font-semibold">Total</span>
                    <span className="text-lg font-semibold text-blue-600">
                      {formatCurrency(order.total)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Name</p>
                    <p className="font-medium">{order.customerName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Email</p>
                    <p className="font-medium flex items-center">
                      <Mail className="h-4 w-4 mr-2" />
                      {order.customerEmail || 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Raw Data */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="h-5 w-5 mr-2" />
                  Raw Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-auto">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                    {JSON.stringify(order.rawData, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}