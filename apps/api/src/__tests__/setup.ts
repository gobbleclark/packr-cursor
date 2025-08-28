// import { PrismaClient } from '@packr/database';

// Mock logger to avoid console spam in tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock Redis connection
jest.mock('../lib/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    disconnect: jest.fn()
  }
}));

// Mock S3 client
jest.mock('../lib/s3', () => ({
  s3Client: {
    send: jest.fn()
  },
  getSignedUrl: jest.fn()
}));

// Mock Socket.IO
jest.mock('../lib/socket', () => ({
  io: {
    emit: jest.fn(),
    to: jest.fn(() => ({
      emit: jest.fn()
    }))
  }
}));

// Mock BullMQ
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0
    })
  })),
  Worker: jest.fn()
}));

// Mock Clerk
jest.mock('@clerk/express', () => ({
  ClerkExpressRequireAuth: () => (req: any, res: any, next: any) => {
    req.auth = {
      userId: 'test-user-id',
      sessionId: 'test-session-id'
    };
    next();
  }
}));

// Global test database setup will be added when we have a test database
// For now, we'll focus on unit tests that don't require database

beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.SKIP_WEBHOOK_SIGNATURE_VALIDATION = 'true';
});

beforeEach(async () => {
  // Clear all mocks between tests
  jest.clearAllMocks();
});

afterAll(async () => {
  // Cleanup after all tests
});
