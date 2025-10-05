import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { MetricsOrchestrator } from '@/services/metrics/MetricsOrchestrator';
import { EvaluationOrchestrator } from '@/orchestrator/EvaluationOrchestrator';
import { db } from '@/database/connection';
import metricsRouter from '@/api/metrics';
import orchestratorRouter from '@/api/orchestrator';

describe('Metrics System Integration Tests', () => {
  let app: express.Application;
  let metricsOrchestrator: MetricsOrchestrator;
  let evaluationOrchestrator: EvaluationOrchestrator;
  let context: any;

  beforeEach(async () => {
    // Setup test context
    context = {
      evaluationId: 'test-eval-123',
      agentId: 'test-agent-456',
      benchmarkId: 'test-benchmark-789',
      sessionId: 'test-session-001',
      startTime: new Date(),
      configuration: { timeout: 30000 },
      environment: {
        platform: 'linux',
        version: '18.0.0',
        resources: { cpu: '4 cores', memory: '8GB', storage: '100GB' }
      }
    };

    // Create orchestrators
    metricsOrchestrator = new MetricsOrchestrator(context);
    evaluationOrchestrator = new EvaluationOrchestrator();

    // Setup Express app
    app = express();
    app.use(express.json());

    // Make orchestrators available to routes
    app.use((req, res, next) => {
      (req as any).metricsOrchestrator = metricsOrchestrator;
      (req as any).orchestrator = evaluationOrchestrator;
      next();
    });

    // Register routes
    app.use('/api/metrics', metricsRouter);
    app.use('/api/orchestrator', orchestratorRouter);

    // Mock console methods
    jest.spyOn(console, 'debug').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Initialize orchestrators
    await metricsOrchestrator.start();
    await evaluationOrchestrator.initialize();
  });

  afterEach(async () => {
    await metricsOrchestrator.cleanup();
    await evaluationOrchestrator.cleanup();
    jest.restoreAllMocks();
  });

  describe('API Endpoints Integration', () => {
    describe('Metrics API', () => {
      it('should return metrics summary', async () => {
        const response = await request(app)
          .get('/api/metrics/summary')
          .expect(200);

        expect(response.body).toBeDefined();
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });

      it('should return metrics for specific evaluation', async () => {
        const response = await request(app)
          .get('/api/metrics/evaluation/test-eval-123')
          .expect(200);

        expect(response.body).toBeDefined();
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.evaluationId).toBe('test-eval-123');
      });

      it('should handle metrics aggregation', async () => {
        const response = await request(app)
          .post('/api/metrics/aggregate')
          .send({
            evaluationIds: ['test-eval-123'],
            metricTypes: ['performance', 'efficiency'],
            timeRange: {
              start: new Date(Date.now() - 3600000).toISOString(),
              end: new Date().toISOString()
            }
          })
          .expect(200);

        expect(response.body).toBeDefined();
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });

      it('should export metrics data', async () => {
        const response = await request(app)
          .post('/api/metrics/export')
          .send({
            format: 'json',
            evaluationIds: ['test-eval-123'],
            includeAggregated: true
          })
          .expect(200);

        expect(response.body).toBeDefined();
        expect(response.body.success).toBe(true);
      });

      it('should return dashboard data', async () => {
        const response = await request(app)
          .get('/api/metrics/dashboard')
          .expect(200);

        expect(response.body).toBeDefined();
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });

      it('should handle metrics health check', async () => {
        const response = await request(app)
          .get('/api/metrics/health')
          .expect(200);

        expect(response.body).toBeDefined();
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.status).toBe('healthy');
      });
    });

    describe('Orchestrator API', () => {
      it('should initialize orchestrator', async () => {
        const response = await request(app)
          .post('/api/orchestrator/initialize')
          .expect(200);

        expect(response.body).toBeDefined();
        expect(response.body.success).toBe(true);
      });

      it('should return orchestrator status', async () => {
        const response = await request(app)
          .get('/api/orchestrator/status')
          .expect(200);

        expect(response.body).toBeDefined();
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });

      it('should collect metrics on demand', async () => {
        const response = await request(app)
          .post('/api/orchestrator/metrics')
          .expect(200);

        expect(response.body).toBeDefined();
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('End-to-End Metrics Flow', () => {
    it('should track metrics through complete evaluation flow', async () => {
      // Start an evaluation
      const startResponse = await request(app)
        .post('/api/orchestrator/evaluate')
        .send({
          agentId: 'test-agent-456',
          benchmarkId: 'test-benchmark-789',
          configuration: { timeout: 5000 }
        })
        .expect(202);

      expect(startResponse.body.success).toBe(true);
      expect(startResponse.body.data.evaluationId).toBeDefined();

      const evaluationId = startResponse.body.data.evaluationId;

      // Wait a moment for metrics collection
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check metrics collection
      const metricsResponse = await request(app)
        .get(`/api/metrics/evaluation/${evaluationId}`)
        .expect(200);

      expect(metricsResponse.body.success).toBe(true);
      expect(metricsResponse.body.data.evaluationId).toBe(evaluationId);

      // Get orchestrator status
      const statusResponse = await request(app)
        .get('/api/orchestrator/status')
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.evaluation).toBeDefined();
    });

    it('should handle real-time metrics updates', async () => {
      // This test would require WebSocket support in a real implementation
      // For now, we'll test the polling mechanism
      let initialMetrics: any;
      let updatedMetrics: any;

      // Get initial metrics
      const initialResponse = await request(app)
        .get('/api/metrics/evaluation/test-eval-123')
        .expect(200);

      initialMetrics = initialResponse.body.data;

      // Force metrics collection
      await request(app)
        .post('/api/orchestrator/metrics')
        .expect(200);

      // Wait and get updated metrics
      await new Promise(resolve => setTimeout(resolve, 100));

      const updatedResponse = await request(app)
        .get('/api/metrics/evaluation/test-eval-123')
        .expect(200);

      updatedMetrics = updatedResponse.body.data;

      expect(initialMetrics).toBeDefined();
      expect(updatedMetrics).toBeDefined();
    });
  });

  describe('Database Integration', () => {
    it('should store metrics in database', async () => {
      // Mock database operations
      const mockQuery = jest.fn().mockResolvedValue({
        rows: [{
          id: 'test-metrics-id',
          evaluation_id: 'test-eval-123',
          metrics: JSON.stringify({
            performance: { taskSuccessRate: 0.85 },
            efficiency: { executionTime: 2500 }
          }),
          created_at: new Date()
        }]
      });

      jest.spyOn(db, 'query').mockImplementation(mockQuery);

      const response = await request(app)
        .get('/api/metrics/evaluation/test-eval-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockQuery).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      jest.spyOn(db, 'query').mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/metrics/evaluation/test-eval-123')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should validate metrics before storage', async () => {
      // Test validation of metrics data
      const invalidMetrics = {
        performance: {
          taskSuccessRate: 1.5, // Invalid value > 1
          executionTime: -1000 // Invalid negative value
        }
      };

      const response = await request(app)
        .post('/api/metrics/validate')
        .send(invalidMetrics)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent metrics requests', async () => {
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/metrics/evaluation/test-eval-123')
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should handle large metrics datasets', async () => {
      // Mock large dataset
      const largeMetrics = {
        evaluationId: 'test-eval-123',
        performance: {
          taskSuccessRate: 0.85,
          tasksCompleted: 1000,
          taskResults: Array.from({ length: 1000 }, (_, i) => ({
            taskId: `task-${i}`,
            success: i % 10 !== 0, // 90% success rate
            duration: Math.random() * 1000,
            accuracy: 0.8 + Math.random() * 0.2
          }))
        }
      };

      const response = await request(app)
        .post('/api/metrics/batch')
        .send({ metrics: largeMetrics })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing evaluation ID', async () => {
      const response = await request(app)
        .get('/api/metrics/evaluation/')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should handle invalid aggregation parameters', async () => {
      const response = await request(app)
        .post('/api/metrics/aggregate')
        .send({
          evaluationIds: [], // Empty array
          metricTypes: ['invalid-type'], // Invalid metric type
          timeRange: {
            start: 'invalid-date',
            end: 'invalid-date'
          }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should handle export format errors', async () => {
      const response = await request(app)
        .post('/api/metrics/export')
        .send({
          format: 'invalid-format',
          evaluationIds: ['test-eval-123']
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should handle orchestrator errors', async () => {
      // Mock orchestrator error
      jest.spyOn(evaluationOrchestrator, 'getCurrentEvaluation').mockReturnValue(null);

      const response = await request(app)
        .get('/api/orchestrator/status')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Security Tests', () => {
    it('should sanitize input parameters', async () => {
      const maliciousInput = {
        evaluationId: '<script>alert("xss")</script>',
        benchmarkId: "'; DROP TABLE evaluations; --"
      };

      const response = await request(app)
        .post('/api/orchestrator/evaluate')
        .send(maliciousInput)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate request body size', async () => {
      const largePayload = {
        agentId: 'a'.repeat(10000),
        benchmarkId: 'b'.repeat(10000),
        configuration: {
          [Array.from({ length: 100 }, (_, i) => `key${i}`)]: 'x'.repeat(1000)
        }
      };

      const response = await request(app)
        .post('/api/orchestrator/evaluate')
        .send(largePayload)
        .expect(413); // Payload Too Large

      expect(response.body.success).toBe(false);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle simultaneous evaluations', async () => {
      const evaluations = Array.from({ length: 3 }, (_, i) =>
        request(app)
          .post('/api/orchestrator/evaluate')
          .send({
            agentId: `test-agent-${i}`,
            benchmarkId: 'test-benchmark-789',
            configuration: { timeout: 1000 }
          })
      );

      const responses = await Promise.all(evaluations);

      // First evaluation should succeed
      expect(responses[0].status).toBe(202);
      expect(responses[0].body.success).toBe(true);

      // Subsequent evaluations should be rejected (only one at a time)
      expect(responses[1].status).toBe(400);
      expect(responses[1].body.success).toBe(false);
      expect(responses[2].status).toBe(400);
      expect(responses[2].body.success).toBe(false);
    });

    it('should handle concurrent metrics collection', async () => {
      const metricsRequests = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/orchestrator/metrics')
      );

      const responses = await Promise.all(metricsRequests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Metrics Consistency', () => {
    it('should maintain metrics consistency across requests', async () => {
      // Get initial metrics
      const initialResponse = await request(app)
        .get('/api/metrics/evaluation/test-eval-123')
        .expect(200);

      // Force collection
      await request(app)
        .post('/api/orchestrator/metrics')
        .expect(200);

      // Get metrics again
      const updatedResponse = await request(app)
        .get('/api/metrics/evaluation/test-eval-123')
        .expect(200);

      const initialMetrics = initialResponse.body.data;
      const updatedMetrics = updatedResponse.body.data;

      // Basic consistency checks
      expect(initialMetrics.evaluationId).toBe(updatedMetrics.evaluationId);
      expect(initialMetrics.agentId).toBe(updatedMetrics.agentId);
      expect(initialMetrics.benchmarkId).toBe(updatedMetrics.benchmarkId);
      expect(initialMetrics.sessionId).toBe(updatedMetrics.sessionId);
    });

    it('should handle metrics aggregation correctly', async () => {
      // Create multiple evaluation metrics
      const evaluationIds = ['eval-1', 'eval-2', 'eval-3'];

      const response = await request(app)
        .post('/api/metrics/aggregate')
        .send({
          evaluationIds,
          metricTypes: ['performance', 'efficiency', 'cost'],
          timeRange: {
            start: new Date(Date.now() - 3600000).toISOString(),
            end: new Date().toISOString()
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.aggregations).toBeDefined();
    });
  });
});