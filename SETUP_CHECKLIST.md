# Packr Test Infrastructure Setup Checklist

## ✅ **Step-by-Step Setup Guide**

### **Phase 1: Repository Configuration (5 minutes)**

#### **1.1 Verify GitHub Repository**
- [ ] Repository exists on GitHub
- [ ] You have admin access to the repository
- [ ] Repository is not archived/read-only

#### **1.2 Check Current Branch Structure**
```bash
# Run these commands to see current setup:
git branch -a
git remote -v
```

Expected output should show:
- `main` branch exists
- `origin` remote points to your GitHub repo

### **Phase 2: GitHub Actions Setup (Already Done ✅)**

#### **2.1 Workflow File** ✅
- [x] `.github/workflows/test.yml` exists
- [x] Configured for both `main` and `develop` branches
- [x] All test jobs defined (API, Frontend, Database, Lint, Security)

#### **2.2 Verify Workflow Syntax**
```bash
# Test the workflow file syntax
cd /Users/gavinclark/Desktop/Packr
cat .github/workflows/test.yml | head -20
```

### **Phase 3: Branch Protection Rules (CRITICAL - Must Do)**

#### **3.1 Create `develop` Branch**
```bash
# Create develop branch if it doesn't exist
git checkout -b develop
git push origin develop
```

#### **3.2 Configure Branch Protection (GitHub Web UI)**

**Go to**: `https://github.com/YOUR_USERNAME/Packr/settings/branches`

**For `develop` branch:**
1. Click "Add rule"
2. Branch name pattern: `develop`
3. Check these boxes:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
4. Required status checks (add these):
   - `API Tests`
   - `Frontend Tests`
   - `Database Tests`
   - `Lint & Type Check`
5. Additional settings:
   - ✅ Require pull request reviews before merging (1 review)
   - ✅ Include administrators
6. Click "Create"

**For `main` branch:**
1. Click "Add rule"
2. Branch name pattern: `main`
3. Check these boxes:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
4. Required status checks (add these):
   - `API Tests`
   - `Frontend Tests`
   - `Database Tests`
   - `Lint & Type Check`
   - `Security Audit`
   - `Build Check`
5. Additional settings:
   - ✅ Require pull request reviews before merging (2 reviews)
   - ✅ Dismiss stale PR reviews when new commits are pushed
   - ✅ Include administrators
6. Click "Create"

### **Phase 4: Test the Setup (10 minutes)**

#### **4.1 Create Test Feature Branch**
```bash
# Test the workflow
git checkout develop
git checkout -b test/setup-verification
echo "# Test setup" > TEST_SETUP.md
git add TEST_SETUP.md
git commit -m "Test: Verify CI/CD setup"
git push origin test/setup-verification
```

#### **4.2 Create Test PR**
1. Go to GitHub repository
2. Create PR: `test/setup-verification` → `develop`
3. Watch for automatic test execution
4. Verify you see status checks running

#### **4.3 Expected Results**
You should see:
```
🟡 Some checks haven't completed yet
⏳ API Tests — In progress
⏳ Frontend Tests — In progress  
⏳ Database Tests — In progress
⏳ Lint & Type Check — In progress
```

Then after 3-5 minutes:
```
✅ All checks have passed
✅ API Tests — Passed
✅ Frontend Tests — Passed
✅ Database Tests — Passed
✅ Lint & Type Check — Passed
```

### **Phase 5: Package.json Scripts (Verify)**

#### **5.1 Check API Scripts**
```bash
cd apps/api
cat package.json | grep -A 10 '"scripts"'
```

Should include:
```json
{
  "scripts": {
    "test": "jest --coverage",
    "test:ci": "jest --coverage --ci --watchAll=false",
    "test:watch": "jest --watch"
  }
}
```

#### **5.2 Check Frontend Scripts**
```bash
cd ../web
cat package.json | grep -A 10 '"scripts"'
```

Should include:
```json
{
  "scripts": {
    "test": "vitest",
    "test:ci": "vitest run --coverage",
    "test:watch": "vitest --watch"
  }
}
```

### **Phase 6: Environment Variables (GitHub Secrets)**

#### **6.1 Add Repository Secrets**
Go to: `https://github.com/YOUR_USERNAME/Packr/settings/secrets/actions`

Add these secrets:
- `DATABASE_URL`: `postgresql://test:test@localhost:5432/packr_test`
- `REDIS_URL`: `redis://localhost:6379/1`
- `TRACKSTAR_API_KEY`: `test-api-key-for-ci`
- `CODECOV_TOKEN`: (optional, for coverage reporting)

### **Phase 7: Local Development Setup**

#### **7.1 Install Dependencies**
```bash
cd /Users/gavinclark/Desktop/Packr
npm install
```

#### **7.2 Test Local Execution**
```bash
# Test API
cd apps/api
npm test -- --testPathPattern="logger.test.ts"

# Test Frontend  
cd ../web
npm test -- --run Button.test.tsx
```

Both should pass ✅

### **Phase 8: Verification & Cleanup**

#### **8.1 Clean Up Test Branch**
```bash
# After PR testing is complete
git checkout develop
git branch -D test/setup-verification
git push origin --delete test/setup-verification
```

#### **8.2 Final Verification**
Create a real feature branch and test the full workflow:
```bash
git checkout develop
git pull origin develop
git checkout -b feature/test-real-workflow
# Make a small change to a test file
echo "// Test comment" >> apps/api/src/__tests__/utils/logger.test.ts
git add .
git commit -m "feat: test real workflow"
git push origin feature/test-real-workflow
```

Create PR and verify all protections work.

## 🚨 **Common Issues & Solutions**

### **Issue 1: Status Checks Not Found**
**Problem**: GitHub says "Required status check 'API Tests' not found"
**Solution**: 
1. Push a commit to trigger the workflow first
2. Then add the status check requirement
3. Status checks must match job names exactly

### **Issue 2: Tests Fail in CI but Pass Locally**
**Problem**: Environment differences
**Solution**: Check environment variables in workflow file match your needs

### **Issue 3: Permission Denied**
**Problem**: GitHub Actions can't access repository
**Solution**: Ensure Actions are enabled in repository settings

### **Issue 4: Branch Protection Too Strict**
**Problem**: Can't merge even with passing tests
**Solution**: Temporarily disable "Include administrators" to test, then re-enable

## 🎉 **Success Indicators**

You'll know it's working when:
- ✅ Cannot merge PR with failing tests
- ✅ Tests run automatically on every push
- ✅ Status checks appear in PR interface
- ✅ Merge button is disabled until tests pass
- ✅ Detailed test results visible in Actions tab

## 📞 **Need Help?**

If you encounter issues:
1. Check GitHub Actions logs for detailed error messages
2. Verify branch protection rules match job names exactly
3. Ensure all required secrets are set
4. Test locally first to isolate CI vs code issues

## 🚀 **Next Steps After Setup**

Once working:
1. Train team/agents on the workflow
2. Add more comprehensive tests
3. Set up deployment automation
4. Configure notifications (Slack/Discord)
5. Add performance testing
