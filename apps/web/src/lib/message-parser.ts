/**
 * Message Parser Service
 * Detects entities like order numbers, SKUs, tracking numbers in chat messages
 */

export interface DetectedEntity {
  type: 'order' | 'sku' | 'tracking' | 'customer';
  value: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
}

export interface ParsedMessage {
  originalContent: string;
  entities: DetectedEntity[];
  hasOrderNumber: boolean;
  orderNumbers: string[];
}

/**
 * Order number patterns to detect:
 * - #12345, ##12345 (legacy with hashes - normalize to clean number)
 * - Order 12345, Order #12345
 * - order number 12345
 * - Various formats with letters/numbers
 */
const ORDER_PATTERNS = [
  // Hash prefix: #12345, ##12345, #ORDER-12345 (normalize by removing hashes)
  /(?:^|\s)(#+)([A-Z]*[0-9]{3,}[A-Z0-9]*)/gi,
  
  // Order keyword: "Order 12345", "order #12345", "order number 12345"
  /(?:^|\s)order\s*(?:number\s*)?(#+)?([A-Z0-9]{3,})/gi,
  
  // Order ID patterns: "order id: 12345"
  /(?:^|\s)order\s*id\s*:?\s*(#+)?([A-Z0-9]{3,})/gi,
  
  // Standalone numbers that look like orders (5+ digits)
  /(?:^|\s)(#+)?([0-9]{5,})/g,
];

/**
 * SKU patterns to detect:
 * - SKU: ABC123, SKU-ABC123
 * - Product codes
 */
const SKU_PATTERNS = [
  /(?:^|\s)SKU\s*:?\s*([A-Z0-9\-_]{3,})/gi,
  /(?:^|\s)product\s*(?:code|id)\s*:?\s*([A-Z0-9\-_]{3,})/gi,
];

/**
 * Tracking number patterns
 */
const TRACKING_PATTERNS = [
  /(?:^|\s)tracking\s*(?:number|#)?\s*:?\s*([A-Z0-9]{8,})/gi,
  /(?:^|\s)track\s*:?\s*([A-Z0-9]{8,})/gi,
];

/**
 * Parse a message and extract entities
 */
export function parseMessage(content: string): ParsedMessage {
  const entities: DetectedEntity[] = [];
  const orderNumbers: string[] = [];

  // Detect order numbers
  ORDER_PATTERNS.forEach(pattern => {
    const matches = [...content.matchAll(pattern)];
    matches.forEach(match => {
      // Extract the clean order number (removing hash prefixes)
      let orderNumber = '';
      let orderNumberMatch = '';
      
      if (match[2]) {
        // Pattern with hash prefix: match[1] = hashes, match[2] = order number
        orderNumber = match[2].toUpperCase();
        orderNumberMatch = match[2];
      } else if (match[1] && !match[2]) {
        // Pattern without hash prefix: match[1] = order number
        orderNumber = match[1].toUpperCase();
        orderNumberMatch = match[1];
      }
      
      if (orderNumber && orderNumberMatch) {
        const startIndex = match.index! + match[0].indexOf(orderNumberMatch);
        
        entities.push({
          type: 'order',
          value: orderNumber, // Store clean order number without hashes
          startIndex,
          endIndex: startIndex + orderNumberMatch.length,
          confidence: calculateOrderConfidence(match[0], content)
        });
        
        if (!orderNumbers.includes(orderNumber)) {
          orderNumbers.push(orderNumber);
        }
      }
    });
  });

  // Detect SKUs
  SKU_PATTERNS.forEach(pattern => {
    const matches = [...content.matchAll(pattern)];
    matches.forEach(match => {
      if (match[1]) {
        entities.push({
          type: 'sku',
          value: match[1].toUpperCase(),
          startIndex: match.index! + match[0].indexOf(match[1]),
          endIndex: match.index! + match[0].indexOf(match[1]) + match[1].length,
          confidence: 0.9
        });
      }
    });
  });

  // Detect tracking numbers
  TRACKING_PATTERNS.forEach(pattern => {
    const matches = [...content.matchAll(pattern)];
    matches.forEach(match => {
      if (match[1]) {
        entities.push({
          type: 'tracking',
          value: match[1].toUpperCase(),
          startIndex: match.index! + match[0].indexOf(match[1]),
          endIndex: match.index! + match[0].indexOf(match[1]) + match[1].length,
          confidence: 0.95
        });
      }
    });
  });

  // Remove duplicates and sort by confidence
  const uniqueEntities = entities.filter((entity, index, self) => 
    index === self.findIndex(e => e.type === entity.type && e.value === entity.value)
  ).sort((a, b) => b.confidence - a.confidence);

  return {
    originalContent: content,
    entities: uniqueEntities,
    hasOrderNumber: orderNumbers.length > 0,
    orderNumbers: [...new Set(orderNumbers)] // Remove duplicates
  };
}

/**
 * Calculate confidence score for order number detection
 */
function calculateOrderConfidence(match: string, fullContent: string): number {
  let confidence = 0.7; // Base confidence
  
  // Higher confidence if explicitly mentioned as "order"
  if (/order/i.test(match)) {
    confidence += 0.2;
  }
  
  // Higher confidence if hash prefix
  if (match.includes('#')) {
    confidence += 0.1;
  }
  
  // Context clues in the full message
  const contextClues = [
    'change', 'update', 'cancel', 'modify', 'edit', 'ship', 'address', 
    'customer', 'delivery', 'tracking', 'status', 'problem', 'issue'
  ];
  
  if (contextClues.some(clue => fullContent.toLowerCase().includes(clue))) {
    confidence += 0.1;
  }
  
  return Math.min(confidence, 1.0);
}

/**
 * Check if a message suggests the user wants to take action on an order
 */
export function detectActionIntent(content: string, entities: DetectedEntity[]): {
  hasActionIntent: boolean;
  suggestedActions: string[];
  confidence: number;
} {
  const lowerContent = content.toLowerCase();
  
  const actionKeywords = {
    'update_address': ['address', 'ship to', 'shipping', 'delivery', 'move', 'relocate'],
    'cancel_order': ['cancel', 'stop', 'halt', 'abort', 'remove'],
    'modify_items': ['add', 'remove', 'change items', 'modify', 'different', 'swap'],
    'expedite': ['rush', 'urgent', 'asap', 'expedite', 'faster', 'priority'],
    'track_order': ['track', 'status', 'where is', 'shipped', 'delivery'],
    'contact_customer': ['customer', 'client', 'contact', 'call', 'email']
  };
  
  const suggestedActions: string[] = [];
  let totalConfidence = 0;
  
  Object.entries(actionKeywords).forEach(([action, keywords]) => {
    const matches = keywords.filter(keyword => lowerContent.includes(keyword));
    if (matches.length > 0) {
      suggestedActions.push(action);
      totalConfidence += matches.length * 0.2;
    }
  });
  
  const hasActionIntent = suggestedActions.length > 0 && entities.some(e => e.type === 'order');
  
  return {
    hasActionIntent,
    suggestedActions,
    confidence: Math.min(totalConfidence, 1.0)
  };
}

/**
 * Generate a smart response suggestion for the Boxio System bot
 * Note: This generates a basic response. The actual order status will be checked
 * when the bot response is created to show contextual actions.
 */
export function generateSystemResponse(parsedMessage: ParsedMessage): {
  shouldRespond: boolean;
  response: string;
  actionCards: Array<{
    action: string;
    label: string;
    icon: string;
    primary?: boolean;
  }>;
  orderNumber?: string;
} {
  if (!parsedMessage.hasOrderNumber) {
    return { shouldRespond: false, response: '', actionCards: [], orderNumber: undefined };
  }
  
  const actionIntent = detectActionIntent(parsedMessage.originalContent, parsedMessage.entities);
  const orderNumber = parsedMessage.orderNumbers[0]; // Use first detected order
  
  // Generate basic action cards - these will be refined based on actual order status
  const baseActionCards = [
    { action: 'view_order', label: 'View Order', icon: '👁️' },
    { action: 'edit_address', label: 'Edit Shipping Address', icon: '🏠' },
    { action: 'edit_carrier', label: 'Edit Shipping Carrier', icon: '🚚' },
    { action: 'track_order', label: 'Track Package', icon: '📦' },
    { action: 'edit_items', label: 'Edit Line Items', icon: '📝' }
  ];
  
  // If specific intent detected, prioritize those actions
  if (actionIntent.hasActionIntent) {
    const intentActionMap: Record<string, string> = {
      'update_address': 'edit_address',
      'modify_items': 'edit_items',
      'track_order': 'track_order',
      'expedite': 'edit_carrier'
    };
    
    // Mark matching actions as primary
    baseActionCards.forEach(card => {
      if (actionIntent.suggestedActions.some(intent => intentActionMap[intent] === card.action)) {
        card.primary = true;
      }
    });
  }
  
  return {
    shouldRespond: true,
    response: `I can help you with order #${orderNumber}! What would you like to do?`,
    actionCards: baseActionCards,
    orderNumber
  };
}
