import { Router, Request, Response } from 'express';
import { EvaluationModel } from '../database/models/Evaluation';
import { AgentModel } from '../database/models/Agent';
import { BenchmarkModel } from '../database/models/Benchmark';
import { logger } from '../utils/logger';
import { validateRequest, ValidationSchema } from '../middleware/validation';

const router = Router();

// Request validation schemas for evaluation routes
const createEvaluationSchema: ValidationSchema = {
  body: {
    agentId: { type: 'uuid', required: true },
    benchmarkId: { type: 'uuid', required: true },
    configuration: { type: 'object', required: false },
    status: { type: 'string', required: false, enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] },
  },
};

const updateStatusSchema: ValidationSchema = {
  body: {
    status: { type: 'string', required: true, enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] },
    startTime: { type: 'string', required: false },
    endTime: { type: 'string', required: false },
  },
};

const addLogSchema: ValidationSchema = {
  body: {
    log: { type: 'string', required: true },
  },
};

const updateMetricsSchema: ValidationSchema = {
  body: {
    performance: { type: 'object', required: false },
    efficiency: { type: 'object', required: false },
    cost: { type: 'object', required: false },
    robustness: { type: 'object', required: false },
    quality: { type: 'object', required: false },
  },
};

// Get all evaluations with filtering
/**
 * @swagger
 * /api/evaluations:
 *   get:
 *     summary: Get evaluations with optional filtering
 *     tags: [Evaluations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: agentId
 *         schema:
 *           type: string
 *         description: Filter by agent ID
 *       - in: query
 *         name: benchmarkId
 *         schema:
 *           type: string
 *         description: Filter by benchmark ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, running, completed, failed, cancelled]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Evaluations retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const agentId = req.query.agentId as string;
    const benchmarkId = req.query.benchmarkId as string;
    const status = req.query.status as string;

    const result = await EvaluationModel.list(page, limit, agentId, benchmarkId, status);

    res.json({
      success: true,
      data: {
        evaluations: result.evaluations,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get evaluations:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get evaluations'
      }
    });
  }
});

// Get evaluation by ID
/**
 * @swagger
 * /api/evaluations/{id}:
 *   get:
 *     summary: Get evaluation by ID
 *     tags: [Evaluations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Evaluation retrieved successfully
 *       404:
 *         description: Evaluation not found
 *       500:
 *         description: Server error
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const evaluation = await EvaluationModel.findById(id);
    if (!evaluation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Evaluation not found'
        }
      });
    }

    res.json({
      success: true,
      data: evaluation
    });

  } catch (error) {
    logger.error('Failed to get evaluation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get evaluation'
      }
    });
  }
});

// Create new evaluation (manual creation)
/**
 * @swagger
 * /api/evaluations:
 *   post:
 *     summary: Create new evaluation
 *     tags: [Evaluations]
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
 *               benchmarkId:
 *                 type: string
 *               configuration:
 *                 type: object
 *               status:
 *                 type: string
 *                 enum: [pending, running, completed, failed, cancelled]
 *                 default: pending
 *     responses:
 *       201:
 *         description: Evaluation created successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/', validateRequest(createEvaluationSchema), async (req: Request, res: Response) => {
  try {
    const { agentId, benchmarkId, configuration, status } = req.body;

    // Validate agent exists
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Agent not found'
        }
      });
    }

    // Validate benchmark exists
    const benchmark = await BenchmarkModel.findById(benchmarkId);
    if (!benchmark) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Benchmark not found'
        }
      });
    }

    const evaluation = await EvaluationModel.create({
      agentId,
      benchmarkId,
      status: status || 'pending',
      configuration: configuration || {},
      logs: [],
      metrics: undefined,
      startTime: new Date(),
      endTime: undefined
    });

    res.status(201).json({
      success: true,
      data: evaluation
    });

  } catch (error) {
    logger.error('Failed to create evaluation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create evaluation'
      }
    });
  }
});

// Update evaluation status
/**
 * @swagger
 * /api/evaluations/{id}/status:
 *   patch:
 *     summary: Update evaluation status
 *     tags: [Evaluations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, running, completed, failed, cancelled]
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       404:
 *         description: Evaluation not found
 *       500:
 *         description: Server error
 */
router.patch('/:id/status', validateRequest(updateStatusSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, startTime, endTime } = req.body;

    const success = await EvaluationModel.updateStatusWithTime(
      id,
      status,
      startTime ? new Date(startTime) : undefined,
      endTime ? new Date(endTime) : undefined
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Evaluation not found'
        }
      });
    }

    res.json({
      success: true,
      message: 'Evaluation status updated successfully'
    });

  } catch (error) {
    logger.error('Failed to update evaluation status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update evaluation status'
      }
    });
  }
});

// Add log to evaluation
/**
 * @swagger
 * /api/evaluations/{id}/logs:
 *   post:
 *     summary: Add log entry to evaluation
 *     tags: [Evaluations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - log
 *             properties:
 *               log:
 *                 type: string
 *     responses:
 *       200:
 *         description: Log added successfully
 *       404:
 *         description: Evaluation not found
 *       500:
 *         description: Server error
 */
router.post('/:id/logs', validateRequest(addLogSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { log } = req.body;

    const success = await EvaluationModel.addLog(id, log);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Evaluation not found'
        }
      });
    }

    res.json({
      success: true,
      message: 'Log added successfully'
    });

  } catch (error) {
    logger.error('Failed to add log to evaluation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to add log to evaluation'
      }
    });
  }
});

// Update evaluation metrics
/**
 * @swagger
 * /api/evaluations/{id}/metrics:
 *   put:
 *     summary: Update evaluation metrics
 *     tags: [Evaluations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               performance:
 *                 type: object
 *                 properties:
 *                   taskSuccessRate:
 *                     type: number
 *                   executionTime:
 *                     type: number
 *                   latencyPerStep:
 *                     type: number
 *                   totalSteps:
 *                     type: integer
 *               efficiency:
 *                 type: object
 *                 properties:
 *                   executionTime:
 *                     type: number
 *                   latencyPerStep:
 *                     type: number
 *                   totalSteps:
 *                     type: integer
 *                   averageTaskTime:
 *                     type: number
 *               cost:
 *                 type: object
 *                 properties:
 *                   totalTokens:
 *                     type: integer
 *                   estimatedCost:
 *                     type: number
 *                   tokenCostPerTask:
 *                     type: number
 *               robustness:
 *                 type: object
 *                 properties:
 *                   toolCallErrorRate:
 *                     type: number
 *                   recoveryRate:
 *                     type: number
 *                   errorCount:
 *                     type: integer
 *                   recoveryCount:
 *                     type: integer
 *               quality:
 *                 type: object
 *                 properties:
 *                   toolSelectionAccuracy:
 *                     type: number
 *                   parameterAccuracy:
 *                     type: number
 *                   outputQualityScore:
 *                     type: number
 *     responses:
 *       200:
 *         description: Metrics updated successfully
 *       404:
 *         description: Evaluation not found
 *       500:
 *         description: Server error
 */
router.put('/:id/metrics', validateRequest(updateMetricsSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const metrics = req.body;

    const success = await EvaluationModel.updateMetrics(id, metrics);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Evaluation not found'
        }
      });
    }

    res.json({
      success: true,
      message: 'Evaluation metrics updated successfully'
    });

  } catch (error) {
    logger.error('Failed to update evaluation metrics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update evaluation metrics'
      }
    });
  }
});

// Delete evaluation
/**
 * @swagger
 * /api/evaluations/{id}:
 *   delete:
 *     summary: Delete evaluation
 *     tags: [Evaluations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Evaluation deleted successfully
 *       404:
 *         description: Evaluation not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const success = await EvaluationModel.delete(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Evaluation not found'
        }
      });
    }

    res.json({
      success: true,
      message: 'Evaluation deleted successfully'
    });

  } catch (error) {
    logger.error('Failed to delete evaluation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete evaluation'
      }
    });
  }
});

export default router;