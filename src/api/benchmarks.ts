import express from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest, extractPagination, commonSchemas } from '../middleware/validation';
import { BenchmarkModel } from '../database/models/Benchmark';
import { logApiCall } from '../middleware/requestLogger';
import { ApiResponse } from '../types/index';

const router = express.Router();

/**
 * @swagger
 * /api/benchmarks:
 *   get:
 *     summary: Get all benchmarks
 *     tags: [Benchmarks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [swe-bench, gaia, osworld, webarena, agentbench, custom]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of benchmarks
 */
router.get('/',
  logApiCall,
  extractPagination,
  validateRequest(commonSchemas.pagination),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { type, isActive } = req.query;
    const pagination = req.pagination!;

    const result = await BenchmarkModel.list(
      pagination.page,
      pagination.limit,
      type as string,
      isActive !== undefined ? isActive === 'true' : undefined
    );

    const response: ApiResponse = {
      success: true,
      data: result.benchmarks,
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    (response as any).pagination = {
      page: pagination.page,
      limit: pagination.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / pagination.limit),
      hasNext: pagination.page * pagination.limit < result.total,
      hasPrev: pagination.page > 1,
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/benchmarks/active:
 *   get:
 *     summary: Get all active benchmarks
 *     tags: [Benchmarks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active benchmarks
 */
router.get('/active',
  logApiCall,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const benchmarks = await BenchmarkModel.getActive();

    const response: ApiResponse = {
      success: true,
      data: benchmarks,
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
 * /api/benchmarks/types:
 *   get:
 *     summary: Get available benchmark types
 *     tags: [Benchmarks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of benchmark types
 */
router.get('/types',
  logApiCall,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const types = await BenchmarkModel.getTypes();

    const response: ApiResponse = {
      success: true,
      data: types,
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
 * /api/benchmarks/datasets:
 *   get:
 *     summary: Get available datasets
 *     tags: [Benchmarks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of datasets
 */
router.get('/datasets',
  logApiCall,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const datasets = await BenchmarkModel.getDatasets();

    const response: ApiResponse = {
      success: true,
      data: datasets,
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
 * /api/benchmarks/search:
 *   get:
 *     summary: Search benchmarks by name, description, or dataset
 *     tags: [Benchmarks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search',
  logApiCall,
  validateRequest(commonSchemas.search),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { q } = req.query;
    const pagination = req.pagination!;

    const result = await BenchmarkModel.search(
      q as string,
      pagination.page,
      pagination.limit
    );

    const response: ApiResponse = {
      success: true,
      data: result.benchmarks,
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    (response as any).pagination = {
      page: pagination.page,
      limit: pagination.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / pagination.limit),
      hasNext: pagination.page * pagination.limit < result.total,
      hasPrev: pagination.page > 1,
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/benchmarks/{id}:
 *   get:
 *     summary: Get benchmark by ID
 *     tags: [Benchmarks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Benchmark details
 *       404:
 *         description: Benchmark not found
 */
router.get('/:id',
  logApiCall,
  validateRequest(commonSchemas.id),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const benchmark = await BenchmarkModel.findById(id);

    if (!benchmark) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Benchmark not found',
          timestamp: new Date(),
        },
      });
    }

    const response: ApiResponse = {
      success: true,
      data: benchmark,
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
 * /api/benchmarks:
 *   post:
 *     summary: Create a new benchmark
 *     tags: [Benchmarks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - dataset
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               type:
 *                 type: string
 *                 enum: [swe-bench, gaia, osworld, webarena, agentbench, custom]
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               dataset:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               evaluationCriteria:
 *                 type: array
 *                 items:
 *                   type: string
 *               configuration:
 *                 type: object
 *     responses:
 *       201:
 *         description: Benchmark created successfully
 *       400:
 *         description: Validation error
 */
router.post('/',
  logApiCall,
  validateRequest(commonSchemas.benchmarkCreate),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const benchmarkData = {
      ...req.body,
      isActive: true,
    };

    const benchmark = await BenchmarkModel.create(benchmarkData);

    const response: ApiResponse = {
      success: true,
      data: benchmark,
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    res.status(201).json(response);
  })
);

/**
 * @swagger
 * /api/benchmarks/{id}:
 *   put:
 *     summary: Update an existing benchmark
 *     tags: [Benchmarks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               type:
 *                 type: string
 *                 enum: [swe-bench, gaia, osworld, webarena, agentbench, custom]
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               dataset:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               evaluationCriteria:
 *                 type: array
 *                 items:
 *                   type: string
 *               configuration:
 *                 type: object
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Benchmark updated successfully
 *       404:
 *         description: Benchmark not found
 */
router.put('/:id',
  logApiCall,
  validateRequest({
    params: commonSchemas.id.params,
    body: {
      name: { type: 'string', min: 1, max: 255, required: false },
      type: { type: 'string', enum: ['swe-bench', 'gaia', 'osworld', 'webarena', 'agentbench', 'custom'], required: false },
      description: { type: 'string', max: 1000, required: false },
      dataset: { type: 'string', min: 1, max: 255, required: false },
      evaluationCriteria: { type: 'array', required: false },
      configuration: { type: 'object', required: false },
      isActive: { type: 'boolean', required: false },
    },
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const benchmark = await BenchmarkModel.update(id, req.body);

    if (!benchmark) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Benchmark not found',
          timestamp: new Date(),
        },
      });
    }

    const response: ApiResponse = {
      success: true,
      data: benchmark,
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
 * /api/benchmarks/{id}/activate:
 *   patch:
 *     summary: Activate or deactivate a benchmark
 *     tags: [Benchmarks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       404:
 *         description: Benchmark not found
 */
router.patch('/:id/activate',
  logApiCall,
  validateRequest({
    params: commonSchemas.id.params,
    body: {
      isActive: { type: 'boolean', required: true },
    },
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const { isActive } = req.body;

    const success = await BenchmarkModel.setActive(id, isActive);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Benchmark not found',
          timestamp: new Date(),
        },
      });
    }

    const response: ApiResponse = {
      success: true,
      data: { id, isActive },
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
 * /api/benchmarks/{id}:
 *   delete:
 *     summary: Delete a benchmark
 *     tags: [Benchmarks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Benchmark deleted successfully
 *       404:
 *         description: Benchmark not found
 */
router.delete('/:id',
  logApiCall,
  validateRequest(commonSchemas.id),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const success = await BenchmarkModel.delete(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Benchmark not found',
          timestamp: new Date(),
        },
      });
    }

    res.status(204).send();
  })
);

export default router;