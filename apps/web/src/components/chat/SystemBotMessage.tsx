'use client';

import { useState } from 'react';
import { Bot, Eye, Home, Package, Phone, MessageCircle, Zap, X, Edit, Truck } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

interface ActionCard {
  action: string;
  label: string;
  icon: string;
  primary?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

interface SystemBotMessageProps {
  message: string;
  actionCards: ActionCard[];
  orderNumber?: string;
  onActionClick: (action: string, orderNumber?: string) => void;
  onDismiss?: () => void;
  loading?: boolean;
  threeplName?: string;
}

const iconMap: Record<string, React.ComponentType<any>> = {
  '👁️': Eye,
  '🏠': Home,
  '📦': Package,
  '📞': Phone,
  '💬': MessageCircle,
  '🚀': Zap,
  '📝': Edit,
  '❌': X,
  '🚚': Truck,
};

export function SystemBotMessage({ 
  message, 
  actionCards, 
  orderNumber,
  onActionClick,
  onDismiss,
  loading = false,
  threeplName
}: SystemBotMessageProps) {
  const { openModal } = useModal();
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const handleActionClick = (action: string) => {
    // Handle modal actions
    if (action === 'view_order' && orderNumber) {
      openModal('view_order', { orderNumber });
      return;
    }
    
    if (action === 'edit_address' && orderNumber) {
      openModal('edit_address', { orderNumber });
      return;
    }
    
    if (action === 'edit_carrier' && orderNumber) {
      openModal('edit_carrier', { orderNumber });
      return;
    }
    
    if (action === 'edit_items' && orderNumber) {
      openModal('edit_items', { orderNumber });
      return;
    }
    
    if (action === 'track_order' && orderNumber) {
      openModal('track_order', { orderNumber });
      return;
    }
    
    // Fallback to original handler for other actions
    onActionClick(action, orderNumber);
  };

  if (!isVisible) return null;

  return (
    <div className="px-4 mb-3">
      <div className="flex justify-start">
        <div className="max-w-md">
          {/* Bot Avatar and Header */}
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
              <Bot className="h-3 w-3 text-white" />
            </div>
            <span className="text-xs font-medium text-gray-600">
              {threeplName ? `${threeplName} Team` : 'Support Team'}
            </span>
            <span className="text-xs text-gray-400">just now</span>
          </div>

          {/* Message Bubble */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3 relative">
            {/* Dismiss Button */}
            {onDismiss && (
              <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 p-1 hover:bg-white hover:bg-opacity-50 rounded-full transition-colors"
                title="Dismiss"
              >
                <X className="h-3 w-3 text-gray-400" />
              </button>
            )}

            {/* Bot Message */}
            <p className="text-sm text-gray-700 mb-3 pr-6">
              {message}
            </p>

            {/* Action Cards */}
            {(actionCards.length > 0 || loading) && (
              <div className="space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                    <span className="ml-2 text-sm text-gray-600">Loading order details...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {actionCards.map((card, index) => {
                      const IconComponent = iconMap[card.icon] || MessageCircle;
                      
                      return (
                        <div key={index} className="relative">
                          <button
                            onClick={() => !card.disabled && handleActionClick(card.action)}
                            disabled={card.disabled}
                            className={`w-full flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left ${
                              card.disabled
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : card.primary
                                ? 'bg-blue-500 text-white hover:bg-blue-600'
                                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                            }`}
                            title={card.disabled ? card.disabledReason : undefined}
                          >
                            <IconComponent className="h-4 w-4 flex-shrink-0" />
                            <span>{card.label}</span>
                            {card.disabled && card.disabledReason && (
                              <span className="ml-auto text-xs text-gray-400">
                                ⚠️
                              </span>
                            )}
                          </button>
                          {card.disabled && card.disabledReason && (
                            <div className="absolute left-0 right-0 top-full mt-1 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                              {card.disabledReason}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Quick Info */}
                {orderNumber && !loading && (
                  <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-purple-200">
                    💡 These actions will update order #{orderNumber} in real-time
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
