# HASEB Installation Guide

This guide provides detailed, step-by-step instructions for installing and setting up the HASEB (Holistic Agentic System Evaluator & Benchmarking Suite) on your system.

## 📋 System Requirements

### Minimum Requirements
- **CPU**: 2+ cores (64-bit processor)
- **Memory**: 4GB RAM (8GB+ recommended)
- **Storage**: 10GB free disk space
- **Network**: Stable internet connection for package downloads

### Supported Operating Systems
- **Linux**: Ubuntu 20.04+, Debian 11+, CentOS 8+
- **macOS**: 12.0+ (Monterey or later)
- **Windows**: 10+ (Windows Subsystem for Linux 2 recommended)

### Required Software Versions
- **Node.js**: 18.0.0 or higher (tested with 18.19.0+)
- **npm**: 9.0.0 or higher (tested with 10.2.4+)
- **PostgreSQL**: 15.0 or higher (tested with 15.4+)
- **Git**: 2.30.0 or higher

## 🔍 Prerequisites Check

Before installing HASEB, verify your system meets the requirements:

### Check Node.js Version
```bash
node --version
# Expected output: v18.0.0 or higher
npm --version
# Expected output: 9.0.0 or higher
```

### Check PostgreSQL Version
```bash
psql --version
# Expected output: psql (PostgreSQL) 15.0 or higher
pg_isready
# Expected output: accepting connections
```

### Check Git Version
```bash
git --version
# Expected output: git version 2.30.0 or higher
```

If any of these checks fail, install the required software using the instructions below.

## 📥 Installation Steps

### Step 1: Install Node.js and npm

#### Ubuntu/Debian
```bash
# Install Node.js 18.x repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js and npm
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

#### macOS
```bash
# Using Homebrew (recommended)
brew install node@18
brew link node@18

# Verify installation
node --version
npm --version
```

#### Windows
1. Download Node.js 18.x installer from [nodejs.org](https://nodejs.org/)
2. Run the installer with default settings
3. Restart your terminal/command prompt
4. Verify installation:
   ```cmd
   node --version
   npm --version
   ```

### Step 2: Install PostgreSQL

#### Ubuntu/Debian
```bash
# Install PostgreSQL repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

# Add repository key
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Update package lists and install PostgreSQL
sudo apt-get update
sudo apt-get install -y postgresql-15 postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
sudo -u postgres psql --version
pg_isready
```

#### macOS
```bash
# Install PostgreSQL using Homebrew
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Verify installation
psql --version
pg_isready
```

#### Windows
1. Download PostgreSQL 15+ installer from [postgresql.org](https://www.postgresql.org/download/)
2. Run the installer with default settings
3. Remember the password you set for the postgres user
4. Add PostgreSQL to PATH if prompted
5. Verify installation:
   ```cmd
   psql --version
   ```

### Step 3: Configure PostgreSQL

#### Create Database and User
```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# In PostgreSQL shell, run:
CREATE DATABASE haseb;
CREATE USER haseb_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE haseb TO haseb_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO haseb_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO haseb_user;

# Verify the database was created
\l

# Exit PostgreSQL shell
\q
```

#### Test Database Connection
```bash
# Test connection with new user
psql -h localhost -U haseb_user -d haseb

# If prompted, enter the password you set
# You should see: haseb=>

# Exit the database
\q
```

### Step 4: Clone HASEB Repository

```bash
# Navigate to your preferred directory
cd ~/projects

# Clone the repository
git clone https://github.com/your-org/haseb.git

# Navigate to project directory
cd haseb

# Verify the structure
ls -la
```

Expected output should show:
```
total 200
drwxr-xr-x   50 user  staff   1600 Dec  1 10:00 .
drwxr-xr-x   10 user  staff    320 Dec  1 10:00 ..
-rw-r--r--    1 user  staff  1500 Dec  1 10:00 .env.example
-rw-r--r--    1 user  staff   500 Dec  1 10:00 .gitignore
-rw-r--r--    1 user  staff  1000 Dec  1 10:00 package.json
-rw-r--r--    1 user  staff  2000 Dec  1 10:00 README.md
drwxr-xr-x    1 user  staff   160 Dec  1 10:00 src
drwxr-xr-x    1 user  staff   128 Dec  1 10:00 tests
```

### Step 5: Install Dependencies

```bash
# Install all npm dependencies
npm install

# Verify installation completed successfully
npm list --depth=0
```

The installation should complete without errors. Common issues:
- **Network timeout**: Try again or use `npm install --registry https://registry.npmjs.org/`
- **Permission errors**: Try `sudo npm install` (not recommended) or fix npm permissions
- **Outdated npm**: Run `npm install -g npm@latest`

### Step 6: Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit the environment file with your preferred editor
nano .env  # or vim .env or code .env
```

Update the following essential variables:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=haseb
DB_USER=haseb_user
DB_PASSWORD=your_secure_password  # Use the password you set in Step 3
DB_SSL=false

# Server Configuration
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000

# JWT Configuration (generate a secure secret)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output to your `JWT_SECRET` value.

### Step 7: Run Database Migrations

```bash
# Run database migrations to create all tables
npm run migrate

# Expected output:
# Applying migration 001: create_users_table
# Migration 001 applied successfully
# Applying migration 002: create_agents_table
# Migration 002 applied successfully
# ... (all migrations up to 007)
# No pending migrations
```

If you encounter errors:
- **Connection failed**: Verify PostgreSQL is running and credentials are correct
- **Permission denied**: Check database user permissions
- **Migration already applied**: Run `npm run migrate:status` to see current state

### Step 8: Optional - Seed Test Data

```bash
# Seed the database with test data
npm run seed:test

# Expected output:
# Seeding agents...
# Seeding benchmarks...
# Seeding users...
# Database seeded successfully
```

### Step 9: Verify Installation

#### Test Database Connection
```bash
# Start the backend server
npm run dev:backend

# In a separate terminal, test the health endpoint
curl http://localhost:3000/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "uptime": 5.234,
  "version": "1.0.0",
  "environment": "development",
  "database": {
    "connected": true,
    "pool": {
      "total": 1,
      "idle": 0,
      "waiting": 0
    }
  },
  "memory": {
    "used": 85,
    "total": 512
  }
}
```

#### Test API Documentation
```bash
# Access API documentation
curl http://localhost:3000/api-docs

# Or open in browser: http://localhost:3000/api-docs
```

#### Run Basic Tests
```bash
# Run the test suite to verify everything works
npm test

# Expected: All tests pass with 90%+ coverage
```

## 🐳 Alternative: Docker Installation

If you prefer using Docker, here's the quick setup:

### Install Docker
- **Ubuntu**: Follow [Docker Ubuntu installation guide](https://docs.docker.com/engine/install/ubuntu/)
- **macOS**: Download Docker Desktop from [docker.com](https://docker.com/)
- **Windows**: Download Docker Desktop from [docker.com/](https://docker.com/)

### Using Docker Compose

```bash
# Start test database
docker-compose -f docker-compose.test.yml up -d

# Wait for PostgreSQL to be ready (about 30 seconds)
docker-compose -f docker-compose.test.yml ps

# Verify PostgreSQL is running
docker-compose -f docker-compose.test.yml exec postgres pg_isready

# Install dependencies and run migrations
npm install
npm run migrate

# Start the application
npm run dev:backend
```

## 🚀 Post-Installation Steps

### 1. Create First Admin User (Optional)

If you want to enable authentication:

```bash
# Connect to PostgreSQL
psql -h localhost -U haseb_user -d haseb

# Insert admin user (replace with actual bcrypt hash)
INSERT INTO users (email, username, full_name, password_hash, role, is_active)
VALUES (
  'admin@haseb.org',
  'admin',
  'System Administrator',
  '$2b$12$your-bcrypt-hash-here',
  'admin',
  true
);

# Exit
\q
```

Generate a bcrypt hash:
```bash
node -e "console.log(require('bcryptjs').hashSync('your-password', 12))"
```

### 2. Configure Firewall (Production)

If running on a server, open necessary ports:

```bash
# Ubuntu UFW
sudo ufw allow 3000/tcp
sudo ufw allow 22/tcp
sudo ufw enable

# CentOS Firewall
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### 3. Set Up Process Management (Production)

For production deployment, use PM2:

```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem.config.js
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'haseb',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
EOF

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

## 🔧 Configuration Reference

### Complete Environment Variables

For production deployment, configure all these variables:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
API_BASE_URL=https://your-domain.com

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=haseb
DB_USER=haseb_user
DB_PASSWORD=your_secure_password
DB_SSL=true
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000

# Security Configuration
JWT_SECRET=your-64-character-random-secret
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
SESSION_SECRET=another-secure-secret

# CORS Configuration
CORS_ORIGIN=https://your-frontend-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging Configuration
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/haseb

# File Upload Configuration
MAX_FILE_SIZE=10MB
UPLOAD_PATH=/var/www/haseb/uploads

# External API Keys (if using integrations)
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Benchmark Data Paths
SWE_BENCH_DATA_PATH=/data/swe-bench
GAIA_DATA_PATH=/data/gaia
OSWORLD_DATA_PATH=/data/osworld
WEBARENA_DATA_PATH=/data/webarena

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Monitoring Configuration (optional)
SENTRY_DSN=your-sentry-dsn
PROMETHEUS_PORT=9090

# Cache Configuration (optional)
REDIS_URL=redis://localhost:6379
CACHE_TTL=3600
```

## 🧪 Testing Your Installation

### 1. Health Check
```bash
curl http://localhost:3000/health
```

### 2. API Endpoints Test
```bash
# Test agents endpoint
curl http://localhost:3000/api/agents

# Test benchmarks endpoint
curl http://localhost:3000/api/benchmarks

# Test metrics endpoint
curl http://localhost:3000/api/metrics/dashboard
```

### 3. Database Connectivity Test
```bash
# Test database connection
psql -h localhost -U haseb_user -d haseb -c "SELECT version();"

# Test table creation
psql -h localhost -U haseb_user -d haseb -c "\dt"
```

### 4. WebSocket Test
```bash
# Test WebSocket endpoint (requires wscat)
npm install -g wscat
wscat -c ws://localhost:3000
```

## 🔍 Troubleshooting Common Installation Issues

### PostgreSQL Connection Issues

**Error**: `Connection refused`
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Start PostgreSQL if not running
sudo systemctl start postgresql

# Check if PostgreSQL is listening
sudo netstat -tlnp | grep :5432
```

**Error**: `FATAL: database "haseb" does not exist`
```bash
# Create the database
sudo -u postgres createdb haseb

# Grant permissions
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE haseb TO haseb_user;"
```

### Node.js/npm Issues

**Error**: `EACCES: permission denied`
```bash
# Fix npm permissions (Linux/macOS)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

**Error**: `Cannot find module`
```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3000`
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 npm run dev:backend
```

### Migration Issues

**Error**: `Migration already applied`
```bash
# Check migration status
npm run migrate:status

# Rollback to specific version
npm run migrate:rollback 006

# Or reset completely (WARNING: destroys data)
npm run migrate:reset
```

### Memory Issues

**Error**: `JavaScript heap out of memory`
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run dev:backend
```

## 📞 Getting Help

If you encounter issues during installation:

1. **Check the logs**: `tail -f logs/haseb.log`
2. **Enable debug mode**: `DEBUG=haseb:* npm run dev:backend`
3. **Run diagnostics**: `npm run diagnose` (if available)
4. **Check GitHub Issues**: [github.com/your-org/haseb/issues](https://github.com/your-org/haseb/issues)
5. **Create an issue**: Include OS, Node.js version, and error messages

## 🎉 Next Steps

Congratulations! HASEB is now installed and running. Here's what to do next:

1. **Read the User Guide**: Check [README.md](README.md) for usage instructions
2. **Run the Demo**: Follow [DEMO.md](DEMO.md) for a walkthrough
3. **Configure Benchmarks**: Set up your first evaluation benchmark
4. **Create Agents**: Define and configure your AI agents
5. **Run Evaluations**: Start evaluating your agents

For development and contribution guidelines, see the main README.md file.