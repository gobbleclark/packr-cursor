'use client';

import { useState } from 'react';
import { X, Save, Package, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface OrderItem {
  id?: string;
  sku: string;
  productName?: string;
  quantity: number;
  price?: number;
  total?: number;
}

interface EditItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: OrderItem[];
  onSave: (items: OrderItem[]) => Promise<void>;
  loading?: boolean;
}

export function EditItemsModal({ isOpen, onClose, items, onSave, loading = false }: EditItemsModalProps) {
  const [formItems, setFormItems] = useState<OrderItem[]>(items.map(item => ({ ...item })));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleItemChange = (index: number, field: keyof OrderItem, value: string | number) => {
    setFormItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      return newItems;
    });
    
    // Clear errors for this item
    const errorKey = `${index}-${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const addItem = () => {
    setFormItems(prev => [...prev, { sku: '', quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    if (formItems.length > 1) {
      setFormItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    formItems.forEach((item, index) => {
      if (!item.sku.trim()) {
        newErrors[`${index}-sku`] = 'SKU is required';
      }
      if (item.quantity <= 0) {
        newErrors[`${index}-quantity`] = 'Quantity must be greater than 0';
      }
      if (!Number.isInteger(item.quantity)) {
        newErrors[`${index}-quantity`] = 'Quantity must be a whole number';
      }
    });

    // Check for duplicate SKUs
    const skus = formItems.map(item => item.sku.trim().toLowerCase()).filter(sku => sku);
    const duplicateSkus = skus.filter((sku, index) => skus.indexOf(sku) !== index);
    
    if (duplicateSkus.length > 0) {
      formItems.forEach((item, index) => {
        if (duplicateSkus.includes(item.sku.trim().toLowerCase())) {
          newErrors[`${index}-sku`] = 'Duplicate SKU found';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setSaving(true);
    try {
      // Filter out empty items and prepare for API
      const validItems = formItems
        .filter(item => item.sku.trim())
        .map(item => ({
          ...item,
          sku: item.sku.trim(),
          quantity: Number(item.quantity)
        }));
      
      await onSave(validItems);
      onClose();
    } catch (error) {
      console.error('Failed to save items:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setFormItems(items.map(item => ({ ...item }))); // Reset form
      setErrors({});
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Edit Order Items</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4 mb-6">
            {formItems.map((item, index) => (
              <div key={index} className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SKU *
                    </label>
                    <Input
                      value={item.sku}
                      onChange={(e) => handleItemChange(index, 'sku', e.target.value)}
                      placeholder="Enter SKU"
                      className={errors[`${index}-sku`] ? 'border-red-300' : ''}
                      disabled={saving}
                    />
                    {errors[`${index}-sku`] && (
                      <p className="text-sm text-red-600 mt-1">{errors[`${index}-sku`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product Name
                    </label>
                    <Input
                      value={item.productName || ''}
                      onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                      placeholder="Product name (optional)"
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity *
                    </label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                      placeholder="Qty"
                      className={errors[`${index}-quantity`] ? 'border-red-300' : ''}
                      disabled={saving}
                    />
                    {errors[`${index}-quantity`] && (
                      <p className="text-sm text-red-600 mt-1">{errors[`${index}-quantity`]}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center pt-6">
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    disabled={formItems.length <= 1 || saving}
                    className="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={addItem}
              disabled={saving}
              className="flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>

            <div className="flex space-x-3">
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
                    Save Items
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
