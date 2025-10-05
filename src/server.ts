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
import { db } from './database/connection';
import { MigrationManager } from './database/migrations';
import { SqliteMigrationManager } from './database/sqlite-migrations';

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
const PORT = process.env.PORT || 3000;

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
        description: 'Development server',
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
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
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
    const dbConnected = await db.testConnection();
    const dbStats = db.getPoolStats();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: {
        connected: dbConnected,
        pool: dbStats,
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
  customSiteTitle: 'HASEB API Documentation',
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
    name: 'HASEB API',
    version: '1.0.0',
    description: 'Holistic Agentic System Evaluator & Benchmarking Suite',
    endpoints: {
      health: '/health',
      documentation: '/api-docs',
      api: '/api',
    },
  });
});

// 404 handler
app.use((req, res) => {
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

async function startServer() {
  try {
    logger.info('Starting HASEB server...');

    // Test database connection
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    // Run migrations
    logger.info('Running database migrations...');
    const dbType = (process.env.DB_TYPE || 'postgresql').toLowerCase();
    if (dbType === 'sqlite') {
      await SqliteMigrationManager.migrate();
    } else {
      await MigrationManager.migrate();
    }

    // Create HTTP server for WebSocket support
    const server = createHttpServer(app);

    // Initialize WebSocket manager
    wsManager.initialize(server);

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 HASEB server running on port ${PORT}`);
      logger.info(`📚 API documentation available at http://localhost:${PORT}/api-docs`);
      logger.info(`🏥 Health check available at http://localhost:${PORT}/health`);
      logger.info(`🔌 WebSocket server initialized`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      await orchestrator.shutdown();
      await wsManager.close();
      await db.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully...');
      await orchestrator.shutdown();
      await wsManager.close();
      await db.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
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
  startServer();
}

export default app;