import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { createServer as createHttpServer } from 'http';
import dotenv from 'dotenv';

import { logger } from './utils/logger';
import { testDb } from './database/connection-test';

// Import routes
import agentsRoutes from './api/agents';
import benchmarksRoutes from './api/benchmarks';
import evaluationsRoutes from './api/evaluations';
import authRoutes from './api/auth';
import metricsRoutes from './api/metrics';
import orchestratorRoutes from './api/orchestrator';

// Import orchestrator components
import { EvaluationOrchestrator } from './orchestrator/EvaluationOrchestrator';
import { EvaluationQueue } from './orchestrator/EvaluationQueue';
import { WebSocketManager } from './orchestrator/WebSocketManager';

// Middleware
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { validateRequest } from './middleware/validation';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize orchestrator components
export const orchestrator = new EvaluationOrchestrator();
export const wsManager = new WebSocketManager();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Limit each IP
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HASEB API',
      version: '1.0.0',
      description: 'Holistic Agentic System Evaluator & Benchmarking Suite API',
      contact: {
        name: 'HASEB Team',
        email: 'team@haseb.org',
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || `http://localhost:${PORT}`,
        description: 'Test server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/api/*.ts', './src/api/**/*.ts'],
};

const specs = swaggerJsdoc(swaggerOptions);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for testing
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true,
}));

app.use(compression());
app.use(limiter);
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Custom middleware
app.use(requestLogger);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbConnected = await testDb.testConnection();
    const dbStats = testDb.getPoolStats();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'test',
      database: {
        connected: dbConnected,
        pool: dbStats,
        type: 'in-memory-test'
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      message: 'Service unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

// API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'HASEB API Documentation - Test Mode',
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/benchmarks', benchmarksRoutes);
app.use('/api/evaluations', evaluationsRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/orchestrator', orchestratorRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'HASEB API - Test Mode',
    version: '1.0.0',
    description: 'Holistic Agentic System Evaluator & Benchmarking Suite - Test Environment',
    mode: 'test',
    database: 'in-memory',
    endpoints: {
      health: '/health',
      documentation: '/api-docs',
      api: '/api',
    },
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      timestamp: new Date(),
    },
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

async function startTestServer() {
  try {
    logger.info('Starting HASEB test server...');

    // Test database connection
    const dbConnected = await testDb.testConnection();
    if (!dbConnected) {
      throw new Error('Test database connection failed');
    }

    // Create some initial test data
    await createTestData();

    // Create HTTP server for WebSocket support
    const server = createHttpServer(app);

    // Initialize WebSocket manager
    wsManager.initialize(server);

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 HASEB test server running on port ${PORT}`);
      logger.info(`📚 API documentation available at http://localhost:${PORT}/api-docs`);
      logger.info(`🏥 Health check available at http://localhost:${PORT}/health`);
      logger.info(`🔌 WebSocket server initialized`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'test'}`);
      logger.info(`💾 Database: In-memory test database`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      await orchestrator.shutdown();
      await wsManager.close();
      await testDb.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully...');
      await orchestrator.shutdown();
      await wsManager.close();
      await testDb.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start test server:', error);
    process.exit(1);
  }
}

async function createTestData() {
  logger.info('Creating initial test data...');

  try {
    // Create test user
    await testDb.query(
      'INSERT INTO users (id, email, username, fullName, role, isActive, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [1, 'test@example.com', 'testuser', 'Test User', 'user', true, new Date(), new Date()]
    );

    // Create test agent
    await testDb.query(
      'INSERT INTO agents (id, name, type, description, capabilities, isActive, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [1, 'Test Agent', 'researcher', 'A test research agent', ['research', 'analysis'], true, new Date(), new Date()]
    );

    // Create test benchmark
    await testDb.query(
      'INSERT INTO benchmarks (id, name, type, description, category, isActive, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [1, 'Test Benchmark', 'swe-bench', 'A test software engineering benchmark', 'software-engineering', true, new Date(), new Date()]
    );

    logger.info('Test data created successfully');
  } catch (error) {
    logger.error('Failed to create test data:', error);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  startTestServer();
}

export default app;