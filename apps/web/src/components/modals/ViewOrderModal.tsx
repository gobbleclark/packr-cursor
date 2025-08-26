'use client';

import React, { useEffect, useState } from 'react';
import { BaseModal } from './BaseModal';
import { useModal } from '../../contexts/ModalContext';
import { trackstarOrderService, OrderDetailsData } from '../../lib/trackstar-order-service';
import { Package, User, MapPin, Truck, Calendar, FileText, Loader2 } from 'lucide-react';

export function ViewOrderModal() {
  const { activeModal, modalData, closeModal } = useModal();
  const [orderDetails, setOrderDetails] = useState<OrderDetailsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = activeModal === 'view_order';

  useEffect(() => {
    if (isOpen && modalData?.orderNumber) {
      loadOrderDetails();
    }
  }, [isOpen, modalData?.orderNumber]);

  const loadOrderDetails = async () => {
    if (!modalData?.orderNumber) return;

    setLoading(true);
    setError(null);

    try {
      const response = await trackstarOrderService.getOrderDetails(modalData.orderNumber);
      
      if (response.success && response.data) {
        setOrderDetails(response.data);
      } else {
        setError(response.error || 'Failed to load order details');
      }
    } catch (err) {
      setError('Failed to load order details');
      console.error('Error loading order details:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'fulfilled':
      case 'shipped':
        return 'bg-green-100 text-green-800';
      case 'unfulfilled':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={closeModal}
      title={`Order #${modalData?.orderNumber || ''}`}
      size="lg"
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          <span className="ml-3 text-gray-600">Loading order details...</span>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={loadOrderDetails}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : orderDetails ? (
        <div className="space-y-6">
          {/* Order Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Package className="h-6 w-6 text-purple-600" />
              <div>
                <h3 className="text-lg font-semibold">Order #{orderDetails.orderNumber}</h3>
                <p className="text-sm text-gray-600">
                  Created {formatDate(orderDetails.createdAt)}
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(orderDetails.status)}`}>
              {orderDetails.status.charAt(0).toUpperCase() + orderDetails.status.slice(1)}
            </span>
          </div>

          {/* Customer Info */}
          {orderDetails.customerName && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <User className="h-5 w-5 text-gray-500" />
                <h4 className="font-medium">Customer</h4>
              </div>
              <p className="text-gray-900">{orderDetails.customerName}</p>
              {orderDetails.customerEmail && (
                <p className="text-gray-600 text-sm">{orderDetails.customerEmail}</p>
              )}
            </div>
          )}

          {/* Shipping Address */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <MapPin className="h-5 w-5 text-gray-500" />
              <h4 className="font-medium">Shipping Address</h4>
            </div>
            <div className="text-gray-900">
              {orderDetails.shippingAddress.name && (
                <p>{orderDetails.shippingAddress.name}</p>
              )}
              <p>{orderDetails.shippingAddress.street}</p>
              {orderDetails.shippingAddress.street2 && (
                <p>{orderDetails.shippingAddress.street2}</p>
              )}
              <p>
                {orderDetails.shippingAddress.city}, {orderDetails.shippingAddress.state} {orderDetails.shippingAddress.zipCode}
              </p>
              <p>{orderDetails.shippingAddress.country}</p>
              {orderDetails.shippingAddress.phone && (
                <p className="text-gray-600 text-sm mt-1">{orderDetails.shippingAddress.phone}</p>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-3">Items ({orderDetails.lineItems.length})</h4>
            <div className="space-y-2">
              {orderDetails.lineItems.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                  <div>
                    <p className="font-medium">{item.name || item.sku}</p>
                    <p className="text-sm text-gray-600">SKU: {item.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">Qty: {item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping Info */}
          {orderDetails.carrier && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Truck className="h-5 w-5 text-gray-500" />
                <h4 className="font-medium">Shipping</h4>
              </div>
              <p className="text-gray-900">{orderDetails.carrier.carrierName}</p>
              {orderDetails.carrier.serviceLevel && (
                <p className="text-gray-600 text-sm">{orderDetails.carrier.serviceLevel}</p>
              )}
              {orderDetails.tracking?.trackingNumber && (
                <div className="mt-2">
                  <p className="text-sm font-medium">Tracking: {orderDetails.tracking.trackingNumber}</p>
                  {orderDetails.tracking.trackingUrl && (
                    <a 
                      href={orderDetails.tracking.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:text-purple-800 text-sm underline"
                    >
                      Track Package
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {orderDetails.notes && orderDetails.notes.length > 0 && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <FileText className="h-5 w-5 text-gray-500" />
                <h4 className="font-medium">Notes</h4>
              </div>
              <div className="space-y-3">
                {orderDetails.notes.map((note) => (
                  <div key={note.id} className="border-l-4 border-gray-200 pl-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{note.author}</span>
                      <span className="text-xs text-gray-500">{formatDate(note.createdAt)}</span>
                    </div>
                    <p className="text-gray-900">{note.content}</p>
                    {note.isInternal && (
                      <span className="inline-block mt-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                        Internal Note
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              onClick={closeModal}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </BaseModal>
  );
}
