import express from 'express';
import { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { validateRequest, extractPagination, commonSchemas } from '@/middleware/validation';
import { ValidationError } from '@/middleware/errorHandler';
import { mockRequest, mockResponse } from '../../helpers/mocks';

describe('Validation Middleware', () => {
  let app: express.Application;
  let mockRes: Response;
  let nextFn: NextFunction;

  beforeEach(() => {
    app = express();
    mockRes = mockResponse();
    nextFn = jest.fn();
  });

  describe('validateRequest', () => {
    it('should pass valid request data', () => {
      const schema = {
        body: {
          name: { type: 'string', required: true },
          email: { type: 'string', required: true },
        },
      };

      const middleware = validateRequest(schema);
      const mockReq = mockRequest({
        body: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      });

      expect(() => middleware(mockReq as any, mockRes, nextFn)).not.toThrow();
      expect(nextFn).toHaveBeenCalledWith();
    });

    it('should reject invalid request data', () => {
      const schema = {
        body: {
          name: { type: 'string', required: true },
          email: { type: 'string', required: true },
        },
      };

      const middleware = validateRequest(schema);
      const mockReq = mockRequest({
        body: {
          // Missing required fields
        },
      });

      expect(() => middleware(mockReq as any, mockRes, nextFn)).toThrow(ValidationError);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should validate query parameters', () => {
      const schema = {
        query: {
          page: { type: 'number', min: 1 },
          limit: { type: 'number', max: 100 },
        },
      };

      const middleware = validateRequest(schema);
      const mockReq = mockRequest({
        query: {
          page: 1,
          limit: 10,
        },
      });

      expect(() => middleware(mockReq as any, mockRes, nextFn)).not.toThrow();
      expect(nextFn).toHaveBeenCalled();
    });

    it('should validate route parameters', () => {
      const schema = {
        params: {
          id: { type: 'string', required: true },
        },
      };

      const middleware = validateRequest(schema);
      const mockReq = mockRequest({
        params: {
          id: '123',
        },
      });

      expect(() => middleware(mockReq as any, mockRes, nextFn)).not.toThrow();
      expect(nextFn).toHaveBeenCalled();
    });

    it('should validate email format', () => {
      const schema = {
        body: {
          email: { type: 'email', required: true },
        },
      };

      const middleware = validateRequest(schema);
      const mockReq = mockRequest({
        body: {
          email: 'invalid-email',
        },
      });

      expect(() => middleware(mockReq as any, mockRes, nextFn)).toThrow(ValidationError);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should validate UUID format', () => {
      const schema = {
        params: {
          id: { type: 'uuid', required: true },
        },
      };

      const middleware = validateRequest(schema);
      const mockReq = mockRequest({
        params: {
          id: 'invalid-uuid',
        },
      });

      expect(() => middleware(mockReq as any, mockRes, nextFn)).toThrow(ValidationError);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should validate string length constraints', () => {
      const schema = {
        body: {
          name: { type: 'string', required: true, min: 3, max: 10 },
        },
      };

      const middleware = validateRequest(schema);
      const mockReq = mockRequest({
        body: {
          name: 'ab', // Too short
        },
      });

      expect(() => middleware(mockReq as any, mockRes, nextFn)).toThrow(ValidationError);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should validate number constraints', () => {
      const schema = {
        body: {
          age: { type: 'number', min: 18, max: 100 },
        },
      };

      const middleware = validateRequest(schema);
      const mockReq = mockRequest({
        body: {
          age: 15, // Too young
        },
      });

      expect(() => middleware(mockReq as any, mockRes, nextFn)).toThrow(ValidationError);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should validate enum values', () => {
      const schema = {
        body: {
          status: { type: 'string', enum: ['active', 'inactive'] },
        },
      };

      const middleware = validateRequest(schema);
      const mockReq = mockRequest({
        body: {
          status: 'pending', // Invalid enum value
        },
      });

      expect(() => middleware(mockReq as any, mockRes, nextFn)).toThrow(ValidationError);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should validate array constraints', () => {
      const schema = {
        body: {
          tags: { type: 'array', max: 3 },
        },
      };

      const middleware = validateRequest(schema);
      const mockReq = mockRequest({
        body: {
          tags: ['tag1', 'tag2', 'tag3', 'tag4'], // Too many tags
        },
      });

      expect(() => middleware(mockReq as any, mockRes, nextFn)).toThrow(ValidationError);
      expect(nextFn).not.toHaveBeenCalled();
    });
  });

  describe('extractPagination', () => {
    it('should extract pagination from query parameters', () => {
      const mockReq = mockRequest({
        query: {
          page: '2',
          limit: '10',
        },
      });

      extractPagination(mockReq as any, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.pagination).toEqual({
        page: 2,
        limit: 10,
        sortBy: undefined,
        sortOrder: 'desc',
      });
    });

    it('should apply default pagination values', () => {
      const mockReq = mockRequest({
        query: {},
      });

      extractPagination(mockReq as any, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.pagination).toEqual({
        page: 1,
        limit: 20,
        sortBy: undefined,
        sortOrder: 'desc',
      });
    });

    it('should validate page parameter', () => {
      const mockReq = mockRequest({
        query: {
          page: '0', // Invalid: must be >= 1
        },
      });

      extractPagination(mockReq as any, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.pagination.page).toBe(1); // Should use default
    });

    it('should validate limit parameter', () => {
      const mockReq = mockRequest({
        query: {
          limit: '200', // Invalid: max 100, should be clamped to 100
        },
      });

      extractPagination(mockReq as any, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.pagination.limit).toBe(100); // Should be clamped to max value
    });

    it('should handle string to number conversion', () => {
      const mockReq = mockRequest({
        query: {
          page: '5',
          limit: '15',
        },
      });

      extractPagination(mockReq as any, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.pagination.page).toBe(5);
      expect(mockReq.pagination.limit).toBe(15);
      expect(typeof mockReq.pagination.page).toBe('number');
      expect(typeof mockReq.pagination.limit).toBe('number');
    });

    it('should handle sort order validation', () => {
      const mockReq = mockRequest({
        query: {
          sortOrder: 'asc',
        },
      });

      extractPagination(mockReq as any, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.pagination.sortOrder).toBe('asc');
    });

    it('should default sort order to desc for invalid values', () => {
      const mockReq = mockRequest({
        query: {
          sortOrder: 'invalid',
        },
      });

      extractPagination(mockReq as any, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.pagination.sortOrder).toBe('desc');
    });
  });

  describe('commonSchemas', () => {
    describe('pagination schema', () => {
      it('should validate pagination parameters', () => {
        const middleware = validateRequest(commonSchemas.pagination);
        const mockReq = mockRequest({
          query: {
            page: 1,
            limit: 10,
            sortBy: 'name',
            sortOrder: 'asc',
          },
        });

        expect(() => middleware(mockReq as any, mockRes, nextFn)).not.toThrow();
        expect(nextFn).toHaveBeenCalled();
      });

      it('should reject invalid sort order', () => {
        const middleware = validateRequest(commonSchemas.pagination);
        const mockReq = mockRequest({
          query: {
            page: 1,
            limit: 10,
            sortOrder: 'invalid',
          },
        });

        expect(() => middleware(mockReq as any, mockRes, nextFn)).toThrow(ValidationError);
        expect(nextFn).not.toHaveBeenCalled();
      });
    });

    describe('search schema', () => {
      it('should validate search query', () => {
        const middleware = validateRequest(commonSchemas.search);
        const mockReq = mockRequest({
          query: {
            q: 'search term',
            page: 1,
            limit: 10,
          },
        });

        expect(() => middleware(mockReq as any, mockRes, nextFn)).not.toThrow();
        expect(nextFn).toHaveBeenCalled();
      });

      it('should require search query parameter', () => {
        const middleware = validateRequest(commonSchemas.search);
        const mockReq = mockRequest({
          query: {
            page: 1,
            limit: 10,
          },
        });

        expect(() => middleware(mockReq as any, mockRes, nextFn)).toThrow(ValidationError);
        expect(nextFn).not.toHaveBeenCalled();
      });
    });

    describe('ID schema', () => {
      it('should validate UUID parameter', () => {
        const middleware = validateRequest(commonSchemas.id);
        const mockReq = mockRequest({
          params: {
            id: '123e4567-e89b-12d3-a456-426614174000',
          },
        });

        expect(() => middleware(mockReq as any, mockRes, nextFn)).not.toThrow();
        expect(nextFn).toHaveBeenCalled();
      });

      it('should reject invalid UUID', () => {
        const middleware = validateRequest(commonSchemas.id);
        const mockReq = mockRequest({
          params: {
            id: 'invalid-uuid',
          },
        });

        expect(() => middleware(mockReq as any, mockRes, nextFn)).toThrow(ValidationError);
        expect(nextFn).not.toHaveBeenCalled();
      });
    });

    describe('agentCreate schema', () => {
      it('should validate agent creation data', () => {
        const middleware = validateRequest(commonSchemas.agentCreate);
        const mockReq = mockRequest({
          body: {
            name: 'Test Agent',
            type: 'swe',
            description: 'A test agent',
            capabilities: ['code-generation', 'debugging'],
            configuration: { language: 'typescript' },
          },
        });

        expect(() => middleware(mockReq as any, mockRes, nextFn)).not.toThrow();
        expect(nextFn).toHaveBeenCalled();
      });

      it('should require agent name and type', () => {
        const middleware = validateRequest(commonSchemas.agentCreate);
        const mockReq = mockRequest({
          body: {
            description: 'Missing required fields',
          },
        });

        expect(() => middleware(mockReq as any, mockRes, nextFn)).toThrow(ValidationError);
        expect(nextFn).not.toHaveBeenCalled();
      });

      it('should validate agent type enum', () => {
        const middleware = validateRequest(commonSchemas.agentCreate);
        const mockReq = mockRequest({
          body: {
            name: 'Test Agent',
            type: 'invalid-type',
          },
        });

        expect(() => middleware(mockReq as any, mockRes, nextFn)).toThrow(ValidationError);
        expect(nextFn).not.toHaveBeenCalled();
      });
    });

    describe('userCreate schema', () => {
      it('should validate user creation data', () => {
        const middleware = validateRequest(commonSchemas.userCreate);
        const mockReq = mockRequest({
          body: {
            email: 'test@example.com',
            username: 'testuser',
            fullName: 'Test User',
            password: 'SecurePass123!',
            role: 'user',
          },
        });

        expect(() => middleware(mockReq as any, mockRes, nextFn)).not.toThrow();
        expect(nextFn).toHaveBeenCalled();
      });

      it('should require email and username', () => {
        const middleware = validateRequest(commonSchemas.userCreate);
        const mockReq = mockRequest({
          body: {
            fullName: 'Test User',
          },
        });

        expect(() => middleware(mockReq as any, mockRes, nextFn)).toThrow(ValidationError);
        expect(nextFn).not.toHaveBeenCalled();
      });
    });

    describe('benchmarkCreate schema', () => {
      it('should validate benchmark creation data', () => {
        const middleware = validateRequest(commonSchemas.benchmarkCreate);
        const mockReq = mockRequest({
          body: {
            name: 'Test Benchmark',
            type: 'swe-bench',
            dataset: 'test-dataset',
          },
        });

        expect(() => middleware(mockReq as any, mockRes, nextFn)).not.toThrow();
        expect(nextFn).toHaveBeenCalled();
      });

      it('should require benchmark name and type', () => {
        const middleware = validateRequest(commonSchemas.benchmarkCreate);
        const mockReq = mockRequest({
          body: {
            description: 'Missing required fields',
          },
        });

        expect(() => middleware(mockReq as any, mockRes, nextFn)).toThrow(ValidationError);
        expect(nextFn).not.toHaveBeenCalled();
      });
    });
  });

  describe('Integration Tests', () => {
    it('should work with Express router', async () => {
      const router = express.Router();

      // Error handling middleware for ValidationError
      router.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (err instanceof ValidationError) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: err.message,
              details: err.details
            }
          });
        }
        next(err);
      });

      router.get('/test',
        validateRequest({
          query: {
            search: { type: 'string', required: true },
          },
        }),
        extractPagination,
        (req, res) => {
          res.json({
            success: true,
            data: {
              query: req.query,
              pagination: req.pagination,
            },
          });
        }
      );

      app.use('/api', router);

      const response = await request(app)
        .get('/api/test?search=test&page=1&limit=5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.query.search).toBe('test');
      expect(response.body.data.pagination).toEqual({
        page: 1,
        limit: 5,
        sortBy: undefined,
        sortOrder: 'desc',
      });
    });

    it('should handle validation errors in Express', async () => {
      const router = express.Router();

      router.get('/test',
        validateRequest({
          query: {
            search: { type: 'string', required: true },
          },
        }),
        (req, res) => {
          res.json({ success: true });
        }
      );

      // Error handling middleware must be added after the routes
      router.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (err instanceof ValidationError) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: err.message,
              details: err.details
            }
          });
        }
        next(err);
      });

      app.use('/api', router);

      const response = await request(app)
        .get('/api/test') // Missing required search parameter
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});