import { normalizeOrderNumber, formatOrderNumberForDisplay } from '../../utils/order-utils';

describe('Order Utils', () => {
  describe('normalizeOrderNumber', () => {
    it('should remove single hash prefix', () => {
      expect(normalizeOrderNumber('#12345')).toBe('12345');
    });

    it('should remove double hash prefix', () => {
      expect(normalizeOrderNumber('##67247')).toBe('67247');
    });

    it('should remove multiple hash prefixes', () => {
      expect(normalizeOrderNumber('###ORDER-123')).toBe('ORDER-123');
    });

    it('should leave order numbers without hashes unchanged', () => {
      expect(normalizeOrderNumber('ORD-001')).toBe('ORD-001');
      expect(normalizeOrderNumber('12345')).toBe('12345');
      expect(normalizeOrderNumber('114-7731675-0582637')).toBe('114-7731675-0582637');
    });

    it('should handle empty or invalid input', () => {
      expect(normalizeOrderNumber('')).toBe('');
      expect(normalizeOrderNumber(null as any)).toBe(null);
      expect(normalizeOrderNumber(undefined as any)).toBe(undefined);
    });

    it('should trim whitespace after removing hashes', () => {
      expect(normalizeOrderNumber('# 12345 ')).toBe('12345');
      expect(normalizeOrderNumber('## ORDER-123 ')).toBe('ORDER-123');
    });
  });

  describe('formatOrderNumberForDisplay', () => {
    it('should add hash prefix to clean order numbers', () => {
      expect(formatOrderNumberForDisplay('12345')).toBe('#12345');
      expect(formatOrderNumberForDisplay('ORD-001')).toBe('#ORD-001');
    });

    it('should normalize then add hash prefix', () => {
      expect(formatOrderNumberForDisplay('#12345')).toBe('#12345');
      expect(formatOrderNumberForDisplay('##67247')).toBe('#67247');
    });

    it('should handle empty or invalid input', () => {
      expect(formatOrderNumberForDisplay('')).toBe('');
      expect(formatOrderNumberForDisplay(null as any)).toBe(null);
      expect(formatOrderNumberForDisplay(undefined as any)).toBe(undefined);
    });
  });
});
