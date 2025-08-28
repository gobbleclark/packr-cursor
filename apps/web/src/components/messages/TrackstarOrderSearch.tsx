'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Package, X, ExternalLink } from 'lucide-react';
import { authService } from '../../lib/auth';

interface TrackstarOrder {
  id: string;
  orderNumber: string;
  customerName?: string;
  customerEmail?: string;
  status: string;
  total: number;
  createdAt: string;
}

interface TrackstarOrderSearchProps {
  selectedOrder: TrackstarOrder | null;
  onOrderSelect: (order: TrackstarOrder | null) => void;
  brandId?: string;
  className?: string;
}

export function TrackstarOrderSearch({ 
  selectedOrder, 
  onOrderSelect, 
  brandId,
  className = ""
}: TrackstarOrderSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<TrackstarOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchTerm.length >= 2) {
        searchOrders();
      } else {
        setOrders([]);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm, brandId]);

  const searchOrders = async () => {
    setLoading(true);
    try {
      const token = authService.getToken();
      const params = new URLSearchParams({
        search: searchTerm,
        limit: '10'
      });
      
      if (brandId) {
        params.append('brandId', brandId);
      }

      const response = await fetch(buildApiUrl('orders?${params}'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
        setShowDropdown(data.orders?.length > 0);
        setSelectedIndex(0);
      }
    } catch (error) {
      console.error('Error searching orders:', error);
      setOrders([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown && orders.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < orders.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : orders.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (orders[selectedIndex]) {
            selectOrder(orders[selectedIndex]);
          }
          break;
        case 'Escape':
          setShowDropdown(false);
          break;
      }
    }
  };

  const selectOrder = (order: TrackstarOrder) => {
    onOrderSelect(order);
    setSearchTerm('');
    setShowDropdown(false);
    setOrders([]);
  };

  const clearSelection = () => {
    onOrderSelect(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleInputFocus = () => {
    if (searchTerm.length >= 2 && orders.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding dropdown to allow for clicks
    setTimeout(() => {
      setShowDropdown(false);
    }, 200);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const isCompact = className?.includes('compact');

  return (
    <div className={`relative ${className}`}>
      <label className={`block text-sm font-medium text-gray-700 ${isCompact ? 'mb-1' : 'mb-2'}`}>
        {isCompact ? 'Link to Order (Optional)' : 'Link to Trackstar Order'}
      </label>
      
      {selectedOrder ? (
        /* Selected Order Display */
        <div className={`flex items-center justify-between ${isCompact ? 'p-2' : 'p-3'} bg-blue-50 border border-blue-200 rounded-lg`}>
          <div className="flex items-center space-x-3">
            <Package className={`${isCompact ? 'h-4 w-4' : 'h-5 w-5'} text-blue-600`} />
            <div>
              <p className={`${isCompact ? 'text-xs' : 'text-sm'} font-medium text-blue-900`}>
                Order #{selectedOrder.orderNumber}
              </p>
              {!isCompact && (
                <p className="text-xs text-blue-700">
                  {selectedOrder.customerName && `${selectedOrder.customerName} • `}
                  {formatCurrency(selectedOrder.total)} • {selectedOrder.status}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              className="text-blue-600 hover:text-blue-800"
              title="View in Trackstar"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="text-gray-400 hover:text-red-600"
              title="Remove link"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Search Input */
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              placeholder="Search by order number, customer name, or email..."
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showDropdown && orders.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
            >
              {orders.map((order, index) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => selectOrder(order)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 ${
                    index === selectedIndex ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                  }`}
                >
                  <Package className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      Order #{order.orderNumber}
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      {order.customerName && (
                        <span>{order.customerName}</span>
                      )}
                      {order.customerEmail && (
                        <span>{order.customerEmail}</span>
                      )}
                      <span>•</span>
                      <span>{formatCurrency(order.total)}</span>
                      <span>•</span>
                      <span className="capitalize">{order.status}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {showDropdown && orders.length === 0 && searchTerm.length >= 2 && !loading && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center">
              <p className="text-sm text-gray-500">No orders found</p>
              <p className="text-xs text-gray-400 mt-1">
                Try searching by order number, customer name, or email
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
