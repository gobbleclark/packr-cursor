/**
 * Utility functions for order processing
 */

/**
 * Normalize order number by removing hash prefixes
 * Examples:
 * - "#12345" -> "12345"
 * - "##67247" -> "67247"
 * - "ORD-001" -> "ORD-001" (unchanged)
 * - "12345" -> "12345" (unchanged)
 */
export function normalizeOrderNumber(orderNumber: string): string {
  if (!orderNumber || typeof orderNumber !== 'string') {
    return orderNumber;
  }
  
  // Remove any leading hash characters
  return orderNumber.replace(/^#+/, '').trim();
}

/**
 * Format order number for display with single hash prefix
 * Examples:
 * - "12345" -> "#12345"
 * - "ORD-001" -> "#ORD-001"
 */
export function formatOrderNumberForDisplay(orderNumber: string): string {
  if (!orderNumber || typeof orderNumber !== 'string') {
    return orderNumber;
  }
  
  const normalized = normalizeOrderNumber(orderNumber);
  
  // Don't add hash to empty strings
  if (!normalized) {
    return normalized;
  }
  
  return `#${normalized}`;
}
