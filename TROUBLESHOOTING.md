# HASEB Troubleshooting Guide

This comprehensive troubleshooting guide helps you diagnose and resolve common issues when installing, configuring, and running the HASEB system.

## 📋 Table of Contents

- [Installation Issues](#installation-issues)
- [Database Problems](#database-problems)
- [Server and API Issues](#server-and-api-issues)
- [Frontend Issues](#frontend-issues)
- [Evaluation and Agent Issues](#evaluation-and-agent-issues)
- [Performance Issues](#performance-issues)
- [Network and Connectivity Issues](#network-and-connectivity-issues)
- [WebSocket Issues](#websocket-issues)
- [Testing Issues](#testing-issues)
- [Development Environment Issues](#development-environment-issues)
- [Production Deployment Issues](#production-deployment-issues)
- [Debugging Tools and Techniques](#debugging-tools-and-techniques)

## 🔧 Installation Issues

### Node.js Version Compatibility

**Problem**: Node.js version too old or incompatible
```bash
Error: Node.js version 16.x is not supported. Please use Node.js 18.x or higher.
```

**Solution**:
```bash
# Check current version
node --version

# Install correct version using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Or install directly from Node.js repository
# Ubuntu/Debian:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS:
brew install node@18
brew link node@18
```

### npm Permission Errors

**Problem**: Permission denied when installing packages
```bash
npm ERR! code EACCES
npm ERR! errno -13
npm ERR! Error: EACCES: permission denied, access '/usr/local/lib/node_modules'
```

**Solution**:
```bash
# Option 1: Fix npm permissions (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Option 2: Use nvm (recommended approach)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18

# Option 3: Use a node version manager like fnm
curl -fsSL https://github.com/Schniz/fnm/raw/master/.ci/install.sh | bash
```

### Dependency Installation Failures

**Problem**: `npm install` fails with network or build errors

**Solutions**:
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Try different registry
npm install --registry https://registry.npmjs.org/

# Increase timeout for slow networks
npm install --timeout=300000

# If build tools are missing (Linux)
sudo apt-get install build-essential

# If Python is required for native modules
sudo apt-get install python3-dev

# For macOS, install Xcode Command Line Tools
xcode-select --install
```

### Git Clone Issues

**Problem**: Cannot clone repository
```bash
fatal: unable to access 'https://github.com/your-org/haseb.git/': SSL certificate problem
```

**Solutions**:
```bash
# Temporary disable SSL verification (not recommended for production)
git config --global http.sslVerify false
git clone https://github.com/your-org/haseb.git
git config --global http.sslVerify true

# Or use SSH instead of HTTPS
git clone git@github.com:your-org/haseb.git

# Update certificate authority certificates
sudo apt-get update && sudo apt-get install ca-certificates
```

## 🗄️ Database Problems

### PostgreSQL Connection Refused

**Problem**: Cannot connect to PostgreSQL
```bash
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Diagnosis and Solutions**:
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL if not running
sudo systemctl start postgresql

# Enable PostgreSQL to start on boot
sudo systemctl enable postgresql

# Check if PostgreSQL is listening on correct port
sudo netstat -tlnp | grep :5432

# Check PostgreSQL configuration
sudo nano /etc/postgresql/15/main/postgresql.conf
# Ensure: listen_addresses = 'localhost'

# Restart PostgreSQL after configuration changes
sudo systemctl restart postgresql
```

### Database or User Doesn't Exist

**Problem**: Authentication failed or database doesn't exist
```bash
Error: database "haseb" does not exist
FATAL: password authentication failed for user "haseb_user"
```

**Solutions**:
```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Create database and user
CREATE DATABASE haseb;
CREATE USER haseb_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE haseb TO haseb_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO haseb_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO haseb_user;

# Exit PostgreSQL shell
\q

# Test connection
psql -h localhost -U haseb_user -d haseb -c "SELECT version();"
```

### Migration Failures

**Problem**: Database migrations fail
```bash
Error: Migration 003 failed: relation "benchmarks" already exists
```

**Solutions**:
```bash
# Check migration status
npm run migrate:status

# Rollback to specific migration
npm run migrate:rollback 002

# Reset and re-run all migrations (WARNING: destroys data)
npm run migrate:reset

# Manually run specific migration
npm run migrate -- --to 004

# Check migration file for syntax errors
nano src/database/migrations.ts
```

### Connection Pool Exhaustion

**Problem**: Too many database connections
```bash
Error: sorry, too many clients already
```

**Solutions**:
```bash
# Check current connections
psql -h localhost -U haseb_user -d haseb -c "SELECT count(*) FROM pg_stat_activity;"

# Kill idle connections
psql -h localhost -U haseb_user -d haseb -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';"

# Increase max connections in PostgreSQL
sudo nano /etc/postgresql/15/main/postgresql.conf
# Set: max_connections = 200

# Restart PostgreSQL
sudo systemctl restart postgresql

# Update connection pool settings in .env
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
```

## 🌐 Server and API Issues

### Port Already in Use

**Problem**: Server fails to start - port 3000 is occupied
```bash
Error: listen EADDRINUSE :::3000
```

**Solutions**:
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process (replace PID with actual process ID)
kill -9 <PID>

# Or use a different port
PORT=3001 npm run dev:backend

# Update frontend to use new port if needed
```

### Server Won't Start

**Problem**: Server exits immediately without error message

**Diagnosis**:
```bash
# Enable debug logging
DEBUG=haseb:* npm run dev:backend

# Check Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" npm run dev:backend

# Check for syntax errors
npm run typecheck

# Check for missing environment variables
npm run dev:backend 2>&1 | grep -i error
```

### API Endpoints Return 404

**Problem**: API endpoints return 404 Not Found

**Solutions**:
```bash
# Verify server is running
curl http://localhost:3000/health

# Check API routes are properly mounted
curl http://localhost:3000/api/agents

# Check server logs for route registration errors
npm run dev:backend

# Verify CORS configuration if accessing from different domain
curl -H "Origin: http://localhost:3000" http://localhost:3000/api/agents
```

### Authentication Issues

**Problem**: JWT authentication not working

**Diagnosis**:
```bash
# Check JWT secret is configured
grep JWT_SECRET .env

# Generate new JWT secret if missing
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Test token generation
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Verify token format (should be JWT)
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" | cut -d. -f2 | base64 -d
```

## 🎨 Frontend Issues

### Development Server Not Loading

**Problem**: Vite dev server shows blank page or errors

**Solutions**:
```bash
# Clear Vite cache
rm -rf node_modules/.vite
rm -rf dist

# Reinstall dependencies
npm install

# Check for port conflicts
lsof -i :5173  # Vite default port

# Start with specific port
npm run dev -- --port 3001

# Check console errors in browser developer tools
```

### API Connection Errors in Browser

**Problem**: Frontend cannot connect to backend API

**Solutions**:
```bash
# Verify backend is running
curl http://localhost:3000/health

# Check CORS configuration
curl -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-Requested-With" -X OPTIONS \
  http://localhost:3000/api/agents

# Update .env CORS settings
CORS_ORIGIN=http://localhost:3000

# Check browser network tab for CORS errors
```

### Component Rendering Issues

**Problem**: React components not rendering or showing errors

**Diagnosis**:
```bash
# Check TypeScript compilation
npm run typecheck

# Check for React-specific errors
npm run test:unit

# Clear React DevTools cache if using
# (in browser developer tools)

# Check console for JavaScript errors
```

## 🤖 Evaluation and Agent Issues

### Evaluations Stuck in Pending

**Problem**: Evaluations never move from "pending" status

**Diagnosis**:
```bash
# Check orchestrator status
curl http://localhost:3000/api/orchestrator/status

# Check evaluation queue
curl http://localhost:3000/api/orchestrator/queue/status

# Check system logs
tail -f logs/haseb.log | grep orchestrator

# Check if agent is active
curl http://localhost:3000/api/agents/{agentId}
```

**Solutions**:
```bash
# Start orchestrator if not running
npm run dev:backend  # Orchestrator starts with server

# Restart evaluation
curl -X POST http://localhost:3000/api/orchestrator/evaluations/{id}/restart

# Check agent configuration
curl -X PATCH http://localhost:3000/api/agents/{id}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}'
```

### Agent Execution Failures

**Problem**: Agents fail during execution with errors

**Diagnosis**:
```bash
# Get evaluation details with logs
curl http://localhost:3000/api/evaluations/{id}

# Check agent configuration
curl http://localhost:3000/api/agents/{agentId}

# Check benchmark configuration
curl http://localhost:3000/api/benchmarks/{benchmarkId}
```

**Common Issues**:
```bash
# Missing API keys
grep OPENAI_API_KEY .env

# Invalid agent configuration
curl http://localhost:3000/api/agents/{id} | jq '.configuration'

# Benchmark data missing
ls -la data/swe-bench/
```

### Metrics Collection Issues

**Problem**: Evaluation metrics are not being collected

**Diagnosis**:
```bash
# Check metrics collectors
curl http://localhost:3000/api/metrics/dashboard

# Check evaluation metrics
curl http://localhost:3000/api/evaluations/{id}

# Check metrics service logs
tail -f logs/haseb.log | grep metrics
```

## ⚡ Performance Issues

### High Memory Usage

**Problem**: Server consuming excessive memory

**Diagnosis**:
```bash
# Check current memory usage
curl http://localhost:3000/health | jq '.memory'

# Monitor memory over time
watch -n 5 'curl -s http://localhost:3000/health | jq ".memory"'

# Check Node.js process memory
ps aux | grep node
```

**Solutions**:
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run dev:backend

# Enable garbage collection logging
NODE_OPTIONS="--trace-gc" npm run dev:backend

# Check for memory leaks
npm run test:performance
```

### Slow API Responses

**Problem**: API endpoints responding slowly

**Diagnosis**:
```bash
# Test response times
time curl http://localhost:3000/api/agents

# Check database query performance
LOG_LEVEL=debug npm run dev:backend

# Monitor system resources
htop
```

**Solutions**:
```bash
# Add database indexes
psql -h localhost -U haseb_user -d haseb -c "CREATE INDEX CONCURRENTLY idx_evaluations_status_created ON evaluations(status, created_at);"

# Enable query caching
REDIS_URL=redis://localhost:6379 npm run dev:backend

# Optimize database connection pool
DB_MAX_CONNECTIONS=30 npm run dev:backend
```

### Database Performance Issues

**Problem**: Database queries are slow

**Diagnosis**:
```bash
# Check slow queries
psql -h localhost -U haseb_user -d haseb -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check database connections
psql -h localhost -U haseb_user -d haseb -c "SELECT count(*) FROM pg_stat_activity;"

# Analyze query plans
psql -h localhost -U haseb_user -d haseb -c "EXPLAIN ANALYZE SELECT * FROM evaluations WHERE status = 'running';"
```

## 🌐 Network and Connectivity Issues

### Firewall Blocking Connections

**Problem**: Cannot access server from other machines

**Diagnosis**:
```bash
# Check if server is listening on all interfaces
netstat -tlnp | grep :3000

# Check firewall status
sudo ufw status

# Check iptables rules
sudo iptables -L
```

**Solutions**:
```bash
# Allow port in firewall
sudo ufw allow 3000/tcp

# Or disable firewall temporarily (for testing only)
sudo ufw disable

# Bind to all interfaces (in .env)
HOST=0.0.0.0
```

### SSL/HTTPS Issues

**Problem**: HTTPS configuration not working

**Diagnosis**:
```bash
# Check SSL certificate
openssl x509 -in /path/to/cert.pem -text -noout

# Test SSL connection
openssl s_client -connect your-domain.com:443

# Check certificate expiration
openssl x509 -in /path/to/cert.pem -noout -dates
```

### Proxy Configuration Issues

**Problem**: Running behind reverse proxy (nginx/Apache)

**Diagnosis**:
```bash
# Check nginx configuration
sudo nginx -t

# Check proxy headers
curl -H "X-Forwarded-Proto: https" http://localhost:3000/health

# Check proxy logs
sudo tail -f /var/log/nginx/access.log
```

**Nginx Configuration Example**:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔌 WebSocket Issues

### WebSocket Connection Failures

**Problem**: WebSocket connections fail to establish

**Diagnosis**:
```bash
# Test WebSocket connection
wscat -c ws://localhost:3000

# Check WebSocket server logs
tail -f logs/haseb.log | grep websocket

# Test with curl
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" \
     http://localhost:3000
```

**Solutions**:
```bash
# Check if WebSocket manager is initialized
grep "WebSocket manager initialized" logs/haseb.log

# Restart server to initialize WebSocket
npm run dev:backend

# Check firewall WebSocket support
sudo ufw allow 3000/tcp
```

### WebSocket Authentication Issues

**Problem**: WebSocket authentication fails

**Diagnosis**:
```bash
# Test authentication flow
wscat -c ws://localhost:3000
# Send: {"type":"auth","token":"your-jwt-token"}

# Check JWT token validity
curl -H "Authorization: Bearer your-jwt-token" http://localhost:3000/api/auth/me
```

### Real-time Updates Not Working

**Problem**: Not receiving real-time evaluation updates

**Diagnosis**:
```bash
# Check subscription
wscat -c ws://localhost:3000
# Send: {"type":"subscribe","channel":"evaluations"}

# Check evaluation is actually running
curl http://localhost:3000/api/orchestrator/status

# Check evaluation status
curl http://localhost:3000/api/evaluations/{id}
```

## 🧪 Testing Issues

### Tests Fail to Run

**Problem**: `npm test` fails with errors

**Common Issues and Solutions**:
```bash
# Test database not available
docker-compose -f docker-compose.test.yml up -d

# Missing test dependencies
npm install --dev

# Permission issues with test files
sudo chown -R $USER:$USER tests/

# Jest configuration issues
npm run test:debug

# TypeScript compilation errors
npm run typecheck

# Missing test environment variables
cp .env.example .env.test
```

### Test Database Issues

**Problem**: Tests can't connect to test database

**Solutions**:
```bash
# Start test database
docker-compose -f docker-compose.test.yml up -d

# Wait for database to be ready
docker-compose -f docker-compose.test.yml exec postgres pg_isready

# Reset test database
NODE_ENV=test npm run migrate:reset
NODE_ENV=test npm run seed:test

# Check test database configuration
cat .env.test
```

### Coverage Issues

**Problem**: Test coverage is below required threshold

**Diagnosis**:
```bash
# Run coverage with detailed output
npm run test:coverage -- --verbose

# Check uncovered files
open coverage/lcov-report/index.html

# Identify missing tests
npm run test:coverage -- --coverageReporters=text-summary
```

## 💻 Development Environment Issues

### Hot Reload Not Working

**Problem**: Code changes not reflecting immediately

**Solutions**:
```bash
# Check file watchers
npm run dev:backend

# Clear file system cache
echo 2 | sudo tee /proc/sys/vm/drop_caches

# Restart development server
npm run dev:backend

# Check for file permission issues
ls -la src/
```

### TypeScript Compilation Errors

**Problem**: TypeScript fails to compile

**Diagnosis**:
```bash
# Check TypeScript configuration
cat tsconfig.json

# Run type checking
npm run typecheck

# Check for circular dependencies
# (use tools like madge)
npx madge --circular src/
```

### Linting and Formatting Issues

**Problem**: Code linting fails

**Solutions**:
```bash
# Run linter with auto-fix
npm run lint:fix

# Check specific linting rules
npx eslint src/your-file.ts

# Format code
npm run format

# Ignore specific rules (in .eslintrc.js)
module.exports = {
  rules: {
    'your-rule': 'off'
  }
}
```

## 🚀 Production Deployment Issues

### Environment Variables Not Loading

**Problem**: Production server not using correct environment variables

**Diagnosis**:
```bash
# Check if .env file exists
ls -la .env

# Check environment variables in running process
pgrep -f node | xargs ps -p
cat /proc/<PID>/environ | tr '\0' '\n'

# Use specific environment file
NODE_ENV=production node -r dotenv/config dist/server.js dotenv_config_path=.env.production
```

### Process Management Issues

**Problem**: Server crashes and doesn't restart

**Solutions**:
```bash
# Use PM2 for process management
npm install -g pm2

# Create PM2 ecosystem file
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
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_file: 'logs/combined.log',
    time: true
  }]
}
EOF

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

### SSL Certificate Issues

**Problem**: SSL certificates expire or are invalid

**Solutions**:
```bash
# Check certificate expiration
openssl x509 -in /path/to/cert.pem -noout -dates

# Generate self-signed certificate (for development)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /path/to/key.pem -out /path/to/cert.pem

# Use Let's Encrypt (for production)
sudo apt-get install certbot
sudo certbot certonly --standalone -d your-domain.com

# Set up auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🛠️ Debugging Tools and Techniques

### Enable Debug Logging

```bash
# Enable all debug logs
DEBUG=haseb:* npm run dev:backend

# Enable specific debug modules
DEBUG=haseb:database,haseb:orchestrator npm run dev:backend

# Enable debug in production
DEBUG=haseb:* NODE_ENV=production npm start
```

### Database Query Debugging

```bash
# Enable query logging
LOG_LEVEL=debug npm run dev:backend

# Enable PostgreSQL query logging
# In postgresql.conf:
log_statement = 'all'
log_min_duration_statement = 0

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Performance Profiling

```bash
# Use Node.js profiler
NODE_OPTIONS="--prof" npm run dev:backend

# Analyze profile data
node --prof-process isolate-*.log > processed.txt

# Use clinic.js for performance analysis
npm install -g clinic
clinic doctor -- node dist/server.js
```

### Memory Leak Detection

```bash
# Enable heap snapshots
NODE_OPTIONS="--inspect" npm run dev:backend

# Use Chrome DevTools for memory profiling
# Open chrome://inspect and connect to Node.js process

# Use heapdump module for automated heap snapshots
npm install heapdump
# Add to code: heapdump.writeSnapshot('/path/to/snapshot.heapsnapshot')
```

### Network Debugging

```bash
# Monitor network connections
netstat -tlnp | grep :3000

# Use tcpdump for packet analysis
sudo tcpdump -i lo port 3000

# Use Wireshark for detailed network analysis
# Install Wireshark and capture traffic on port 3000
```

### Request Tracing

```bash
# Add request IDs for tracing
# In middleware:
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

# Trace requests through logs
grep "request-id" logs/haseb.log
```

## 📞 Getting Additional Help

If you're still experiencing issues after trying these solutions:

1. **Check the logs**: `tail -f logs/haseb.log`
2. **Enable debug mode**: `DEBUG=haseb:* npm run dev:backend`
3. **Search existing issues**: [GitHub Issues](https://github.com/your-org/haseb/issues)
4. **Create a detailed issue report** with:
   - Operating system and version
   - Node.js and npm versions
   - PostgreSQL version
   - Complete error message
   - Steps to reproduce
   - Expected vs actual behavior
   - Relevant logs and configuration

5. **Join the community**:
   - Discord: [Join our Discord](https://discord.gg/haseb)
   - Discussions: [GitHub Discussions](https://github.com/your-org/haseb/discussions)
   - Email: support@haseb.org

## 📚 Additional Resources

- [Node.js Debugging Guide](https://nodejs.org/en/docs/guides/debugging-getting-started/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server)
- [React Debugging Tools](https://reactjs.org/blog/2019/08/15/new-react-devtools.html)
- [WebSocket Debugging](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket_API/Using_WebSockets)

---

Remember that many issues can be resolved by ensuring you're using the correct versions of all dependencies and that your environment is properly configured according to the [Installation Guide](INSTALLATION.md).