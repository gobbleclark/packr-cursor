'use client';

import { useState } from 'react';
import { X, Save, Truck } from 'lucide-react';
import { Button } from '../ui/button';
import { Select } from '../ui/select';

interface ShippingMethod {
  carrier: string;
  service: string;
}

interface EditShippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipping: ShippingMethod;
  onSave: (shipping: ShippingMethod) => Promise<void>;
  loading?: boolean;
}

const CARRIERS = [
  { value: 'ups', label: 'UPS' },
  { value: 'fedex', label: 'FedEx' },
  { value: 'usps', label: 'USPS' },
  { value: 'dhl', label: 'DHL' },
  { value: 'ontrac', label: 'OnTrac' },
  { value: 'lasership', label: 'LaserShip' },
];

const SERVICES: Record<string, { value: string; label: string }[]> = {
  ups: [
    { value: 'ground', label: 'UPS Ground' },
    { value: '3_day_select', label: 'UPS 3 Day Select' },
    { value: '2nd_day_air', label: 'UPS 2nd Day Air' },
    { value: 'next_day_air', label: 'UPS Next Day Air' },
    { value: 'next_day_air_saver', label: 'UPS Next Day Air Saver' },
  ],
  fedex: [
    { value: 'ground', label: 'FedEx Ground' },
    { value: 'express_saver', label: 'FedEx Express Saver' },
    { value: '2day', label: 'FedEx 2Day' },
    { value: 'standard_overnight', label: 'FedEx Standard Overnight' },
    { value: 'priority_overnight', label: 'FedEx Priority Overnight' },
  ],
  usps: [
    { value: 'ground_advantage', label: 'USPS Ground Advantage' },
    { value: 'priority', label: 'USPS Priority Mail' },
    { value: 'priority_express', label: 'USPS Priority Mail Express' },
    { value: 'first_class', label: 'USPS First-Class Mail' },
  ],
  dhl: [
    { value: 'ground', label: 'DHL Ground' },
    { value: 'express', label: 'DHL Express' },
    { value: 'express_worldwide', label: 'DHL Express Worldwide' },
  ],
  ontrac: [
    { value: 'ground', label: 'OnTrac Ground' },
    { value: 'sunrise', label: 'OnTrac Sunrise' },
  ],
  lasership: [
    { value: 'routed_delivery', label: 'LaserShip Routed Delivery' },
    { value: 'next_day', label: 'LaserShip Next Day' },
  ],
};

export function EditShippingModal({ isOpen, onClose, shipping, onSave, loading = false }: EditShippingModalProps) {
  const [formData, setFormData] = useState<ShippingMethod>(shipping);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleCarrierChange = (carrier: string) => {
    setFormData(prev => ({
      carrier,
      service: '' // Reset service when carrier changes
    }));
    
    // Clear errors
    setErrors({});
  };

  const handleServiceChange = (service: string) => {
    setFormData(prev => ({ ...prev, service }));
    
    // Clear service error
    if (errors.service) {
      setErrors(prev => ({ ...prev, service: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.carrier) newErrors.carrier = 'Carrier is required';
    if (!formData.service) newErrors.service = 'Service is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save shipping method:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setFormData(shipping); // Reset form
      setErrors({});
      onClose();
    }
  };

  const availableServices = formData.carrier ? SERVICES[formData.carrier] || [] : [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Truck className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Edit Shipping Method</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Carrier *
            </label>
            <Select
              value={formData.carrier}
              onChange={(e) => handleCarrierChange(e.target.value)}
              className={errors.carrier ? 'border-red-300' : ''}
              disabled={saving}
            >
              <option value="">Select Carrier</option>
              {CARRIERS.map((carrier) => (
                <option key={carrier.value} value={carrier.value}>
                  {carrier.label}
                </option>
              ))}
            </Select>
            {errors.carrier && (
              <p className="text-sm text-red-600 mt-1">{errors.carrier}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Service *
            </label>
            <Select
              value={formData.service}
              onChange={(e) => handleServiceChange(e.target.value)}
              className={errors.service ? 'border-red-300' : ''}
              disabled={saving || !formData.carrier}
            >
              <option value="">Select Service</option>
              {availableServices.map((service) => (
                <option key={service.value} value={service.value}>
                  {service.label}
                </option>
              ))}
            </Select>
            {errors.service && (
              <p className="text-sm text-red-600 mt-1">{errors.service}</p>
            )}
            {formData.carrier && availableServices.length === 0 && (
              <p className="text-sm text-gray-500 mt-1">No services available for selected carrier</p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Shipping
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
