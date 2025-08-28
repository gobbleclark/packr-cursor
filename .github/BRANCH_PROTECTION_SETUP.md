# GitHub Branch Protection Setup

## Required Configuration (One-Time Setup)

### 1. Enable Branch Protection Rules

Go to: **GitHub Repository → Settings → Branches → Add Rule**

**Branch name pattern**: `main`

**Required settings**:
- ✅ **Require a pull request before merging**
- ✅ **Require status checks to pass before merging**
- ✅ **Require branches to be up to date before merging**

**Required status checks** (must match workflow job names):
- `API Tests`
- `Frontend Tests` 
- `Database Tests`
- `Lint & Type Check`
- `Security Audit`
- `Build Check`

**Additional protections**:
- ✅ **Restrict pushes that create files larger than 100MB**
- ✅ **Require conversation resolution before merging**
- ✅ **Include administrators** (even admins must follow rules)

### 2. What This Means

**✅ Agents CAN do:**
- Push to any branch: `git push origin feature-branch`
- Create pull requests
- See test results immediately
- Push fixes after test failures

**❌ Agents CANNOT do:**
- Merge PR with failing tests
- Push directly to `main` branch
- Bypass status checks
- Merge without PR review

### 3. Example Workflow

```bash
# Agent workflow - this all works fine:
git checkout -b fix-orders-bug
git add .
git commit -m "Fix orders processing"
git push origin fix-orders-bug     # ✅ Always succeeds

# Create PR on GitHub
# Tests run automatically
# If tests fail: PR shows "Cannot merge" 
# If tests pass: PR shows "Ready to merge"
```

### 4. What Agent Sees When Tests Fail

**In GitHub PR:**
```
❌ Some checks were not successful
1 failing check

❌ API Tests — Failed
   View details and logs

This branch has restrictions:
• Required status checks must pass
• Cannot merge until all checks pass
```

**Clicking "View details" shows:**
```
FAIL src/__tests__/orders/service.test.ts
● OrderService › should process order correctly
  Expected: 200
  Received: 500
  
  Error: Cannot read property 'brandId' of undefined
    at OrderService.processOrder (src/services/orders.ts:45:12)
```

### 5. The Merge Button

**When tests fail:**
```
[Merge pull request ▼] ← Button is DISABLED/GRAYED OUT
❌ Required status checks must pass
```

**When tests pass:**
```
[Merge pull request ▼] ← Button is ENABLED/GREEN
✅ All checks have passed
```

## Pre-commit Hooks (Optional Extra Protection)

For even faster feedback, you can add pre-commit hooks:

```bash
# Install husky for git hooks
npm install --save-dev husky

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run test:quick"
```

This would run quick tests BEFORE allowing commits (not just pushes).

## Summary

**The protection is at the MERGE level, not the PUSH level:**

1. **Push**: Always allowed ✅
2. **Tests**: Run automatically after push 🤖  
3. **Merge**: Only allowed if tests pass ✅
4. **Feedback**: Immediate and detailed 📊

This gives agents freedom to experiment while ensuring quality code reaches production.
