# HASEB Setup Checklist & Prerequisites

## 🎯 Overview

This checklist ensures all prerequisites are met and guides you through setting up the HASEB (Holistic Agentic System Evaluator & Benchmarking Suite) from scratch.

## 📋 System Requirements

### Minimum Requirements
- **OS**: Linux (Ubuntu 20.04+), macOS (12+), or Windows 10+
- **Memory**: 4GB RAM (8GB+ recommended)
- **Storage**: 10GB free space
- **Network**: Internet connection for package installation

### Software Requirements

#### Core Dependencies
- [ ] **Node.js** >= 18.0.0 (tested with 18.19.0+)
- [ ] **npm** >= 9.0.0 (tested with 10.2.4+)
- [ ] **Git** >= 2.30.0
- [ ] **PostgreSQL** >= 15.0 (tested with 15.4+)

#### Optional Dependencies
- [ ] **Docker** >= 20.10.0 (for PostgreSQL container)
- [ ] **Docker Compose** >= 2.0.0 (for test environment)
- [ ] **jq** >= 1.6 (for JSON processing in demo script)
- [ ] **bc** >= 1.07 (for mathematical calculations in demo)

#### Development Tools (Optional)
- [ ] **VS Code** or preferred IDE
- [ ] **Postman** or similar API testing tool
- [ ] **DBeaver** or pgAdmin for database management

## 🔍 Prerequisites Verification

### 1. Check System Information
```bash
# OS and architecture
uname -a

# Available memory
free -h  # Linux
sysctl hw.memsize | awk '{print $2/1024/1024/1024 " GB"}'  # macOS

# Available disk space
df -h
```

### 2. Verify Core Dependencies

#### Node.js and npm
```bash
# Check Node.js version
node --version
# Should output: v18.x.x or higher

# Check npm version
npm --version
# Should output: 9.x.x or higher

# If Node.js is not installed or version is too old:
# Ubuntu/Debian:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS:
brew install node@18
brew link node@18

# Windows:
# Download from https://nodejs.org/
```

#### Git
```bash
# Check Git version
git --version
# Should output: git version 2.30.x or higher

# If Git is not installed:
# Ubuntu/Debian:
sudo apt update && sudo apt install git

# macOS:
brew install git

# Windows:
# Download from https://git-scm.com/
```

#### PostgreSQL
```bash
# Check if PostgreSQL is installed
psql --version
# Should output PostgreSQL 15.x or higher

# Check if PostgreSQL service is running
sudo systemctl status postgresql  # Linux
brew services list | grep postgresql  # macOS

# If PostgreSQL is not installed:
# Ubuntu/Debian:
sudo apt update && sudo apt install postgresql postgresql-contrib

# macOS:
brew install postgresql
brew services start postgresql

# Windows:
# Download from https://www.postgresql.org/download/windows/
```

#### Docker (Optional but Recommended)
```bash
# Check Docker version
docker --version
# Should output Docker version 20.x.x or higher

# Check Docker is running
docker info

# Check Docker Compose
docker-compose --version

# If Docker is not installed:
# Ubuntu/Debian:
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# macOS:
# Download Docker Desktop from https://www.docker.com/products/docker-desktop

# Windows:
# Download Docker Desktop from https://www.docker.com/products/docker-desktop
```

### 3. Verify Network Connectivity
```bash
# Test internet connectivity
curl -I https://registry.npmjs.org

# Test npm registry access
npm ping

# Test GitHub access
ssh -T git@github.com
```

## 🚀 Setup Instructions

### 1. Clone Repository
```bash
# Clone the repository
git clone https://github.com/your-org/haseb.git
cd haseb

# Verify repository structure
ls -la
```

### 2. Install Dependencies
```bash
# Clean install (recommended)
npm ci

# Or standard install
npm install

# Verify installation
npm list --depth=0
```

### 3. Environment Configuration

#### Create Environment File
```bash
# Copy example environment file
cp .env.example .env

# Edit environment file
nano .env  # or use your preferred editor
```

#### Required Environment Variables
```env
# Server Configuration
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=haseb
DB_USER=postgres
DB_PASSWORD=password
DB_SSL=false
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000

# JWT Configuration (change in production)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=logs

# External API Keys (if needed)
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

#### Optional Environment Variables
```env
# Benchmark Data Paths
SWE_BENCH_DATA_PATH=./data/swe-bench
GAIA_DATA_PATH=./data/gaia
OSWORLD_DATA_PATH=./data/osworld
WEBARENA_DATA_PATH=./data/webarena

# File Upload Configuration
MAX_FILE_SIZE=10MB
UPLOAD_PATH=./uploads

# Security
BCRYPT_ROUNDS=12
SESSION_SECRET=your-session-secret-change-this

# Monitoring (optional)
SENTRY_DSN=your-sentry-dsn
PROMETHEUS_PORT=9090

# Cache Configuration (optional)
REDIS_URL=redis://localhost:6379
CACHE_TTL=3600
```

### 4. Database Setup

#### Option A: Local PostgreSQL
```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL shell:
CREATE DATABASE haseb;
CREATE USER haseb_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE haseb TO haseb_user;
\q

# Update .env file with new user credentials
# DB_USER=haseb_user
# DB_PASSWORD=your_secure_password
```

#### Option B: Docker PostgreSQL (Recommended for Testing)
```bash
# Start PostgreSQL container
docker-compose -f docker-compose.test.yml up -d

# Wait for database to be ready
docker-compose -f docker-compose.test.yml logs -f postgres

# Container will be available at localhost:5432
# Database: haseb_test
# User: test
# Password: test
```

### 5. Build and Migrate

#### Build Project
```bash
# Compile TypeScript
npm run build

# Verify build
ls -la dist/
```

#### Run Database Migrations
```bash
# Run migrations
npm run migrate

# Verify migration success
npm run migrate status
```

#### Seed Test Data (Optional)
```bash
# Seed test data for demo
npm run seed:test

# Seed production data (if needed)
npm run seed
```

### 6. Verify Installation

#### Test Database Connection
```bash
# Run database connection test
npm run tsx src/database/connection-test.ts

# Expected output: Database connection successful
```

#### Start Backend Server
```bash
# Start backend server
npm run dev:backend

# In another terminal, test health endpoint
curl http://localhost:3000/health

# Expected output: JSON with status: "ok"
```

#### Test API Endpoints
```bash
# Test root endpoint
curl http://localhost:3000/

# Test agents endpoint
curl http://localhost:3000/api/agents

# Test benchmarks endpoint
curl http://localhost:3000/api/benchmarks

# Test API documentation
curl http://localhost:3000/api-docs
```

#### Start Frontend Development Server
```bash
# In a new terminal
npm run dev

# Access frontend at http://localhost:5173
# Should show HASEB dashboard
```

## 🧪 Run Comprehensive Demo

### Quick Demo Run
```bash
# Make demo script executable
chmod +x demo.sh

# Run comprehensive demo
./demo.sh
```

### Demo Validation Steps
The demo script will automatically:

1. ✅ **Environment Check**: Verify all prerequisites
2. ✅ **Database Setup**: Start PostgreSQL, run migrations, seed data
3. ✅ **Backend Startup**: Start server, verify health endpoints
4. ✅ **Frontend Startup**: Start development server, verify UI
5. ✅ **E2E Workflow**: Create test agent, benchmark, run evaluation
6. ✅ **Test Suite**: Run unit, integration, and API tests
7. ✅ **Performance Tests**: Load testing and response time analysis
8. ✅ **Report Generation**: Create comprehensive HTML report

### Expected Demo Results
- **Success Rate**: >90% of tests should pass
- **Report**: Generated at `demo-report.html`
- **Screenshots**: Saved in `demo-screenshots/`
- **Logs**: Detailed log at `demo.log`

## 🔧 Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check what's using port 3000
lsof -i :3000

# Kill process using port 3000
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev:backend
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql  # Linux
brew services list | grep postgresql  # macOS

# Test connection manually
psql -h localhost -U haseb_user -d haseb

# Reset database
dropdb haseb && createdb haseb
npm run migrate
```

#### Permission Issues
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm

# Fix file permissions
sudo chown -R $(whoami) /path/to/haseb
chmod +x demo.sh
```

#### Memory Issues
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run dev:backend

# Clear npm cache
npm cache clean --force
```

#### Docker Issues
```bash
# Check Docker status
sudo systemctl status docker

# Restart Docker service
sudo systemctl restart docker

# Remove all containers and images
docker system prune -a
```

### Environment-Specific Issues

#### Linux/Ubuntu
```bash
# Install missing build tools
sudo apt update
sudo apt install build-essential

# Fix PostgreSQL peer authentication
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'password';"
```

#### macOS
```bash
# Install Xcode command line tools
xcode-select --install

# Fix Node.js path issues
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

#### Windows (WSL)
```bash
# Enable systemd in WSL
echo -e "[boot]\nsystemd=true" | sudo tee -a /etc/wsl.conf

# Restart WSL
wsl --shutdown
wsl

# Install missing dependencies
sudo apt update && sudo apt install build-essential
```

### Getting Help

#### Check Logs
```bash
# Backend logs
tail -f logs/haseb.log

# Demo logs
tail -f demo.log

# Docker logs
docker-compose -f docker-compose.test.yml logs -f postgres
```

#### Debug Mode
```bash
# Enable debug logging
DEBUG=haseb:* npm run dev:backend

# Database query logging
LOG_LEVEL=debug npm run dev:backend
```

#### Health Checks
```bash
# Backend health
curl http://localhost:3000/health

# Database connection
curl http://localhost:3000/api/health/db

# System metrics
curl http://localhost:3000/api/health/metrics
```

## 📚 Additional Resources

### Documentation
- [API Documentation](http://localhost:3000/api-docs)
- [Demo Report](demo-report.html) (after running demo)
- [System Architecture](./ARCHITECTURE.md)
- [API Reference](./API_DOCUMENTATION.md)

### Support
- [GitHub Issues](https://github.com/your-org/haseb/issues)
- [GitHub Discussions](https://github.com/your-org/haseb/discussions)
- [Email Support](mailto:support@haseb.org)

### Community
- [Discord Server](https://discord.gg/haseb)
- [Community Forum](https://forum.haseb.org)
- [YouTube Channel](https://youtube.com/@haseb)

## ✅ Verification Checklist

Before proceeding with development or deployment, verify:

- [ ] All system requirements met
- [ ] All software dependencies installed
- [ ] Environment variables configured
- [ ] Database created and accessible
- [ ] Migrations run successfully
- [ ] Backend server starts without errors
- [ ] Frontend development server loads
- [ ] Health endpoints responding correctly
- [ ] API endpoints accessible
- [ ] Demo script runs successfully
- [ ] Test suite passes
- [ ] Performance metrics collected
- [ ] Documentation accessible

## 🎉 Next Steps

Once setup is complete:

1. **Explore the Dashboard**: Visit http://localhost:5173
2. **Review API Documentation**: Visit http://localhost:3000/api-docs
3. **Run Custom Evaluations**: Use the API endpoints
4. **Monitor Performance**: Check metrics dashboard
5. **Contribute to Project**: Follow contribution guidelines

---

**Happy Evaluating! 🚀**

If you encounter any issues not covered in this checklist, please create an issue on GitHub or contact our support team.