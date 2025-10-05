# 🚀 CI/CD Quick Start Guide

This guide helps you get started with HASEB's CI/CD pipelines quickly.

## 📋 Prerequisites

- GitHub account with appropriate permissions
- Node.js 20+ installed locally
- Docker installed (for local testing)
- Access to required secrets and configurations

## 🏃‍♂️ Quick Start Steps

### 1. Fork and Clone Repository

```bash
# Fork the repository on GitHub
git clone https://github.com/YOUR_USERNAME/haseb.git
cd haseb

# Add upstream remote
git remote add upstream https://github.com/original/haseb.git
```

### 2. Set Up Development Environment

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests locally
npm run test:all

# Build application
npm run build
```

### 3. Configure GitHub Secrets

Navigate to your repository settings and add these secrets:

```yaml
# Required for basic functionality
GITHUB_TOKEN: (automatically provided)

# For deployment (if needed)
DEPLOY_SSH_KEY: Your SSH private key
DOCKER_USERNAME: Your Docker Hub username
DOCKER_PASSWORD: Your Docker Hub password

# For notifications
SLACK_WEBHOOK_URL: Your Slack webhook URL

# For security scanning
SNYK_TOKEN: Your Snyk API token
```

### 4. Create Your First Branch

```bash
# Create feature branch
git checkout -b feature/my-awesome-feature

# Make your changes
# ... edit files ...

# Commit with conventional commit format
git add .
git commit -m "feat: add awesome feature"

# Push to GitHub
git push origin feature/my-awesome-feature
```

### 5. Create Pull Request

1. Go to your fork on GitHub
2. Click "New Pull Request"
3. Select your feature branch
4. Fill in PR description
5. Click "Create Pull Request"

### 6. Monitor CI/CD Pipeline

The CI/CD pipeline will automatically start:

- **Code Quality**: ESLint, Prettier, TypeScript checks
- **Testing**: Unit, integration, and E2E tests
- **Security**: Vulnerability scanning
- **Build**: Application compilation
- **Artifacts**: Build packages created

### 7. Review and Merge

1. Review all automated checks
2. Address any failures
3. Request code review from team
4. Merge when all checks pass

## 🔧 Common Workflows

### Adding New Dependencies

```bash
# Add dependency
npm install new-package

# Test locally
npm run test:unit

# Commit changes
git add package.json package-lock.json
git commit -m "feat: add new-package dependency"
git push
```

### Database Changes

```bash
# Create new migration
npm run migrate:create add_new_table

# Write migration SQL
# ... edit migration file ...

# Test migration locally
npm run migrate

# Commit migration
git add src/database/migrations/
git commit -m "feat: add new_table migration"
git push
```

### Environment Configuration

```bash
# Add new environment variable
echo "NEW_VAR=value" >> .env.example

# Update configuration code
# ... edit config files ...

# Test locally
npm run dev

# Commit changes
git add .env.example config/
git commit -m "feat: add NEW_VAR configuration"
git push
```

## 📊 Understanding the Pipeline

### What Happens When You Push

1. **Code Quality Checks** (~2 minutes)
   - ESLint analysis
   - Prettier formatting
   - TypeScript compilation

2. **Testing Suite** (~5 minutes)
   - Unit tests with coverage
   - Integration tests
   - E2E tests

3. **Security Scanning** (~3 minutes)
   - Dependency vulnerability scan
   - Code security analysis
   - Container security check

4. **Build & Package** (~2 minutes)
   - Application compilation
   - Docker image creation
   - Artifact packaging

### What Happens When You Merge to Main

1. **Release Process**
   - Semantic version calculation
   - Changelog generation
   - GitHub release creation

2. **Deployment**
   - Production deployment
   - Health checks
   - Monitoring setup

3. **Notification**
   - Team notifications
   - Status updates

## 🚨 Common Issues and Solutions

### Build Fails

```bash
# Check locally first
npm run build

# Fix TypeScript errors
npm run typecheck

# Fix linting errors
npm run lint -- --fix
```

### Tests Fail

```bash
# Run specific test
npm test -- --testNamePattern="failing test"

# Run with coverage
npm run test:coverage

# Debug integration tests
npm run test:integration -- --verbose
```

### Security Scan Fails

```bash
# Fix dependency issues
npm audit fix

# Update vulnerable packages
npm update package-name

# Run security scan locally
npm audit --audit-level=moderate
```

## 📚 Next Steps

1. **Read Full Documentation**: Check `/docs/ci-cd/README.md`
2. **Learn Troubleshooting**: Review `/docs/ci-cd/TROUBLESHOOTING.md`
3. **Explore Workflows**: Examine `.github/workflows/`
4. **Configure Your Environment**: Set up your local development setup
5. **Join the Team**: Connect with other developers

## 🔗 Useful Links

- **GitHub Actions Documentation**: https://docs.github.com/en/actions
- **Node.js Best Practices**: https://github.com/goldbergyoni/nodebestpractices
- **Docker Documentation**: https://docs.docker.com/
- **Testing Best Practices**: https://github.com/goldbergyoni/javascript-testing-best-practices

## 📞 Get Help

- **Slack**: #devops, #general
- **GitHub Issues**: Create an issue with `question` label
- **Documentation**: Check `/docs/ci-cd/`
- **Team**: Contact your team lead

---

**Happy coding! 🎉**