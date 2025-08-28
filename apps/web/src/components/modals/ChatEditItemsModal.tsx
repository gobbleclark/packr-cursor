'use client';

import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { useModal } from '../../contexts/ModalContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Package, Loader2, AlertCircle, Plus, Minus, Trash2 } from 'lucide-react';

interface OrderItem {
  id: string;
  sku: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

export function ChatEditItemsModal() {
  const { activeModal, modalData, closeModal } = useModal();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [originalItems, setOriginalItems] = useState<OrderItem[]>([]);

  const isOpen = activeModal === 'edit_items';

  useEffect(() => {
    if (isOpen && modalData?.orderNumber) {
      loadOrderData();
    }
  }, [isOpen, modalData?.orderNumber]);

  const loadOrderData = async () => {
    if (!modalData?.orderNumber) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(buildApiUrl('orders/${modalData.orderNumber}'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOrderData(data.order);
        
        // Convert order items to editable format
        const orderItems = (data.order.orderItems || []).map((item: any) => ({
          id: item.id,
          sku: item.sku,
          productName: item.productName || item.sku,
          quantity: item.quantity,
          price: item.price,
          total: item.total || (item.quantity * item.price)
        }));
        
        setItems([...orderItems]);
        setOriginalItems([...orderItems]);
      } else {
        setError('Failed to load order details');
      }
    } catch (err) {
      setError('Failed to load order details');
      console.error('Error loading order:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 0) return;
    
    setItems(items.map(item => {
      if (item.id === itemId) {
        const updatedItem = {
          ...item,
          quantity: newQuantity,
          total: newQuantity * item.price
        };
        return updatedItem;
      }
      return item;
    }));
  };

  const removeItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  const hasChanges = () => {
    if (items.length !== originalItems.length) return true;
    
    return items.some(item => {
      const original = originalItems.find(orig => orig.id === item.id);
      return !original || original.quantity !== item.quantity;
    });
  };

  const handleSave = async () => {
    if (!modalData?.orderNumber || !hasChanges()) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Prepare items data for API
      const itemsData = items.map(item => ({
        id: item.id,
        sku: item.sku,
        quantity: item.quantity
      }));

      // Use the same Trackstar write-through endpoint as the Orders feature
      const response = await fetch(buildApiUrl('orders/${modalData.orderNumber}/items'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ items: itemsData })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          closeModal();
        }, 1500);
      } else {
        setError(data.error || 'Failed to update order items');
      }
    } catch (err) {
      setError('Failed to update order items');
      console.error('Error updating items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    closeModal();
  };

  const getTotalValue = () => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Edit Order Items - Order #${modalData?.orderNumber || ''}`}
      size="lg"
    >
      {loading && !orderData ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          <span className="ml-3 text-gray-600">Loading order details...</span>
        </div>
      ) : error && !orderData ? (
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <div className="text-red-600 mb-4">{error}</div>
          <Button onClick={loadOrderData} variant="outline">
            Try Again
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">
                    Order items updated successfully!
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-gray-700">
              <Package className="h-5 w-5" />
              <h3 className="font-medium">Edit Order Items</h3>
            </div>
            <div className="text-sm text-gray-600">
              Total: ${getTotalValue().toFixed(2)}
            </div>
          </div>

          {orderData && orderData.status === 'shipped' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-yellow-800">
                    Warning: This order has already been shipped. Item changes may not be possible.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{item.productName}</h4>
                    <p className="text-sm text-gray-600">SKU: {item.sku}</p>
                    <p className="text-sm text-gray-600">${item.price.toFixed(2)} each</p>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 0)}
                        className="w-20 text-center"
                        min="0"
                      />
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="text-right min-w-[80px]">
                      <p className="font-medium">${item.total.toFixed(2)}</p>
                    </div>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeItem(item.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {items.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No items in this order</p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              onClick={handleClose}
              variant="outline"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || !hasChanges()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                'Update Items'
              )}
            </Button>
          </div>

          <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
            💡 This will update the order items in both Packr and Trackstar. Changes are synchronized in real-time.
          </div>
        </div>
      )}
    </BaseModal>
  );
}
