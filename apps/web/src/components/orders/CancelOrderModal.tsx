'use client';

import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';

interface CancelOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  orderNumber: string;
  loading?: boolean;
}

export function CancelOrderModal({ isOpen, onClose, onConfirm, orderNumber, loading = false }: CancelOrderModalProps) {
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      setError('Cancellation reason is required');
      return;
    }

    setCancelling(true);
    setError('');
    
    try {
      await onConfirm(reason.trim());
      setReason('');
      onClose();
    } catch (error) {
      console.error('Failed to cancel order:', error);
      setError('Failed to cancel order. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const handleClose = () => {
    if (!cancelling) {
      setReason('');
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h2 className="text-xl font-semibold text-gray-900">Cancel Order</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={cancelling}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <div className="flex items-center p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  Are you sure you want to cancel order #{orderNumber}?
                </p>
                <p className="text-sm text-red-700 mt-1">
                  This action cannot be undone. The order will be permanently cancelled.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cancellation Reason *
              </label>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Please provide a reason for cancelling this order..."
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none ${
                  error ? 'border-red-300' : 'border-gray-300'
                }`}
                rows={3}
                disabled={cancelling}
              />
              {error && (
                <p className="text-sm text-red-600 mt-1">{error}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={cancelling}
            >
              Keep Order
            </Button>
            <Button
              type="submit"
              disabled={cancelling || !reason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {cancelling ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Cancelling...
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Cancel Order
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
