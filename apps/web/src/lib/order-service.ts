/**
 * Order Service for fetching order details and status
 */

import { API_BASE, buildApiUrl } from './api-config';

export interface OrderStatus {
  id: string;
  orderNumber: string;
  customerName?: string;
  status: 'unfulfilled' | 'fulfilled' | 'cancelled' | 'pending' | 'shipped';
  canEditItems: boolean;
  canTrack: boolean;
  canEditAddress: boolean;
  canEditCarrier: boolean;
}

class OrderService {
  private getAuthHeaders() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Get order status by order number
   */
  async getOrderStatus(orderNumber: string): Promise<OrderStatus | null> {
    try {
      const response = await fetch(`${API_BASE}/api/orders/status/${orderNumber}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        console.warn(`Order ${orderNumber} not found or access denied`);
        return null;
      }

      const data = await response.json();
      console.log('📦 Order service response:', data);
      return data.order;
    } catch (error) {
      console.error('Error fetching order status:', error);
      return null;
    }
  }

  /**
   * Filter action cards based on order status
   */
  filterActionsByOrderStatus(
    actionCards: Array<{
      action: string;
      label: string;
      icon: string;
      primary?: boolean;
      disabled?: boolean;
      disabledReason?: string;
    }>,
    orderStatus: OrderStatus | null
  ): Array<{
    action: string;
    label: string;
    icon: string;
    primary?: boolean;
    disabled?: boolean;
    disabledReason?: string;
  }> {
    if (!orderStatus) {
      // If we can't get order status, show all actions but mark some as potentially unavailable
      return actionCards.map(card => ({
        ...card,
        disabled: card.action === 'track_order' || card.action === 'edit_items',
        disabledReason: card.action === 'track_order' 
          ? 'Order must be fulfilled to track'
          : card.action === 'edit_items'
          ? 'Order must be unfulfilled to edit items'
          : undefined
      }));
    }

    return actionCards.map(card => {
      const result = { ...card };

      switch (card.action) {
        case 'track_order':
          if (!orderStatus.canTrack) {
            result.disabled = true;
            result.disabledReason = 'Order must be fulfilled to track';
          }
          break;

        case 'edit_items':
          if (!orderStatus.canEditItems) {
            result.disabled = true;
            result.disabledReason = 'Cannot edit items after order is fulfilled';
          }
          break;

        case 'edit_address':
          if (!orderStatus.canEditAddress) {
            result.disabled = true;
            result.disabledReason = 'Address cannot be changed after shipping';
          }
          break;

        case 'edit_carrier':
          if (!orderStatus.canEditCarrier) {
            result.disabled = true;
            result.disabledReason = 'Carrier cannot be changed after shipping';
          }
          break;

        default:
          // view_order and other actions are always available
          break;
      }

      return result;
    }).filter(card => {
      // Remove disabled actions that don't make sense to show
      if (card.disabled && (card.action === 'track_order' || card.action === 'edit_items')) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get contextual action cards for an order
   */
  async getContextualActions(
    orderNumber: string,
    baseActionCards: Array<{
      action: string;
      label: string;
      icon: string;
      primary?: boolean;
    }>
  ): Promise<Array<{
    action: string;
    label: string;
    icon: string;
    primary?: boolean;
    disabled?: boolean;
    disabledReason?: string;
  }>> {
    const orderStatus = await this.getOrderStatus(orderNumber);
    return this.filterActionsByOrderStatus(baseActionCards, orderStatus);
  }
}

export const orderService = new OrderService();
