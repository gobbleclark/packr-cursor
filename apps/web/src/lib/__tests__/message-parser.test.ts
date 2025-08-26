import { parseMessage, detectActionIntent, generateSystemResponse } from '../message-parser';

describe('Message Parser', () => {
  describe('parseMessage', () => {
    test('detects order numbers with hash prefix', () => {
      const result = parseMessage('Customer wants to change address for #12345');
      
      expect(result.hasOrderNumber).toBe(true);
      expect(result.orderNumbers).toContain('12345');
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe('order');
      expect(result.entities[0].value).toBe('12345');
    });

    test('detects order numbers with "order" keyword', () => {
      const result = parseMessage('Please cancel order 67890');
      
      expect(result.hasOrderNumber).toBe(true);
      expect(result.orderNumbers).toContain('67890');
    });

    test('detects multiple order numbers', () => {
      const result = parseMessage('Need to update #12345 and order 67890');
      
      expect(result.hasOrderNumber).toBe(true);
      expect(result.orderNumbers).toHaveLength(2);
      expect(result.orderNumbers).toContain('12345');
      expect(result.orderNumbers).toContain('67890');
    });

    test('does not detect short numbers as orders', () => {
      const result = parseMessage('I have 3 items in my cart');
      
      expect(result.hasOrderNumber).toBe(false);
      expect(result.orderNumbers).toHaveLength(0);
    });

    test('detects SKUs', () => {
      const result = parseMessage('SKU: ABC123 is out of stock');
      
      expect(result.entities.some(e => e.type === 'sku')).toBe(true);
      expect(result.entities.find(e => e.type === 'sku')?.value).toBe('ABC123');
    });
  });

  describe('detectActionIntent', () => {
    test('detects address change intent', () => {
      const parsed = parseMessage('Need to change shipping address for #12345');
      const intent = detectActionIntent(parsed.originalContent, parsed.entities);
      
      expect(intent.hasActionIntent).toBe(true);
      expect(intent.suggestedActions).toContain('update_address');
    });

    test('detects cancellation intent', () => {
      const parsed = parseMessage('Please cancel order #12345');
      const intent = detectActionIntent(parsed.originalContent, parsed.entities);
      
      expect(intent.hasActionIntent).toBe(true);
      expect(intent.suggestedActions).toContain('cancel_order');
    });

    test('detects expedite intent', () => {
      const parsed = parseMessage('Can we rush order #12345? Customer needs it ASAP');
      const intent = detectActionIntent(parsed.originalContent, parsed.entities);
      
      expect(intent.hasActionIntent).toBe(true);
      expect(intent.suggestedActions).toContain('expedite');
    });
  });

  describe('generateSystemResponse', () => {
    test('generates response for order mention with action intent', () => {
      const parsed = parseMessage('Need to change address for order #12345');
      const response = generateSystemResponse(parsed);
      
      expect(response.shouldRespond).toBe(true);
      expect(response.response).toContain('12345');
      expect(response.actionCards.some(card => card.action === 'update_address')).toBe(true);
    });

    test('generates generic response for order mention without clear intent', () => {
      const parsed = parseMessage('What is the status of order #12345?');
      const response = generateSystemResponse(parsed);
      
      expect(response.shouldRespond).toBe(true);
      expect(response.response).toContain('12345');
      expect(response.actionCards.length).toBeGreaterThan(0);
    });

    test('does not respond when no order number detected', () => {
      const parsed = parseMessage('Hello, how are you?');
      const response = generateSystemResponse(parsed);
      
      expect(response.shouldRespond).toBe(false);
    });
  });
});
