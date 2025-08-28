export default async function globalSetup() {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/packr_test';
  process.env.REDIS_URL = 'redis://localhost:6379/1'; // Use different Redis DB for tests
  process.env.SKIP_WEBHOOK_SIGNATURE_VALIDATION = 'true';
  
  // Mock external service URLs
  process.env.TRACKSTAR_API_URL = 'https://test.trackstar.com';
  process.env.TRACKSTAR_API_KEY = 'test-api-key';
  
  console.log('🧪 Global test setup completed');
}
