import express from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest, extractPagination, commonSchemas, ValidationSchema, ValidationRule } from '../middleware/validation';
import { AgentModel } from '../database/models/Agent';
import { logApiCall } from '../middleware/requestLogger';
import { requireRole } from '../middleware/auth';
import { ApiResponse } from '../types/index';

const router = express.Router();

/**
 * @swagger
 * /api/agents:
 *   get:
 *     summary: Get all agents
 *     tags: [Agents]
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
 *           enum: [swe, gui, general, orchestrator]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, training, error]
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
 *         description: List of agents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Agent'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/',
  logApiCall,
  extractPagination,
  validateRequest(commonSchemas.pagination),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { type, status } = req.query;
    const pagination = req.pagination!;

    const result = await AgentModel.list(
      pagination.page,
      pagination.limit,
      type as string,
      status as string
    );

    const response: ApiResponse = {
      success: true,
      data: result.agents,
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    // Add pagination metadata
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
 * /api/agents/search:
 *   get:
 *     summary: Search agents by name or description
 *     tags: [Agents]
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
  validateRequest(commonSchemas.search as ValidationSchema),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { q } = req.query;
    const pagination = req.pagination!;

    const result = await AgentModel.search(
      q as string,
      pagination.page,
      pagination.limit
    );

    const response: ApiResponse = {
      success: true,
      data: result.agents,
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
 * /api/agents/types:
 *   get:
 *     summary: Get available agent types
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of agent types
 */
router.get('/types',
  logApiCall,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const types = ['swe', 'gui', 'general', 'orchestrator'];

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
 * /api/agents/{id}:
 *   get:
 *     summary: Get agent by ID
 *     tags: [Agents]
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
 *         description: Agent details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Agent'
 *       404:
 *         description: Agent not found
 */
/**
 * @swagger
 * /api/agents/active:
 *   get:
 *     summary: Get all active agents
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active agents
 */
router.get('/active',
  logApiCall,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const agents = await AgentModel.getActiveAgents();

    const response: ApiResponse = {
      success: true,
      data: agents,
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    res.json(response);
  })
);

router.get('/:id',
  logApiCall,
  validateRequest(commonSchemas.id as ValidationSchema),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const agent = await AgentModel.findById(id);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Agent not found',
          timestamp: new Date(),
        },
      });
    }

    const response: ApiResponse = {
      success: true,
      data: agent,
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
 * /api/agents:
 *   post:
 *     summary: Create a new agent
 *     tags: [Agents]
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
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               type:
 *                 type: string
 *                 enum: [swe, gui, general, orchestrator]
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               capabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 50
 *               configuration:
 *                 type: object
 *     responses:
 *       201:
 *         description: Agent created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Agent already exists
 */
router.post('/',
  logApiCall,
  validateRequest(commonSchemas.agentCreate as ValidationSchema),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const agentData = {
      ...req.body,
      status: 'inactive' as const,
    };

    const agent = await AgentModel.create(agentData);

    const response: ApiResponse = {
      success: true,
      data: agent,
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
 * /api/agents/{id}:
 *   put:
 *     summary: Update an existing agent
 *     tags: [Agents]
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
 *                 enum: [swe, gui, general, orchestrator]
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               capabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 50
 *               configuration:
 *                 type: object
 *               status:
 *                 type: string
 *                 enum: [active, inactive, training, error]
 *     responses:
 *       200:
 *         description: Agent updated successfully
 *       404:
 *         description: Agent not found
 */
router.put('/:id',
  logApiCall,
  validateRequest({
    params: commonSchemas.id.params as Record<string, ValidationRule>,
    body: {
      name: { type: 'string', min: 1, max: 255, required: false },
      type: { type: 'string', enum: ['swe', 'gui', 'general', 'orchestrator'], required: false },
      description: { type: 'string', max: 1000, required: false },
      capabilities: { type: 'array', max: 50, required: false },
      configuration: { type: 'object', required: false },
      status: { type: 'string', enum: ['active', 'inactive', 'training', 'error'], required: false },
    },
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const agent = await AgentModel.update(id, req.body);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Agent not found',
          timestamp: new Date(),
        },
      });
    }

    const response: ApiResponse = {
      success: true,
      data: agent,
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
 * /api/agents/{id}/status:
 *   patch:
 *     summary: Update agent status
 *     tags: [Agents]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive, training, error]
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       404:
 *         description: Agent not found
 */
router.patch('/:id/status',
  logApiCall,
  validateRequest({
    params: commonSchemas.id.params as Record<string, ValidationRule>,
    body: {
      status: { type: 'string', enum: ['active', 'inactive', 'training', 'error'], required: true },
    },
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const { status } = req.body;

    const success = await AgentModel.updateStatus(id, status);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Agent not found',
          timestamp: new Date(),
        },
      });
    }

    const response: ApiResponse = {
      success: true,
      data: { id, status },
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
 * /api/agents/{id}:
 *   delete:
 *     summary: Delete an agent
 *     tags: [Agents]
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
 *         description: Agent deleted successfully
 *       404:
 *         description: Agent not found
 */
router.delete('/:id',
  logApiCall,
  requireRole('admin'),
  validateRequest(commonSchemas.id as ValidationSchema),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const success = await AgentModel.delete(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Agent not found',
          timestamp: new Date(),
        },
      });
    }

    res.status(204).send();
  })
);

export default router;