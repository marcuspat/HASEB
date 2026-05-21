import express from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest, commonSchemas } from '../middleware/validation';
import { logApiCall } from '../middleware/requestLogger';
import { ApiResponse } from '../types/index';
import { logger } from '../utils/logger';
import { orchestrator } from '../orchestrator/instance';

const router = express.Router();

/**
 * @swagger
 * /api/orchestrator/evaluate:
 *   post:
 *     summary: Start a new evaluation with metrics collection
 *     tags: [Orchestrator]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agentId
 *               - benchmarkId
 *             properties:
 *               agentId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the agent to evaluate
 *               benchmarkId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the benchmark to run
 *               configuration:
 *                 type: object
 *                 description: Additional configuration for the evaluation
 *     responses:
 *       200:
 *         description: Evaluation started successfully
 *       400:
 *         description: Invalid request or evaluation already running
 */
router.post('/evaluate',
  logApiCall,
  validateRequest({
    body: {
      agentId: { type: 'string', required: true },
      benchmarkId: { type: 'string', required: true },
      configuration: { type: 'object', required: false },
    },
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { agentId, benchmarkId, configuration = {} } = req.body;

    if (orchestrator.isEvaluationRunning()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EVALUATION_RUNNING',
          message: 'Another evaluation is already running',
          timestamp: new Date(),
        },
      });
    }

    try {
      // Initialize orchestrator if needed
      if (!orchestrator) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'ORCHESTRATOR_NOT_INITIALIZED',
            message: 'Orchestrator not available',
            timestamp: new Date(),
          },
        });
      }

      // Start evaluation in background
      const evaluationPromise = orchestrator.executeEvaluation(agentId, benchmarkId, configuration);

      // Handle evaluation completion asynchronously
      evaluationPromise
        .then(result => {
          logger.info('Background evaluation completed', { evaluationId: result.id });
        })
        .catch(error => {
          logger.error('Background evaluation failed', error);
        });

      const currentEval = orchestrator.getCurrentEvaluation();

      const response: ApiResponse = {
        success: true,
        data: {
          evaluationId: currentEval?.id,
          agentId,
          benchmarkId,
          status: 'started',
          configuration,
          startedAt: new Date(),
        },
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] as string,
          version: '1.0.0',
        },
      };

      res.status(202).json(response);

    } catch (error) {
      logger.error('Failed to start evaluation:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'EVALUATION_START_FAILED',
          message: 'Failed to start evaluation',
          timestamp: new Date(),
        },
      });
    }
  })
);

/**
 * @swagger
 * /api/orchestrator/status:
 *   get:
 *     summary: Get current evaluation status
 *     tags: [Orchestrator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current evaluation status
 *       404:
 *         description: No evaluation running
 */
router.get('/status',
  logApiCall,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const currentEvaluation = orchestrator.getCurrentEvaluation();

    if (!currentEvaluation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_EVALUATION_RUNNING',
          message: 'No evaluation is currently running',
          timestamp: new Date(),
        },
      });
    }

    // Get metrics summary
    const metricsSummary = await orchestrator.getMetricsSummary();

    const response: ApiResponse = {
      success: true,
      data: {
        evaluation: currentEvaluation,
        metricsSummary,
        isRunning: orchestrator.isEvaluationRunning(),
      },
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/orchestrator/metrics:
 *   get:
 *     summary: Force metrics collection for current evaluation
 *     tags: [Orchestrator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics collected successfully
 *       404:
 *         description: No evaluation running
 */
router.post('/metrics',
  logApiCall,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    if (!orchestrator.isEvaluationRunning()) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_EVALUATION_RUNNING',
          message: 'No evaluation is currently running',
          timestamp: new Date(),
        },
      });
    }

    try {
      await orchestrator.collectMetrics();

      const metricsSummary = await orchestrator.getMetricsSummary();

      const response: ApiResponse = {
        success: true,
        data: {
          message: 'Metrics collected successfully',
          metricsSummary,
        },
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] as string,
          version: '1.0.0',
        },
      };

      res.json(response);

    } catch (error) {
      logger.error('Failed to collect metrics:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'METRICS_COLLECTION_FAILED',
          message: 'Failed to collect metrics',
          timestamp: new Date(),
        },
      });
    }
  })
);

/**
 * @swagger
 * /api/orchestrator/stop:
 *   post:
 *     summary: Stop the current evaluation (emergency stop)
 *     tags: [Orchestrator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Evaluation stop initiated
 *       404:
 *         description: No evaluation running
 */
router.post('/stop',
  logApiCall,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const currentEvaluation = orchestrator.getCurrentEvaluation();

    if (!currentEvaluation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_EVALUATION_RUNNING',
          message: 'No evaluation is currently running',
          timestamp: new Date(),
        },
      });
    }

    // Note: In a real implementation, you would need to add a proper stop mechanism
    // to the EvaluationOrchestrator. For now, we'll just acknowledge the request.

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Evaluation stop requested',
        evaluationId: currentEvaluation.id,
        warning: 'Proper stop mechanism needs to be implemented in EvaluationOrchestrator',
      },
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/orchestrator/initialize:
 *   post:
 *     summary: Initialize the orchestrator
 *     tags: [Orchestrator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Orchestrator initialized successfully
 *       500:
 *         description: Failed to initialize orchestrator
 */
router.post('/initialize',
  logApiCall,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    try {
      if (!orchestrator) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'ORCHESTRATOR_NOT_AVAILABLE',
            message: 'Orchestrator not available',
            timestamp: new Date(),
          },
        });
      }

      await orchestrator.initialize();

      const response: ApiResponse = {
        success: true,
        data: {
          message: 'Orchestrator initialized successfully',
          initializedAt: new Date(),
        },
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] as string,
          version: '1.0.0',
        },
      };

      res.json(response);

    } catch (error) {
      logger.error('Failed to initialize orchestrator:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'ORCHESTRATOR_INITIALIZATION_FAILED',
          message: 'Failed to initialize orchestrator',
          timestamp: new Date(),
        },
      });
    }
  })
);

export default router;