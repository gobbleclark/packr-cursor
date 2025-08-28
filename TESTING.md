# Packr Testing Guide

## Overview

Comprehensive test infrastructure for the Packr multi-tenant 3PL ↔ Brand SaaS platform with focus on reliability, multitenancy isolation, and Trackstar integration testing.

## Test Architecture

### API Tests (Jest + Supertest)
- **Location**: `apps/api/src/__tests__/`
- **Framework**: Jest with TypeScript support
- **HTTP Testing**: Supertest for route testing
- **Mocking**: Nock for HTTP requests, Jest mocks for dependencies
- **Coverage Target**: 80% line/branch coverage

### Frontend Tests (Vitest + React Testing Library)
- **Location**: `apps/web/src/__tests__/`
- **Framework**: Vitest with jsdom environment
- **Component Testing**: React Testing Library
- **API Mocking**: MSW (Mock Service Worker)
- **Coverage Target**: 70% line/branch coverage

### Database Tests
- **ORM**: Prisma with PostgreSQL
- **Strategy**: Test database with factory patterns
- **Isolation**: Transaction rollback between tests

## Test Categories

### 1. Unit Tests
**Purpose**: Test individual functions and classes in isolation

**Examples**:
- `logger.test.ts` - Utility function testing
- `service.unit.test.ts` - Business logic with mocked dependencies
- `Button.test.tsx` - UI component behavior

**Command**: `npm test -- --testPathPattern=unit`

### 2. Integration Tests
**Purpose**: Test component interactions and API endpoints

**Examples**:
- `client.test.ts` - Trackstar API client with HTTP mocking
- `orders.test.ts` - Orders API with database operations
- `inventory.integration.test.tsx` - Full page component with API calls

**Command**: `npm test -- --testPathPattern=integration`

### 3. Contract Tests
**Purpose**: Verify external API contracts (Trackstar)

**Examples**:
- Request/response schema validation
- Error handling scenarios
- Rate limiting behavior

### 4. End-to-End Tests (Future)
**Purpose**: Full user workflow testing

**Framework**: Playwright or Cypress
**Scope**: Critical user journeys

## Key Test Files

### API Tests

#### Core Infrastructure
```
src/__tests__/
├── setup.ts                    # Global test configuration
├── globalSetup.ts              # Test environment setup
├── globalTeardown.ts           # Cleanup
├── factories/
│   └── index.ts               # Test data factories
└── types.d.ts                 # Test type definitions
```

#### Business Logic Tests
```
src/__tests__/
├── integrations/trackstar/
│   ├── client.test.ts         # HTTP client + rate limiting
│   ├── service.unit.test.ts   # Business logic (mocked)
│   └── service.test.ts        # Integration (with DB)
├── routes/
│   ├── orders.test.ts         # Orders API endpoints
│   ├── webhooks/
│   │   └── inventory.test.ts  # Webhook idempotency
└── middleware/
    └── auth.test.ts           # Authentication & RBAC
```

### Frontend Tests

#### Component Tests
```
src/__tests__/
├── setup.ts                   # Global test configuration
├── mocks/
│   └── server.ts             # MSW API mocking
├── components/
│   ├── ui/
│   │   └── Button.test.tsx   # Basic UI components
│   ├── layout/
│   │   └── AuthenticatedLayout.test.tsx
│   └── orders/
│       └── OrdersList.test.tsx
├── hooks/
│   └── useChat.test.ts       # Custom React hooks
└── pages/
    └── inventory.integration.test.tsx
```

## Test Patterns

### 1. Factory Pattern (API)
```typescript
// Test data creation
const threepl = await TestDataFactory.createThreePL();
const brand = await TestDataFactory.createBrand(threepl.id);
const order = await TestDataFactory.createOrder(threepl.id, brand.id);
```

### 2. HTTP Mocking (API)
```typescript
// Mock Trackstar API calls
nock('https://production.trackstarhq.com')
  .get('/wms/orders')
  .query({ limit: 1000 })
  .reply(200, { data: mockOrders });
```

### 3. Component Testing (Frontend)
```typescript
// Test user interactions
const user = userEvent.setup();
render(<OrdersList />);
await user.click(screen.getByRole('button', { name: /filter/i }));
expect(screen.getByText('Filtered Results')).toBeInTheDocument();
```

### 4. API Mocking (Frontend)
```typescript
// MSW request handlers
http.get('/api/orders', () => {
  return HttpResponse.json({ orders: mockOrders });
});
```

## Multitenancy Testing

### Isolation Verification
```typescript
// Ensure data isolation between tenants
it('should not access other tenant data', async () => {
  const tenant1Order = await createOrder(tenant1.id);
  const tenant2User = await createUser(tenant2.id);
  
  const response = await request(app)
    .get(`/api/orders/${tenant1Order.id}`)
    .set('Authorization', tenant2User.token)
    .expect(403);
});
```

### Role-Based Access Control
```typescript
// Test different user roles
const testCases = [
  { role: 'BRAND_USER', endpoint: '/api/orders', expected: 200 },
  { role: 'BRAND_USER', endpoint: '/api/admin', expected: 403 },
  { role: 'SUPER_ADMIN', endpoint: '/api/admin', expected: 200 }
];
```

## Trackstar Integration Testing

### 1. Client Testing
- HTTP request/response validation
- Rate limiting (10 req/sec)
- Error handling (429, 500, network errors)
- Pagination handling
- Idempotency key usage

### 2. Webhook Testing
- Signature validation (when implemented)
- Idempotency by event_id
- Data transformation and storage
- Error scenarios and retries

### 3. Service Testing
- Sync job processing
- Queue management
- Data mapping (Trackstar ↔ internal models)
- Webhook event processing

## Running Tests

### Development
```bash
# API tests
cd apps/api
npm test                          # All tests with coverage
npm test -- --watch             # Watch mode
npm test -- --testPathPattern=orders  # Specific tests

# Frontend tests
cd apps/web
npm test                         # Interactive mode
npm test -- --run              # Single run
npm test -- --coverage         # With coverage
```

### CI/CD
```bash
# Full test suite (from root)
npm test                        # All packages
npm run test:ci                 # CI mode with coverage
```

### Individual Test Types
```bash
# Unit tests only
npm test -- --testPathPattern="unit|\.test\."

# Integration tests
npm test -- --testPathPattern="integration"

# Specific components
npm test -- --testPathPattern="Button|OrdersList"
```

## Coverage Requirements

### API (80% minimum)
- **Lines**: 80%
- **Branches**: 80%
- **Functions**: 80%
- **Statements**: 80%

### Frontend (70% minimum)
- **Lines**: 70%
- **Branches**: 70%
- **Functions**: 70%
- **Statements**: 70%

### Exclusions
- Configuration files
- Type definitions
- Test files themselves
- Generated code (Prisma client)

## Mocking Strategy

### External Services
- **Trackstar API**: Nock for HTTP mocking
- **Redis**: In-memory mock
- **S3**: Mock AWS SDK calls
- **Email Service**: Mock SMTP
- **WebSockets**: Mock Socket.IO

### Database
- **Development**: Separate test database
- **CI**: PostgreSQL service container
- **Isolation**: Transaction rollback or table truncation

### Authentication
- **Clerk**: Mock auth middleware
- **JWT**: Mock token validation
- **Sessions**: Mock session storage

## Best Practices

### 1. Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### 2. Data Management
- Use factories for test data creation
- Clean up after each test
- Avoid test interdependencies

### 3. Mocking
- Mock at the boundary (HTTP, database)
- Verify mock interactions
- Use realistic test data

### 4. Async Testing
- Always await async operations
- Use waitFor for UI updates
- Handle promise rejections

### 5. Error Testing
- Test both success and failure paths
- Verify error messages and status codes
- Test edge cases and boundary conditions

## Debugging Tests

### Common Issues
1. **Async timing**: Use `waitFor` and proper awaits
2. **Mock cleanup**: Clear mocks between tests
3. **Database state**: Ensure proper cleanup
4. **Network mocking**: Verify nock interceptors

### Debug Commands
```bash
# Run with debug output
npm test -- --verbose

# Run single test file
npm test -- --testPathPattern="specific.test.ts"

# Debug mode (Node.js inspector)
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Future Enhancements

### 1. Test Database Setup
- Automated test database provisioning
- Migration testing
- Performance testing with realistic data volumes

### 2. Contract Testing
- Pact.js for API contracts
- Schema validation testing
- Backward compatibility testing

### 3. Performance Testing
- Load testing for API endpoints
- Frontend performance metrics
- Database query optimization testing

### 4. Visual Testing
- Screenshot testing for UI components
- Cross-browser compatibility
- Responsive design testing

### 5. E2E Testing
- Critical user journey automation
- Multi-tenant workflow testing
- Integration with staging environment

## Continuous Integration

### GitHub Actions Workflow
- **Triggers**: PR, push to main/develop
- **Services**: PostgreSQL, Redis
- **Steps**: Install → Test → Coverage → Security Audit
- **Artifacts**: Coverage reports, test results

### Quality Gates
- All tests must pass
- Coverage thresholds must be met
- No high-severity security vulnerabilities
- Linting and type checking must pass

---

## Quick Start

1. **Install dependencies**: `npm install`
2. **Run API tests**: `cd apps/api && npm test`
3. **Run frontend tests**: `cd apps/web && npm test`
4. **View coverage**: Open `coverage/lcov-report/index.html`

For questions or issues, refer to the test files for examples or consult the team's testing guidelines.
