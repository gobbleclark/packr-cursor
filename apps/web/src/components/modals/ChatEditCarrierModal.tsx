'use client';

import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { useModal } from '../../contexts/ModalContext';
import { Button } from '../ui/button';
import { Select } from '../ui/select';
import { Truck, Loader2, AlertCircle } from 'lucide-react';

interface CarrierOption {
  carrier: string;
  service: string;
  label: string;
}

export function ChatEditCarrierModal() {
  const { activeModal, modalData, closeModal } = useModal();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [carrierOptions, setCarrierOptions] = useState<CarrierOption[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [selectedService, setSelectedService] = useState('');

  const isOpen = activeModal === 'edit_carrier';

  useEffect(() => {
    if (isOpen && modalData?.orderNumber) {
      loadOrderData();
      loadCarrierOptions();
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
        
        // Set current carrier/service if available
        const currentCarrier = data.order.rawData?.shipping_method?.carrier || '';
        const currentService = data.order.rawData?.shipping_method?.service || '';
        setSelectedCarrier(currentCarrier);
        setSelectedService(currentService);
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

  const loadCarrierOptions = async () => {
    try {
      // Mock carrier options - in real implementation, this would come from Trackstar
      const mockOptions: CarrierOption[] = [
        { carrier: 'UPS', service: 'Ground', label: 'UPS Ground' },
        { carrier: 'UPS', service: '2nd Day Air', label: 'UPS 2nd Day Air' },
        { carrier: 'UPS', service: 'Next Day Air', label: 'UPS Next Day Air' },
        { carrier: 'FedEx', service: 'Ground', label: 'FedEx Ground' },
        { carrier: 'FedEx', service: '2Day', label: 'FedEx 2Day' },
        { carrier: 'FedEx', service: 'Priority Overnight', label: 'FedEx Priority Overnight' },
        { carrier: 'USPS', service: 'Ground Advantage', label: 'USPS Ground Advantage' },
        { carrier: 'USPS', service: 'Priority Mail', label: 'USPS Priority Mail' },
        { carrier: 'USPS', service: 'Priority Mail Express', label: 'USPS Priority Mail Express' }
      ];
      setCarrierOptions(mockOptions);
    } catch (err) {
      console.error('Error loading carrier options:', err);
    }
  };

  const handleSave = async () => {
    if (!modalData?.orderNumber || !selectedCarrier || !selectedService) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Use the same Trackstar write-through endpoint as the Orders feature
      const response = await fetch(buildApiUrl('orders/${modalData.orderNumber}/shipping'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          carrier: selectedCarrier,
          service: selectedService
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          closeModal();
        }, 1500);
      } else {
        setError(data.error || 'Failed to update shipping carrier');
      }
    } catch (err) {
      setError('Failed to update shipping carrier');
      console.error('Error updating carrier:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCarrierServiceChange = (value: string) => {
    const option = carrierOptions.find(opt => `${opt.carrier}|${opt.service}` === value);
    if (option) {
      setSelectedCarrier(option.carrier);
      setSelectedService(option.service);
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
      title={`Edit Shipping Carrier - Order #${modalData?.orderNumber || ''}`}
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
                    Shipping carrier updated successfully!
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
            <Truck className="h-5 w-5" />
            <h3 className="font-medium">Update Shipping Carrier & Service</h3>
          </div>

          {orderData && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Current Shipping Method</h4>
              <p className="text-gray-700">
                {orderData.rawData?.shipping_method?.carrier || 'Not set'} - {orderData.rawData?.shipping_method?.service || 'Not set'}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select New Carrier & Service *
            </label>
            <Select
              value={selectedCarrier && selectedService ? `${selectedCarrier}|${selectedService}` : ''}
              onChange={(e) => handleCarrierServiceChange(e.target.value)}
              className="w-full"
            >
              <option value="">Select a shipping method...</option>
              {carrierOptions.map((option) => (
                <option 
                  key={`${option.carrier}|${option.service}`} 
                  value={`${option.carrier}|${option.service}`}
                >
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {selectedCarrier && selectedService && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Selected Shipping Method</h4>
              <p className="text-blue-800">
                <strong>{selectedCarrier}</strong> - {selectedService}
              </p>
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
              disabled={loading || !selectedCarrier || !selectedService}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                'Update Carrier'
              )}
            </Button>
          </div>

          <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
            💡 This will update the shipping carrier in both Packr and Trackstar. Changes are synchronized in real-time.
          </div>
        </div>
      )}
    </BaseModal>
  );
}
