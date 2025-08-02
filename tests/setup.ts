/**
 * Test setup file
 * Configures testing environment and global test utilities
 */

// Extend Jest timeout for API calls
jest.setTimeout(30000);

// Global test utilities
global.testConfig = {
  apiUrl: process.env.TEST_API_URL || 'http://localhost:5000/api',
  testBrandId: 'dce4813e-aeb7-41fe-bb00-a36e314288f3',
};

// Mock console methods to reduce noise in tests unless debugging
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: console.error, // Keep errors visible
  };
}