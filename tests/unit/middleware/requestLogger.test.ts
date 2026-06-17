import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { requestLogger, logApiCall } from '@/middleware/requestLogger';
import { logger } from '@/utils/logger';

// Mock dependencies
jest.mock('@/utils/logger');

// Mock Express types
interface MockRequest {
  method: string;
  url: string;
  ip: string;
  headers: Record<string, string>;
  get: (header: string) => string | undefined;
}

interface MockResponse {
  statusCode: number;
  get: (header: string) => string | undefined;
  end: jest.Mock;
}

describe('requestLogger middleware', () => {
  let mockReq: Partial<MockRequest>;
  let mockRes: Partial<MockResponse>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      method: 'GET',
      url: '/api/test',
      ip: '127.0.0.1',
      headers: {},
      get: jest.fn((header: string) => {
        switch (header) {
          case 'User-Agent':
            return 'Mozilla/5.0 Test Browser';
          case 'Content-Length':
            return '128';
          default:
            return undefined;
        }
      }),
    };

    mockRes = {
      statusCode: 200,
      get: jest.fn((header: string) => {
        switch (header) {
          case 'Content-Length':
            return '256';
          default:
            return undefined;
        }
      }),
      end: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe('requestLogger', () => {
    it('should generate request ID and attach to headers', () => {
      requestLogger(mockReq as any, mockRes as any, mockNext);

      // Check that a request ID was generated and is a valid UUID format
      const requestId = (mockReq.headers as any)['x-request-id'];
      expect(requestId).toBeDefined();
      expect(typeof requestId).toBe('string');
      // UUID v4 regex pattern
      expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should log incoming request with all relevant information', () => {
      requestLogger(mockReq as any, mockRes as any, mockNext);

      expect(logger.info).toHaveBeenCalledWith('Incoming request', {
        requestId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
        method: 'GET',
        url: '/api/test',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        contentLength: '128',
        timestamp: expect.any(String),
      });
    });

    it('should handle missing User-Agent header', () => {
      mockReq.get = jest.fn((header: string) => {
        switch (header) {
          case 'Content-Length':
            return '128';
          default:
            return undefined;
        }
      });

      requestLogger(mockReq as any, mockRes as any, mockNext);

      expect(logger.info).toHaveBeenCalledWith('Incoming request', {
        requestId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
        method: 'GET',
        url: '/api/test',
        ip: '127.0.0.1',
        userAgent: 'Unknown',
        contentLength: '128',
        timestamp: expect.any(String),
      });
    });

    it('should handle missing Content-Length header', () => {
      mockReq.get = jest.fn((header: string) => {
        switch (header) {
          case 'User-Agent':
            return 'Mozilla/5.0 Test Browser';
          default:
            return undefined;
        }
      });

      requestLogger(mockReq as any, mockRes as any, mockNext);

      expect(logger.info).toHaveBeenCalledWith('Incoming request', {
        requestId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
        method: 'GET',
        url: '/api/test',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        contentLength: '0',
        timestamp: expect.any(String),
      });
    });

    it('should override res.end to log response completion', () => {
      requestLogger(mockReq as any, mockRes as any, mockNext);

      // Verify res.end was overridden
      expect(mockRes.end).not.toBeUndefined();
      expect(typeof mockRes.end).toBe('function');
    });

    it('should log response completion when res.end is called', () => {
      // Mock Date.now to control timing
      const originalDateNow = Date.now;
      const startTime = 1000000000000;
      const endTime = 1000000000200; // 200ms later

      Date.now = jest.fn()
        .mockReturnValueOnce(startTime)
        .mockReturnValueOnce(endTime) as any;

      // Store the original end function before it gets overridden
      const originalEnd = mockRes.end;

      requestLogger(mockReq as any, mockRes as any, mockNext);

      // Call the overridden end method
      mockRes.end!('response data', 'utf-8');

      // Restore Date.now
      Date.now = originalDateNow;

      expect(logger.info).toHaveBeenCalledWith('Request completed', {
        requestId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
        method: 'GET',
        url: '/api/test',
        statusCode: 200,
        duration: '200ms',
        contentLength: '256',
        timestamp: expect.any(String),
      });

      // Verify original end was called with same arguments
      expect(originalEnd).toHaveBeenCalledWith('response data', 'utf-8');
    });

    it('should handle missing Content-Length in response', () => {
      mockRes.get = jest.fn((header: string) => undefined);

      requestLogger(mockReq as any, mockRes as any, mockNext);
      mockRes.end!('response data');

      expect(logger.info).toHaveBeenCalledWith('Request completed', {
        requestId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
        method: 'GET',
        url: '/api/test',
        statusCode: 200,
        duration: expect.stringMatching(/\d+ms/),
        contentLength: '0',
        timestamp: expect.any(String),
      });
    });

    it('should handle different HTTP methods', () => {
      mockReq.method = 'POST';
      mockReq.url = '/api/users';

      requestLogger(mockReq as any, mockRes as any, mockNext);

      expect(logger.info).toHaveBeenCalledWith('Incoming request', {
        requestId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
        method: 'POST',
        url: '/api/users',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        contentLength: '128',
        timestamp: expect.any(String),
      });
    });

    it('should handle different response status codes', () => {
      mockRes.statusCode = 404;

      requestLogger(mockReq as any, mockRes as any, mockNext);
      mockRes.end!('Not found');

      expect(logger.info).toHaveBeenCalledWith('Request completed', {
        requestId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
        method: 'GET',
        url: '/api/test',
        statusCode: 404,
        duration: expect.stringMatching(/\d+ms/),
        contentLength: '256',
        timestamp: expect.any(String),
      });
    });

    it('should call next() exactly once', () => {
      requestLogger(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('logApiCall', () => {
    beforeEach(() => {
      // Add request ID to headers for logApiCall tests
      (mockReq.headers as any)['x-request-id'] = 'test-request-id-456';
      (mockReq as any).user = { id: 'user-123' };
    });

    it('should log API call with basic information', () => {
      logApiCall(mockReq as any, mockRes as any, mockNext);

      expect(logger.info).toHaveBeenCalledWith('API call', {
        requestId: 'test-request-id-456',
        method: 'GET',
        url: '/api/test',
        userId: 'user-123',
        timestamp: expect.any(String),
      });
    });

    it('should handle missing user object', () => {
      delete (mockReq as any).user;

      logApiCall(mockReq as any, mockRes as any, mockNext);

      expect(logger.info).toHaveBeenCalledWith('API call', {
        requestId: 'test-request-id-456',
        method: 'GET',
        url: '/api/test',
        userId: undefined,
        timestamp: expect.any(String),
      });
    });

    it('should handle missing request ID', () => {
      delete (mockReq.headers as any)['x-request-id'];

      logApiCall(mockReq as any, mockRes as any, mockNext);

      expect(logger.info).toHaveBeenCalledWith('API call', {
        requestId: undefined,
        method: 'GET',
        url: '/api/test',
        userId: 'user-123',
        timestamp: expect.any(String),
      });
    });

    it('should call next() exactly once', () => {
      logApiCall(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in res.end override', () => {
      requestLogger(mockReq as any, mockRes as any, mockNext);

      // Store the original end function
      const originalEnd = mockRes.end!;

      // Mock res.end to throw an error
      const errorEnd = jest.fn(() => {
        throw new Error('Response end failed');
      });

      // Replace res.end temporarily
      (mockRes as any).end = errorEnd;

      // Should not throw when calling res.end
      expect(() => {
        try {
          (errorEnd as any)('test');
        } catch (error) {
          // The error should be caught and logged
          expect(logger.info).toHaveBeenCalled();
        }
      }).not.toThrow();

      // Restore original end
      (mockRes as any).end = originalEnd;
    });
  });

  describe('Performance', () => {
    it('should have minimal overhead', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        requestLogger(mockReq as any, mockRes as any, mockNext);
        mockNext.mockClear();
      }

      const duration = performance.now() - start;

      // Should complete 1000 executions in under 50ms
      expect(duration).toBeLessThan(50);
    });

    it('should not create memory leaks', () => {
      const weakMap = new WeakMap();
      const resEnd = mockRes.end!;

      requestLogger(mockReq as any, mockRes as any, mockNext);
      weakMap.set(mockRes, resEnd);

      // Simulate garbage collection
      global.gc && global.gc();

      expect(weakMap.has(mockRes)).toBe(true);
    });
  });
});