/**
 * Trackstar Webhook Management Service
 * Comprehensive webhook configuration and management
 */

export interface TrackstarWebhookEvent {
  id: string;
  name: string;
  description: string;
  category: 'orders' | 'inventory' | 'products' | 'receiving' | 'returns' | 'warehouse' | 'costs' | 'integration';
  required?: boolean;
}

export class TrackstarWebhookManager {
  
  /**
   * Complete list of Trackstar webhook events
   * Based on standard WMS operations and Trackstar's universal API
   */
  static readonly WEBHOOK_EVENTS: TrackstarWebhookEvent[] = [
    // Order Events (Critical for 3PL operations)
    {
      id: 'order.created',
      name: 'Order Created',
      description: 'New order received from customer',
      category: 'orders',
      required: true
    },
    {
      id: 'order.updated',
      name: 'Order Updated',
      description: 'Order details or status changed',
      category: 'orders',
      required: true
    },
    {
      id: 'order.cancelled',
      name: 'Order Cancelled',
      description: 'Order was cancelled before fulfillment',
      category: 'orders',
      required: true
    },
    {
      id: 'order.allocated',
      name: 'Order Allocated',
      description: 'Inventory reserved for order',
      category: 'orders',
      required: true
    },
    {
      id: 'order.picked',
      name: 'Order Picked',
      description: 'Items picked from warehouse shelves',
      category: 'orders'
    },
    {
      id: 'order.packed',
      name: 'Order Packed',
      description: 'Order packed and ready to ship',
      category: 'orders'
    },
    {
      id: 'order.shipped',
      name: 'Order Shipped',
      description: 'Order dispatched with tracking number',
      category: 'orders',
      required: true
    },
    {
      id: 'order.delivered',
      name: 'Order Delivered',
      description: 'Order successfully delivered to customer',
      category: 'orders',
      required: true
    },
    {
      id: 'order.returned',
      name: 'Order Returned',
      description: 'Order returned by customer',
      category: 'orders'
    },
    
    // Inventory Events (Critical for stock management)
    {
      id: 'inventory.updated',
      name: 'Inventory Updated',
      description: 'Stock levels changed for SKU',
      category: 'inventory',
      required: true
    },
    {
      id: 'inventory.low_stock',
      name: 'Low Stock Alert',
      description: 'SKU below reorder threshold',
      category: 'inventory',
      required: true
    },
    {
      id: 'inventory.out_of_stock',
      name: 'Out of Stock',
      description: 'SKU completely out of stock',
      category: 'inventory',
      required: true
    },
    {
      id: 'inventory.restock',
      name: 'Restocked',
      description: 'New inventory received for SKU',
      category: 'inventory'
    },
    {
      id: 'inventory.cycle_count',
      name: 'Cycle Count Completed',
      description: 'Physical inventory count completed',
      category: 'inventory'
    },
    
    // Product Events
    {
      id: 'product.created',
      name: 'Product Created',
      description: 'New product added to catalog',
      category: 'products'
    },
    {
      id: 'product.updated',
      name: 'Product Updated',
      description: 'Product details or pricing changed',
      category: 'products'
    },
    {
      id: 'product.discontinued',
      name: 'Product Discontinued',
      description: 'Product no longer available',
      category: 'products'
    },
    
    // Receiving/Inbound Events
    {
      id: 'purchase_order.received',
      name: 'Purchase Order Received',
      description: 'Inbound shipment received at warehouse',
      category: 'receiving'
    },
    {
      id: 'receipt.created',
      name: 'Receipt Created',
      description: 'New inbound receipt started',
      category: 'receiving'
    },
    {
      id: 'receipt.completed',
      name: 'Receipt Completed',
      description: 'Inbound receipt fully processed',
      category: 'receiving'
    },
    
    // Return Events
    {
      id: 'return.initiated',
      name: 'Return Initiated',
      description: 'Customer initiated return process',
      category: 'returns'
    },
    {
      id: 'return.received',
      name: 'Return Received',
      description: 'Return package received at warehouse',
      category: 'returns'
    },
    {
      id: 'return.processed',
      name: 'Return Processed',
      description: 'Return inspected and restocked',
      category: 'returns'
    },
    
    // Warehouse Events
    {
      id: 'warehouse.capacity_alert',
      name: 'Warehouse Capacity Alert',
      description: 'Warehouse approaching capacity limit',
      category: 'warehouse'
    },
    {
      id: 'shipment.created',
      name: 'Shipment Created',
      description: 'New shipment generated (alternative to order.shipped)',
      category: 'orders'
    },
    
    // Cost Events (Important for 3PL billing)
    {
      id: 'cost.updated',
      name: 'Cost Updated',
      description: 'Fulfillment or storage costs updated',
      category: 'costs'
    },
    {
      id: 'billing.monthly_summary',
      name: 'Monthly Billing Summary',
      description: 'Monthly cost summary available',
      category: 'costs'
    },
    
    // Integration Events
    {
      id: 'integration.connected',
      name: 'Integration Connected',
      description: 'WMS integration successfully connected',
      category: 'integration'
    },
    {
      id: 'integration.disconnected',
      name: 'Integration Disconnected',
      description: 'WMS integration lost connection',
      category: 'integration'
    },
    {
      id: 'integration.error',
      name: 'Integration Error',
      description: 'Error occurred in WMS integration',
      category: 'integration'
    }
  ];

  /**
   * Get all available webhook events
   */
  static getAllEvents(): TrackstarWebhookEvent[] {
    return this.WEBHOOK_EVENTS;
  }

  /**
   * Get required webhook events for basic functionality
   */
  static getRequiredEvents(): TrackstarWebhookEvent[] {
    return this.WEBHOOK_EVENTS.filter(event => event.required);
  }

  /**
   * Get events by category
   */
  static getEventsByCategory(category: string): TrackstarWebhookEvent[] {
    return this.WEBHOOK_EVENTS.filter(event => event.category === category);
  }

  /**
   * Generate webhook configuration for Trackstar setup
   */
  static generateWebhookConfig(baseUrl: string, events?: string[]): any {
    const eventsToSubscribe = events || this.getRequiredEvents().map(e => e.id);
    
    return {
      webhook_url: `${baseUrl}/api/trackstar/webhook`,
      events: eventsToSubscribe,
      secret_token: process.env.TRACKSTAR_WEBHOOK_SECRET || 'trackstar_webhook_secret_2025',
      active: true,
      delivery_format: 'json',
      retry_policy: {
        max_retries: 3,
        backoff_strategy: 'exponential'
      }
    };
  }

  /**
   * Validate webhook signature (if Trackstar provides one)
   */
  static validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
    // Implementation would depend on Trackstar's signature method
    // Common approaches: HMAC-SHA256, similar to GitHub/Stripe
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(`sha256=${expectedSignature}`),
      Buffer.from(signature)
    );
  }

  /**
   * Get webhook events summary for UI display
   */
  static getEventsSummary(): { [category: string]: number } {
    const summary: { [category: string]: number } = {};
    
    this.WEBHOOK_EVENTS.forEach(event => {
      summary[event.category] = (summary[event.category] || 0) + 1;
    });
    
    return summary;
  }

  /**
   * Check if webhook event is supported
   */
  static isEventSupported(eventId: string): boolean {
    return this.WEBHOOK_EVENTS.some(event => event.id === eventId);
  }

  /**
   * Get event description
   */
  static getEventDescription(eventId: string): string | null {
    const event = this.WEBHOOK_EVENTS.find(e => e.id === eventId);
    return event ? event.description : null;
  }
}