import { logger } from '../../utils/logger';

describe('Logger', () => {
  it('should have required log methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should log messages without throwing', () => {
    expect(() => {
      logger.info('Test info message');
      logger.warn('Test warn message');
      logger.error('Test error message');
      logger.debug('Test debug message');
    }).not.toThrow();
  });
});
