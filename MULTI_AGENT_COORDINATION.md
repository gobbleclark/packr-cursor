# Multi-Agent Coordination Guide for Packr

This document outlines safe patterns for running multiple AI agents simultaneously on the Packr codebase without conflicts or interference.

## Safe Multi-Agent Operation Patterns

### 1. Branch Isolation Strategy

#### Dedicated Branches per Agent
```bash
# Background maintenance agent
automation/background-maintenance

# Feature-specific agents
feature/orders-enhancements
feature/chat-improvements  
feature/inventory-sync
feature/trackstar-integration

# Bugfix agents
bugfix/payment-reconciliation
bugfix/webhook-processing
```

#### Git Worktree Setup (Recommended)
```bash
# Create separate working directories for each agent
git worktree add ../packr-background automation/background-maintenance
git worktree add ../packr-orders feature/orders-enhancements
git worktree add ../packr-chat feature/chat-improvements

# Open each in separate Cursor windows
code ../packr-background
code ../packr-orders  
code ../packr-chat
```

### 2. Terminal Management

#### Dedicated Terminal Tabs
- Each agent gets ONE named terminal tab
- **Background Agent**: `background-agent`
- **Orders Agent**: `orders-agent`  
- **Chat Agent**: `chat-agent`

#### Command Approval Protocol
```typescript
// Every agent must follow this pattern:
// 1. Propose command
"I need to run: npm test -- --testPathPattern=orders"
// 2. Wait for approval  
// 3. Execute only after confirmation
```

### 3. Resource Management

#### Memory & CPU Limits
- **No parallel test suites**: Only one agent runs tests at a time
- **No long-running watchers**: Avoid `--watch` mode across agents
- **Sequential builds**: Coordinate TypeScript compilation/builds

#### File Lock Coordination
```bash
# Check for lock files before starting work
ls -la *.lock package-lock.json tsconfig.tsbuildinfo

# Agent-specific package management
# Background agent: API dependencies only
# Frontend agent: Web dependencies only
```

## CI Integration & Quality Gates

### 1. Branch Protection Rules

#### Required Status Checks
```yaml
# .github/branch-protection.yml
protection_rules:
  develop:
    required_status_checks:
      - "API Tests (Node 18)"
      - "Frontend Tests (Node 18)"  
      - "Integration Tests"
      - "TypeScript Check"
      - "Linting"
      - "Security Audit"
    required_reviews: 1
    dismiss_stale_reviews: true
```

#### Test Coverage Gates
```javascript
// jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80, 
      lines: 80,
      statements: 80
    },
    // Per-package thresholds
    'apps/api/src/**/*.ts': {
      branches: 80,
      functions: 80,
      lines: 80, 
      statements: 80
    },
    'apps/web/src/**/*.{ts,tsx}': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

### 2. PR Template with Test Checkboxes

```markdown
<!-- .github/pull_request_template.md -->
## Testing Checklist

### API Tests
- [ ] Unit tests added/updated for new functionality
- [ ] Integration tests cover API endpoints 
- [ ] Multitenancy isolation verified
- [ ] Trackstar integration tests pass
- [ ] Coverage threshold maintained (≥80%)

### Frontend Tests  
- [ ] Component tests added/updated
- [ ] User interaction flows tested
- [ ] API mocking implemented with MSW
- [ ] Accessibility tests included
- [ ] Coverage threshold maintained (≥70%)

### Specialized Tests
- [ ] Webhook idempotency verified
- [ ] Rate limiting behavior tested  
- [ ] Error scenarios covered
- [ ] Performance regression tested

### Security & Compliance
- [ ] RBAC scenarios tested
- [ ] Tenant isolation verified
- [ ] No sensitive data in tests
- [ ] Audit logging validated

## Deployment Checklist
- [ ] Feature flags configured (if applicable)
- [ ] Metrics/observability added
- [ ] Rollback plan documented
- [ ] Database migrations reviewed
```

### 3. CODEOWNERS for Test Governance

```bash
# .github/CODEOWNERS

# Test directories require QA approval
**/__tests__/**           @packr-qa @packr-leads
**/src/__tests__/**       @packr-qa @packr-leads  
**/*.test.ts              @packr-qa @packr-leads
**/*.test.tsx             @packr-qa @packr-leads
**/*.spec.ts              @packr-qa @packr-leads

# Critical infrastructure
jest.config.js            @packr-leads
vitest.config.ts           @packr-leads
tsconfig.json             @packr-leads
package.json              @packr-leads

# Security-sensitive areas
**/middleware/auth.ts      @packr-security @packr-leads
**/lib/auth.ts             @packr-security @packr-leads
**/.env*                   @packr-security @packr-leads
**/docker-compose.yml      @packr-infrastructure @packr-leads
```

## Agent Communication & Coordination

### 1. Work Assignment Matrix

| Agent Type | Primary Focus | Branch Pattern | Files/Directories |
|------------|---------------|----------------|-------------------|
| Background | Maintenance, Performance | `automation/*` | All (small changes) |
| Orders | Order Management | `feature/orders-*` | `/routes/orders*`, `/components/orders*` |
| Chat | Messaging System | `feature/chat-*` | `/routes/chat*`, `/components/chat*` |
| Inventory | Stock Management | `feature/inventory-*` | `/routes/inventory*`, `/webhooks/inventory*` |
| Integration | External APIs | `feature/integration-*` | `/integrations/*`, `/webhooks/*` |

### 2. Conflict Prevention

#### File-Level Coordination
```typescript
// Shared coordination log
interface AgentActivity {
  agent: string;
  branch: string;
  files: string[];
  startTime: Date;
  estimatedCompletion: Date;
}

// Before starting work, agents should declare intent:
{
  agent: "background-engineer",
  branch: "automation/background-maintenance", 
  files: ["apps/api/src/routes/orders.ts", "apps/api/src/__tests__/routes/orders.test.ts"],
  startTime: new Date(),
  estimatedCompletion: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
}
```

#### Communication Protocols
- **Slack/Discord integration**: Post agent activity to shared channel
- **Branch naming convention**: Clear ownership and purpose
- **Commit message format**: Include agent identifier

### 3. Merge Coordination

#### Sequential Integration
```bash
# Priority order for merging to develop:
# 1. Bugfixes (highest priority)
# 2. Background maintenance  
# 3. Feature work
# 4. Experimental/research

# Always rebase before merge
git checkout develop
git pull origin develop
git checkout feature/my-branch
git rebase develop
```

#### Integration Testing
```bash
# Before merge to develop, run full test suite
npm run test:all
npm run build:all
npm run lint:all
npm run type-check:all
```

## Monitoring & Observability for Multi-Agent Work

### 1. Agent Activity Dashboard

```typescript
// Track agent contributions
interface AgentMetrics {
  agent: string;
  commitsToday: number;
  linesChanged: number;
  testsAdded: number;
  coverageImpact: number;
  mergeConflicts: number;
  buildFailures: number;
}
```

### 2. Quality Metrics per Agent

```yaml
# .github/workflows/agent-metrics.yml
agent_quality_report:
  metrics:
    - test_coverage_delta
    - build_success_rate  
    - merge_conflict_frequency
    - code_review_feedback_score
    - time_to_merge
```

### 3. Coordination Alerts

```bash
# Alert scenarios
- Multiple agents editing same file
- Test coverage dropping below threshold
- Build failures on agent branches
- Merge conflicts increasing
- Agent working beyond estimated time
```

## Best Practices for Multi-Agent Teams

### 1. Communication
- **Daily sync**: Brief async update on agent progress
- **Conflict escalation**: Human intervention for blocking issues
- **Knowledge sharing**: Cross-pollinate learnings between agents

### 2. Quality Assurance  
- **Cross-agent code review**: Agents review each other's work
- **Test suite integrity**: Shared responsibility for test health
- **Documentation updates**: Keep architectural decisions current

### 3. Performance Management
- **Resource monitoring**: Track CPU/memory usage per agent
- **Work distribution**: Balance load across available agents  
- **Efficiency metrics**: Measure agent productivity and quality

---

This coordination framework ensures multiple agents can work effectively without conflicts while maintaining high code quality and system reliability.