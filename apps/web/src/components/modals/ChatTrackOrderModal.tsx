'use client';

import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { useModal } from '../../contexts/ModalContext';
import { Button } from '../ui/button';
import { Package, Loader2, AlertCircle, ExternalLink, Truck, MapPin, Calendar } from 'lucide-react';

interface TrackingInfo {
  trackingNumber: string;
  carrier: string;
  status: string;
  estimatedDelivery?: string;
  trackingUrl?: string;
  events: TrackingEvent[];
}

interface TrackingEvent {
  date: string;
  status: string;
  location?: string;
  description: string;
}

export function ChatTrackOrderModal() {
  const { activeModal, modalData, closeModal } = useModal();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);

  const isOpen = activeModal === 'track_order';

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
      const response = await fetch(`http://localhost:4000/api/orders/${modalData.orderNumber}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOrderData(data.order);
        
        // Load tracking information if available
        if (data.order.shipments && data.order.shipments.length > 0) {
          const shipment = data.order.shipments[0];
          if (shipment.trackingNumber) {
            await loadTrackingInfo(shipment.trackingNumber, shipment.carrier);
          }
        }
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

  const loadTrackingInfo = async (trackingNumber: string, carrier: string) => {
    try {
      // Mock tracking data - in real implementation, this would come from carrier APIs
      const mockTrackingInfo: TrackingInfo = {
        trackingNumber,
        carrier,
        status: 'In Transit',
        estimatedDelivery: '2024-01-15',
        trackingUrl: getCarrierTrackingUrl(carrier, trackingNumber),
        events: [
          {
            date: '2024-01-12T10:30:00Z',
            status: 'Shipped',
            location: 'Los Angeles, CA',
            description: 'Package has been shipped from fulfillment center'
          },
          {
            date: '2024-01-12T14:45:00Z',
            status: 'In Transit',
            location: 'Los Angeles, CA',
            description: 'Package is in transit to destination facility'
          },
          {
            date: '2024-01-13T08:15:00Z',
            status: 'In Transit',
            location: 'Phoenix, AZ',
            description: 'Package arrived at sorting facility'
          },
          {
            date: '2024-01-13T16:20:00Z',
            status: 'In Transit',
            location: 'Phoenix, AZ',
            description: 'Package departed from sorting facility'
          }
        ]
      };
      
      setTrackingInfo(mockTrackingInfo);
    } catch (err) {
      console.error('Error loading tracking info:', err);
    }
  };

  const getCarrierTrackingUrl = (carrier: string, trackingNumber: string): string => {
    switch (carrier.toLowerCase()) {
      case 'ups':
        return `https://www.ups.com/track?tracknum=${trackingNumber}`;
      case 'fedex':
        return `https://www.fedex.com/fedextrack/?tracknumbers=${trackingNumber}`;
      case 'usps':
        return `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${trackingNumber}`;
      default:
        return '#';
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
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'out for delivery':
        return 'bg-blue-100 text-blue-800';
      case 'in transit':
        return 'bg-yellow-100 text-yellow-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleClose = () => {
    setError(null);
    closeModal();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Track Order #${modalData?.orderNumber || ''}`}
      size="lg"
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          <span className="ml-3 text-gray-600">Loading tracking information...</span>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <div className="text-red-600 mb-4">{error}</div>
          <Button onClick={loadOrderData} variant="outline">
            Try Again
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center space-x-2 text-gray-700">
            <Package className="h-5 w-5" />
            <h3 className="font-medium">Tracking Information</h3>
          </div>

          {!trackingInfo ? (
            <div className="text-center py-8">
              <Truck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Tracking Available</h4>
              <p className="text-gray-600">
                This order hasn't been shipped yet or tracking information is not available.
              </p>
              {orderData && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Order Status:</strong> {orderData.status}
                  </p>
                  {orderData.orderDate && (
                    <p className="text-sm text-gray-700">
                      <strong>Order Date:</strong> {formatDate(orderData.orderDate)}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Tracking Header */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">Tracking Number</h4>
                    <p className="text-lg font-mono text-gray-800">{trackingInfo.trackingNumber}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(trackingInfo.status)}`}>
                    {trackingInfo.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Carrier</p>
                    <p className="font-medium">{trackingInfo.carrier}</p>
                  </div>
                  {trackingInfo.estimatedDelivery && (
                    <div>
                      <p className="text-sm text-gray-600">Estimated Delivery</p>
                      <p className="font-medium">{formatDate(trackingInfo.estimatedDelivery)}</p>
                    </div>
                  )}
                </div>

                {trackingInfo.trackingUrl && trackingInfo.trackingUrl !== '#' && (
                  <div className="mt-3">
                    <a
                      href={trackingInfo.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 text-purple-600 hover:text-purple-800 text-sm font-medium"
                    >
                      <span>Track on {trackingInfo.carrier} website</span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>

              {/* Tracking Events */}
              <div>
                <h4 className="font-medium text-gray-900 mb-4">Tracking History</h4>
                <div className="space-y-4">
                  {trackingInfo.events.map((event, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        <div className={`w-3 h-3 rounded-full ${
                          index === 0 ? 'bg-blue-500' : 'bg-gray-300'
                        }`}></div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h5 className="font-medium text-gray-900">{event.status}</h5>
                          <span className="text-sm text-gray-500">{formatDate(event.date)}</span>
                        </div>
                        <p className="text-gray-700">{event.description}</p>
                        {event.location && (
                          <div className="flex items-center space-x-1 mt-1">
                            <MapPin className="h-3 w-3 text-gray-400" />
                            <span className="text-sm text-gray-500">{event.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button onClick={handleClose} variant="outline">
              Close
            </Button>
          </div>

          <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
            💡 Tracking information is updated in real-time from the carrier's system.
          </div>
        </div>
      )}
    </BaseModal>
  );
}
