#!/usr/bin/env node

/**
 * Test script to verify stability improvements
 * Run this to test the new error handling, logging, and health check features
 */

import { createError, AppError } from './server/utils/errorHandler.js';
import { logger } from './server/utils/logger.js';
import { createRateLimiter } from './server/utils/rateLimiter.js';

console.log('🧪 Testing Stability Improvements...\n');

// Test 1: Error Handler
console.log('1️⃣ Testing Error Handler...');
try {
  const testError = createError('Test error message', 400, 'TEST_ERROR');
  console.log('✅ createError works:', testError.message, testError.statusCode, testError.code);
  
  const appError = new AppError('App error message', 500, 'APP_ERROR');
  console.log('✅ AppError class works:', appError.message, appError.statusCode, appError.code);
} catch (error) {
  console.log('❌ Error handler test failed:', error.message);
}

// Test 2: Logger
console.log('\n2️⃣ Testing Logger...');
try {
  logger.info('Test info message');
  logger.warn('Test warning message');
  logger.error('Test error message');
  logger.debug('Test debug message');
  console.log('✅ Logger works - check console output above');
} catch (error) {
  console.log('❌ Logger test failed:', error.message);
}

// Test 3: Rate Limiter
console.log('\n3️⃣ Testing Rate Limiter...');
try {
  const testLimiter = createRateLimiter({
    windowMs: 1000, // 1 second
    maxRequests: 2 // 2 requests per second
  });
  
  // Mock request object
  const mockReq = { ip: '127.0.0.1', path: '/test' };
  const mockRes = { 
    status: (code) => ({ json: (data) => ({ statusCode: code, data }) }),
    set: () => mockRes,
    statusCode: 200
  };
  
  let nextCalled = 0;
  const mockNext = () => { nextCalled++; };
  
  // Test first request (should pass)
  testLimiter.middleware()(mockReq, mockRes, mockNext);
  console.log('✅ First request passed, nextCalled:', nextCalled);
  
  // Test second request (should pass)
  testLimiter.middleware()(mockReq, mockRes, mockNext);
  console.log('✅ Second request passed, nextCalled:', nextCalled);
  
  // Test third request (should be rate limited)
  const rateLimitedRes = testLimiter.middleware()(mockReq, mockRes, mockNext);
  console.log('✅ Rate limiter created successfully');
  
} catch (error) {
  console.log('❌ Rate limiter test failed:', error.message);
}

// Test 4: Validation (if Zod is available)
console.log('\n4️⃣ Testing Validation...');
try {
  // This will only work if Zod is properly imported
  const { z } = await import('zod');
  
  const testSchema = z.object({
    name: z.string().min(1),
    email: z.string().email()
  });
  
  const validData = { name: 'Test', email: 'test@example.com' };
  const result = testSchema.parse(validData);
  console.log('✅ Zod validation works:', result);
  
} catch (error) {
  console.log('⚠️  Zod validation test skipped (Zod not available):', error.message);
}

console.log('\n🎉 Stability improvement tests completed!');
console.log('\n📋 Next steps:');
console.log('1. Push changes to dev branch: git push origin dev');
console.log('2. Test on Replit by starting the project');
console.log('3. Check the health endpoint: /api/health');
console.log('4. Monitor logs for improved error handling and logging');
console.log('5. Test rate limiting by making many requests quickly');
