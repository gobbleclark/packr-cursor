# Packr Agent Commands Reference

Quick reference for commonly used commands by AI agents working on the Packr codebase.

## Pre-Work Setup Commands

### Branch Management
```bash
# Create and switch to agent-specific branch
git checkout -b automation/background-maintenance
git checkout -b feature/orders-pagination  
git checkout -b bugfix/webhook-processing

# Check current branch and status
git branch --show-current
git status --porcelain

# Update branch with latest changes
git fetch origin
git rebase origin/develop
```

### Dependency Management
```bash
# Install dependencies for specific workspace
npm ci --workspace=apps/api
npm ci --workspace=apps/web
npm ci --workspace=packages/database

# Check for outdated dependencies
npm outdated --workspace=apps/api

# Security audit
npm audit --audit-level=high --workspace=apps/api
```

## Testing Commands (Require Approval)

### API Testing
```bash
# Full API test suite
cd apps/api && npm test

# Unit tests only
cd apps/api && npm test -- --testPathPattern="\.test\." --testPathIgnorePatterns="integration"

# Integration tests only  
cd apps/api && npm test -- --testPathPattern="integration"

# Specific test patterns
cd apps/api && npm test -- --testPathPattern="orders"
cd apps/api && npm test -- --testPathPattern="trackstar"
cd apps/api && npm test -- --testPathPattern="multitenancy|tenant"

# Coverage reporting
cd apps/api && npm test -- --coverage --coverageReporters=text-summary
```

### Frontend Testing
```bash
# Full frontend test suite
cd apps/web && npm test -- --run

# Unit tests with coverage
cd apps/web && npm test -- --run --coverage --testPathIgnorePatterns="integration"

# Integration tests
cd apps/web && npm test -- --run --testPathPattern="integration"

# Component-specific tests
cd apps/web && npm test -- --run --testPathPattern="Button|OrdersList"
```

### Database Testing
```bash
# Setup test database
cd packages/database && npx prisma db push --force-reset

# Run database migrations
cd packages/database && npx prisma migrate dev

# Seed test data
cd packages/database && npm run seed:test
```

## Code Quality Commands

### TypeScript & Linting
```bash
# Type checking
npm run type-check --workspace=apps/api
npm run type-check --workspace=apps/web

# Linting with auto-fix
npm run lint --workspace=apps/api -- --fix
npm run lint --workspace=apps/web -- --fix

# Format code
npm run format --workspace=apps/api
npm run format --workspace=apps/web
```

### Build & Compilation
```bash
# Build API
cd apps/api && npm run build

# Build frontend
cd apps/web && npm run build

# Check bundle size
cd apps/web && npm run analyze
```

## Analysis Commands

### Code Analysis
```bash
# Find dead code
npx ts-unused-exports tsconfig.json --excludePathsFromReport=dist

# Circular dependency detection
npx madge --circular apps/api/src --extensions ts
npx madge --circular apps/web/src --extensions ts,tsx

# Import order analysis
npx eslint apps/api/src --rule 'import/order: error'
```

### Performance Analysis
```bash
# Bundle analysis
cd apps/web && npx webpack-bundle-analyzer .next/static/chunks/*.js

# Database query analysis (requires setup)
cd packages/database && npx prisma studio

# Memory usage check
node --inspect apps/api/dist/index.js
```

## Database Commands

### Schema Management
```bash
# Generate Prisma client
cd packages/database && npx prisma generate

# View database
cd packages/database && npx prisma studio

# Create migration
cd packages/database && npx prisma migrate dev --name "add_indexes"

# Reset database (DANGEROUS)
cd packages/database && npx prisma migrate reset --force
```

### Data Operations
```bash
# Seed development data
cd packages/database && npm run seed:dev

# Backup database
pg_dump packr_dev > backup.sql

# Check database indexes
psql packr_dev -c "\d+ orders"
```

## Monitoring & Debugging Commands

### Log Analysis
```bash
# Follow application logs
tail -f apps/api/logs/app.log

# Search error logs
grep -i "error" apps/api/logs/app.log | tail -20

# Structured log query (if using JSON logging)
jq '.level == "error"' apps/api/logs/app.log
```

### Process Monitoring  
```bash
# Check running processes
ps aux | grep node

# Monitor system resources
htop
iostat 1

# Network connections
netstat -tlnp | grep :3000
```

## Git Commands for Agents

### Commit Management
```bash
# Stage specific files
git add apps/api/src/routes/orders.ts
git add apps/api/src/__tests__/routes/orders.test.ts

# Commit with conventional format
git commit -m "feat(orders): add pagination support

- Add offset/limit query parameters
- Implement keyset pagination for performance  
- Add comprehensive test coverage
- Update API documentation

Tested: npm test -- --testPathPattern=orders
Coverage: 85% lines, 80% branches"

# Amend last commit
git commit --amend --no-edit
```

### Branch Synchronization
```bash
# Check for conflicts before merge
git merge-tree $(git merge-base HEAD origin/develop) HEAD origin/develop

# Interactive rebase for cleanup
git rebase -i origin/develop

# Force push after rebase (use with caution)
git push --force-with-lease origin automation/background-maintenance
```

## Coordinated Testing Workflows

### Full Test Suite (Sequential)
```bash
#!/bin/bash
# Run complete test suite with proper coordination

echo "🧪 Starting Packr Test Suite"

# 1. Setup phase
echo "📋 Setting up test environment..."
cd packages/database && npx prisma db push --force-reset
cd ../.. && npm ci

# 2. API Tests
echo "🔧 Running API tests..."
cd apps/api && npm test -- --coverage

# 3. Frontend Tests  
echo "🎨 Running frontend tests..."
cd ../web && npm test -- --run --coverage

# 4. Integration Tests
echo "🔗 Running integration tests..."
cd ../api && npm test -- --testPathPattern="integration"

# 5. Contract Tests
echo "📋 Running contract tests..."
npm test -- --testPathPattern="trackstar.*test"

echo "✅ All tests completed"
```

### Selective Test Execution
```bash
#!/bin/bash
# Run tests based on changed files

CHANGED_FILES=$(git diff --name-only origin/develop...HEAD)

if echo "$CHANGED_FILES" | grep -q "apps/api"; then
  echo "🔧 Running API tests for changed files..."
  cd apps/api && npm test -- --coverage --passWithNoTests
fi

if echo "$CHANGED_FILES" | grep -q "apps/web"; then
  echo "🎨 Running web tests for changed files..."
  cd apps/web && npm test -- --run --coverage --passWithNoTests
fi

if echo "$CHANGED_FILES" | grep -q "integrations/trackstar"; then
  echo "📋 Running Trackstar integration tests..."
  cd apps/api && npm test -- --testPathPattern="trackstar"
fi
```

## Performance Monitoring Commands

### Database Performance
```bash
# Query performance analysis
psql packr_dev -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Index usage statistics
psql packr_dev -c "SELECT schemaname,tablename,attname,n_distinct,correlation FROM pg_stats WHERE schemaname = 'public';"

# Connection monitoring
psql packr_dev -c "SELECT count(*) as connections, state FROM pg_stat_activity GROUP BY state;"
```

### Application Metrics
```bash
# Memory usage
ps aux | grep "node.*api" | awk '{print $6/1024 " MB"}'

# Request rate monitoring (if PM2)
pm2 monit

# Log-based metrics
tail -f apps/api/logs/app.log | grep -E "(ERROR|WARN)" --line-buffered
```

## Emergency Commands

### Quick Rollback
```bash
# Revert last commit
git revert HEAD --no-edit

# Reset to known good state
git reset --hard origin/develop

# Emergency database restore
psql packr_dev < backup.sql
```

### Health Checks
```bash
# API health check
curl -f http://localhost:3000/health || echo "API DOWN"

# Database connectivity
psql packr_dev -c "SELECT 1;" || echo "DB DOWN"

# Redis connectivity  
redis-cli ping || echo "REDIS DOWN"
```

## Agent Coordination Commands

### Work Declaration
```bash
#!/bin/bash
# Declare work intent (pseudo-code for coordination)

AGENT_NAME="background-engineer"
FILES_TO_TOUCH="apps/api/src/routes/orders.ts,apps/api/src/__tests__/routes/orders.test.ts"
ESTIMATED_TIME="30min"

echo "🤖 $AGENT_NAME starting work on: $FILES_TO_TOUCH"
echo "⏰ Estimated completion: $ESTIMATED_TIME"
echo "🌿 Branch: $(git branch --show-current)"
```

### Conflict Detection
```bash
#!/bin/bash
# Check for potential conflicts with other agent work

OTHER_BRANCHES=$(git branch -r | grep -E "(automation|feature)" | grep -v $(git branch --show-current))

for branch in $OTHER_BRANCHES; do
  echo "Checking conflicts with $branch..."
  git merge-tree $(git merge-base HEAD $branch) HEAD $branch > /tmp/merge-check
  if [ -s /tmp/merge-check ]; then
    echo "⚠️  Potential conflicts with $branch"
  fi
done
```

---

## Usage Guidelines

1. **Always propose commands before running**: Never execute tests or builds without approval
2. **Use appropriate workspace**: Target specific packages with `--workspace` flag
3. **Monitor resources**: Keep CPU/memory usage reasonable
4. **Clean up**: Remove temporary files and processes after work
5. **Document changes**: Include meaningful commit messages and PR descriptions
6. **Coordinate with other agents**: Check for conflicts and communicate work

For questions about specific commands or patterns, refer to the main testing documentation in `TESTING.md`.