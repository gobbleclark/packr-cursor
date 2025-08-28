'use client';

import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { useModal } from '../../contexts/ModalContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';

interface ShippingAddress {
  fullName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
}

export function ChatEditAddressModal() {
  const { activeModal, modalData, closeModal } = useModal();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [addressForm, setAddressForm] = useState<ShippingAddress>({
    fullName: '',
    company: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    phone: '',
    email: ''
  });

  const isOpen = activeModal === 'edit_address';

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
        
        // Populate form with current address
        const address = data.order.shippingAddress;
        if (address) {
          setAddressForm({
            fullName: address.fullName || '',
            company: address.company || '',
            address1: address.address1 || '',
            address2: address.address2 || '',
            city: address.city || '',
            state: address.state || '',
            postalCode: address.postalCode || address.zipCode || '',
            country: address.country || 'US',
            phone: address.phone || '',
            email: address.email || ''
          });
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

  const handleSave = async () => {
    if (!modalData?.orderNumber) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Use the same Trackstar write-through endpoint as the Orders feature
      const response = await fetch(`http://localhost:4000/api/orders/${modalData.orderNumber}/address`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(addressForm)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          closeModal();
        }, 1500);
      } else {
        setError(data.error || 'Failed to update shipping address');
      }
    } catch (err) {
      setError('Failed to update shipping address');
      console.error('Error updating address:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    closeModal();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Edit Shipping Address - Order #${modalData?.orderNumber || ''}`}
      size="md"
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
                    Shipping address updated successfully!
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

          <div className="flex items-center space-x-2 text-gray-700">
            <MapPin className="h-5 w-5" />
            <h3 className="font-medium">Update Shipping Address</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <Input
                value={addressForm.fullName}
                onChange={(e) => setAddressForm({...addressForm, fullName: e.target.value})}
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company
              </label>
              <Input
                value={addressForm.company || ''}
                onChange={(e) => setAddressForm({...addressForm, company: e.target.value})}
                placeholder="Company Name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address Line 1 *
            </label>
            <Input
              value={addressForm.address1}
              onChange={(e) => setAddressForm({...addressForm, address1: e.target.value})}
              placeholder="123 Main Street"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address Line 2
            </label>
            <Input
              value={addressForm.address2 || ''}
              onChange={(e) => setAddressForm({...addressForm, address2: e.target.value})}
              placeholder="Apt, Suite, Unit, etc."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City *
              </label>
              <Input
                value={addressForm.city}
                onChange={(e) => setAddressForm({...addressForm, city: e.target.value})}
                placeholder="New York"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State *
              </label>
              <Input
                value={addressForm.state}
                onChange={(e) => setAddressForm({...addressForm, state: e.target.value})}
                placeholder="NY"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ZIP Code *
              </label>
              <Input
                value={addressForm.postalCode}
                onChange={(e) => setAddressForm({...addressForm, postalCode: e.target.value})}
                placeholder="10001"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country *
              </label>
              <Input
                value={addressForm.country}
                onChange={(e) => setAddressForm({...addressForm, country: e.target.value})}
                placeholder="US"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <Input
                value={addressForm.phone || ''}
                onChange={(e) => setAddressForm({...addressForm, phone: e.target.value})}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

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
              disabled={loading || !addressForm.fullName || !addressForm.address1 || !addressForm.city || !addressForm.state || !addressForm.postalCode}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                'Update Address'
              )}
            </Button>
          </div>

          <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
            💡 This will update the shipping address in both Packr and Trackstar. Changes are synchronized in real-time.
          </div>
        </div>
      )}
    </BaseModal>
  );
}
