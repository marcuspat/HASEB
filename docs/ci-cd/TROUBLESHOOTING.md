# 🛠️ CI/CD Troubleshooting Guide

This guide provides step-by-step troubleshooting procedures for common CI/CD issues in the HASEB project.

## 📋 Table of Contents

- [🔍 Quick Diagnosis](#quick-diagnosis)
- [🏗️ Build Issues](#build-issues)
- [🧪 Test Failures](#test-failures)
-[🚀 Deployment Problems](#deployment-problems)
- [🔒 Security Issues](#security-issues)
- [📊 Performance Issues](#performance-issues)
- [🗄️ Database Issues](#database-issues)
- [🔧 Configuration Issues](#configuration-issues)
- [📞 Emergency Procedures](#emergency-procedures)

## 🔍 Quick Diagnosis

### Step 1: Identify the Problem Area

```bash
# Check recent workflow runs
gh run list --repo $GITHUB_REPO --limit 10

# Check specific workflow status
gh run view --repo $GITHUB_REPO --workflow main.yml

# Get workflow details
gh run view --repo $GITHUB_REPO --log $RUN_ID
```

### Step 2: Review Error Messages

```bash
# Download and review logs
gh run download --repo $GITHUB_REPO --run $RUN_ID

# Check specific job logs
gh run view --repo $GITHUB_REPO --job $JOB_ID --log

# Search for error patterns
grep -i "error\|fail\|exception" workflow-logs/
```

### Step 3: Check System Status

```bash
# Check GitHub Actions status
curl -s https://www.githubstatus.com/api/v2/status.json

# Check external dependencies
curl -I https://registry.npmjs.org/
curl -I https://ghcr.io/
```

## 🏗️ Build Issues

### Issue: TypeScript Compilation Errors

**Symptoms:**
```
error TS2307: Cannot find module 'module-name'
error TS2322: Type 'string' is not assignable to type 'number'
```

**Solutions:**

1. **Check Dependencies:**
   ```bash
   # Verify package.json dependencies
   cat package.json | grep -A5 -B5 "dependencies"

   # Check installed modules
   npm list --depth=0

   # Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Fix Import Paths:**
   ```bash
   # Check for missing imports
   grep -r "import.*from" src/ | grep -v node_modules

   # Verify module exports
   grep -r "export" src/
   ```

3. **TypeScript Configuration:**
   ```bash
   # Check tsconfig.json
   cat tsconfig.json

   # Verify path mappings
   grep -A10 -B5 "paths" tsconfig.json
   ```

### Issue: ESLint Failures

**Symptoms:**
```
error  'variable' is not defined  no-undef
error  Unexpected console statement  no-console
```

**Solutions:**

1. **Fix ESLint Errors:**
   ```bash
   # Run ESLint with auto-fix
   npm run lint -- --fix

   # Check specific rules
   npm run lint -- --rule no-console

   # Generate detailed report
   npm run lint -- --format=json --output-file=eslint-report.json
   ```

2. **Update ESLint Configuration:**
   ```bash
   # Review .eslintrc.js
   cat .eslintrc.js

   # Check for rule conflicts
   npx eslint --print-config src/
   ```

### Issue: npm Install Failures

**Symptoms:**
```
npm ERR! code ERESOLVE
npm ERR! peer dep missing
```

**Solutions:**

1. **Clear npm Cache:**
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Resolve Peer Dependencies:**
   ```bash
   # Check peer dependency conflicts
   npm ls --depth=0

   # Install missing peer dependencies
   npm install missing-package --save-peer
   ```

3. **Use Legacy Peer Dependencies:**
   ```bash
   npm install --legacy-peer-deps
   ```

## 🧪 Test Failures

### Issue: Unit Test Failures

**Symptoms:**
```
FAIL: test description
Error: Expected value to be truthy
```

**Solutions:**

1. **Run Tests Locally:**
   ```bash
   # Run failed test locally
   npm test -- --testNamePattern="test name"

   # Run with verbose output
   npm test -- --verbose

   # Run with coverage
   npm run test:coverage
   ```

2. **Debug Test Issues:**
   ```bash
   # Run tests in debug mode
   node --inspect-brk node_modules/.bin/jest --runInBand

   # Check test files
   find tests/ -name "*.test.*" | head -10
   ```

3. **Update Test Expectations:**
   ```bash
   # Review test file
   cat tests/unit/example.test.ts

   # Check mock implementations
   grep -r "jest.mock" tests/
   ```

### Issue: Integration Test Failures

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
Timeout: Async callback was not invoked
```

**Solutions:**

1. **Check Test Environment:**
   ```bash
   # Verify database is running
   docker ps | grep postgres

   # Check database connection
   npm run test:db:connect

   # Reset test database
   npm run test:db:reset
   ```

2. **Fix Test Configuration:**
   ```bash
   # Check test environment variables
   env | grep TEST

   # Review test setup
   cat tests/setup.ts

   # Check test timeouts
   grep -r "timeout" tests/
   ```

### Issue: E2E Test Failures

**Symptoms:**
```
Test timeout of 30000ms exceeded
Selector not found: .element-class
```

**Solutions:**

1. **Debug Playwright Tests:**
   ```bash
   # Run tests in headed mode
   npx playwright test --headed

   # Run with debug mode
   npx playwright test --debug

   # Generate trace files
   npx playwright test --trace on
   ```

2. **Fix Selectors and Waits:**
   ```bash
   # Check page structure
   npx playwright codegen http://localhost:3000

   # Review test selectors
   grep -r "page.locator\|page.$" tests/e2e/

   # Add proper waits
   grep -r "waitFor\|waitForSelector" tests/e2e/
   ```

## 🚀 Deployment Problems

### Issue: Docker Build Failures

**Symptoms:**
```
ERROR: failed to solve: process "/bin/sh -c npm install" didn't complete
no space left on device
```

**Solutions:**

1. **Fix Dockerfile Issues:**
   ```bash
   # Check Dockerfile syntax
   docker --version
   docker build --dry-run .

   # Optimize Docker build
   docker build --no-cache --progress=plain .
   ```

2. **Resolve Resource Issues:**
   ```bash
   # Check disk space
   df -h

   # Clean Docker resources
   docker system prune -af

   # Check memory usage
   free -h
   ```

### Issue: Container Runtime Failures

**Symptoms:**
```
Container exited with code 1
Health check failed
```

**Solutions:**

1. **Debug Container Issues:**
   ```bash
   # Check container logs
   docker logs container-name

   # Run container interactively
   docker run -it --entrypoint /bin/bash image-name

   # Check container status
   docker ps -a
   ```

2. **Fix Health Checks:**
   ```bash
   # Test health endpoint
   curl -f http://localhost:3000/health

   # Check health check configuration
   grep -A10 -B5 "healthcheck" Dockerfile
   ```

### Issue: Environment-Specific Failures

**Symptoms:**
```
Connection refused to database
Missing environment variables
Permission denied
```

**Solutions:**

1. **Check Environment Configuration:**
   ```bash
   # Verify environment variables
   printenv | grep DATABASE

   # Check configuration files
   cat .env.production

   # Test connectivity
   telnet database-host 5432
   ```

2. **Fix Permission Issues:**
   ```bash
   # Check file permissions
   ls -la /path/to/files

   # Fix ownership
   sudo chown -R user:group /path/to/files

   # Check Docker permissions
   sudo usermod -aG docker $USER
   ```

## 🔒 Security Issues

### Issue: Vulnerability Scan Failures

**Symptoms:**
```
Critical vulnerability found in package-name
High severity security issue detected
```

**Solutions:**

1. **Fix npm Audit Issues:**
   ```bash
   # Run detailed audit
   npm audit --audit-level=moderate

   # Fix vulnerabilities
   npm audit fix

   # Update specific packages
   npm update package-name
   ```

2. **Address Code Security Issues:**
   ```bash
   # Review CodeQL results
   cat security-results/codeql-results.sarif

   # Fix security findings
   grep -r "password\|secret\|key" src/

   # Update security policies
   cat .github/codeql/codeql-config.yml
   ```

### Issue: Container Security Issues

**Symptoms:**
```
CVE-2023-XXXX in base image
Root user detected in container
```

**Solutions:**

1. **Update Base Images:**
   ```bash
   # Check for base image updates
   docker pull node:20-alpine

   # Update Dockerfile base image
   sed -i 's/FROM node:.*/FROM node:20-alpine/' Dockerfile
   ```

2. **Fix Container Security:**
   ```bash
   # Run Trivy scan locally
   trivy image image-name

   # Review Docker security best practices
   hadolint Dockerfile
   ```

## 📊 Performance Issues

### Issue: Slow Build Times

**Symptoms:**
```
Build taking > 10 minutes
npm install very slow
```

**Solutions:**

1. **Optimize Dependencies:**
   ```bash
   # Use npm ci for faster installs
   npm ci

   # Check dependency sizes
   npx npm-size

   # Remove unused dependencies
   npx depcheck
   ```

2. **Improve Caching:**
   ```bash
   # Enable Docker layer caching
   docker build --cache-from type=gha

   # Use GitHub Actions cache
   grep -A5 -B5 "cache" .github/workflows/*.yml
   ```

### Issue: Performance Test Failures

**Symptoms:**
```
Lighthouse score below threshold
Response time too slow
```

**Solutions:**

1. **Improve Performance:**
   ```bash
   # Run Lighthouse locally
   npx lighthouse http://localhost:3000

   # Check bundle size
   npx webpack-bundle-analyzer dist/

   # Profile performance
   npm run build -- --profile
   ```

## 🗄️ Database Issues

### Issue: Migration Failures

**Symptoms:**
```
Migration failed: relation already exists
Connection timeout to database
```

**Solutions:**

1. **Fix Migration Conflicts:**
   ```bash
   # Check migration status
   npm run migrate:status

   # Rollback failed migration
   npm run migrate:rollback

   # Run specific migration
   npm run migrate:up migration-name
   ```

2. **Resolve Connection Issues:**
   ```bash
   # Test database connection
   npm run db:test-connection

   # Check database logs
   docker logs postgres-container

   # Verify database configuration
   cat config/database.ts
   ```

## 🔧 Configuration Issues

### Issue: Environment Variable Problems

**Symptoms:**
```
undefined is not a function
Cannot read property of undefined
```

**Solutions:**

1. **Check Environment Variables:**
   ```bash
   # List environment variables
   printenv | grep -E "(NODE|DATABASE|API)"

   # Test variable loading
   node -e "console.log(require('dotenv').config())"

   # Verify .env file format
   cat .env | grep -v "^#"
   ```

2. **Fix Configuration Loading:**
   ```bash
   # Check configuration files
   find . -name "*.config.*" | head -10

   # Test configuration module
   node -e "console.log(require('./config/app'))"
   ```

## 📞 Emergency Procedures

### 1. Production Outage

**Immediate Actions:**
```bash
# Check current deployment status
gh run list --repo $GITHUB_REPO --workflow deploy.yml --limit 5

# Check application health
curl -f https://haseb.example.com/health

# Check monitoring dashboard
curl -f https://monitoring.haseb.example.com/health

# Alert team
echo "🚨 PRODUCTION OUTAGE DETECTED" | \
  curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"🚨 PRODUCTION OUTAGE DETECTED"}' \
  $SLACK_WEBHOOK_URL
```

**Rollback Procedure:**
```bash
# Identify last good deployment
gh run list --repo $GITHUB_REPO --workflow deploy.yml --status=success

# Trigger rollback
gh workflow run rollback.yml \
  --field environment=production \
  --field reason="emergency_rollback"

# Verify rollback
sleep 60
curl -f https://haseb.example.com/health
```

### 2. Security Incident

**Immediate Actions:**
```bash
# Stop affected services
docker-compose down

# Isolate from network
iptables -A INPUT -s 0.0.0.0/0 -j DROP
iptables -A INPUT -s trusted-ip/32 -j ACCEPT

# Preserve evidence
docker logs container-name > incident-logs-$(date +%s).log

# Alert security team
echo "🔒 SECURITY INCIDENT DETECTED" | \
  curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"🔒 SECURITY INCIDENT DETECTED"}' \
  $SECURITY_SLACK_WEBHOOK_URL
```

### 3. Data Corruption

**Recovery Procedure:**
```bash
# Stop application
docker-compose down

# Restore from backup
pg_restore --clean --if-exists -d haseb latest-backup.sql

# Verify data integrity
npm run db:verify

# Restart application
docker-compose up -d

# Run health checks
npm run health:check
```

## 📞 Getting Help

### Internal Resources
- **Slack Channels**: #devops, #alerts, #emergency
- **Documentation**: `/docs/ci-cd/`
- **Runbooks**: `/docs/runbooks/`
- **Team Contacts**: Check internal directory

### External Resources
- **GitHub Actions Documentation**: https://docs.github.com/en/actions
- **Docker Documentation**: https://docs.docker.com/
- **Node.js Documentation**: https://nodejs.org/docs/
- **NPM Documentation**: https://docs.npmjs.com/

### Contact Information
- **On-call DevOps**: [Contact Information]
- **Security Team**: security@haseb.example.com
- **Infrastructure Team**: infra@haseb.example.com

---

*Remember: Document all incidents and solutions for future reference!*