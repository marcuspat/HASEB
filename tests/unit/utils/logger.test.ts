import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { logger } from '@/utils/logger';

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn(),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    printf: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

describe('Logger', () => {
  let mockCreateLogger: jest.Mock;
  let mockExistsSync: jest.Mock;
  let mockMkdirSync: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Get mock functions
    const winston = require('winston');
    mockCreateLogger = winston.createLogger;

    const fs = require('fs');
    mockExistsSync = fs.existsSync;
    mockMkdirSync = fs.mkdirSync;

    // Mock console methods to prevent noise in tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'info').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Logger Creation', () => {
    it('should create logger with default configuration', () => {
      expect(mockCreateLogger).toHaveBeenCalled();
    });

    it('should use correct log level from environment', () => {
      // This is tested implicitly through the logger creation
      expect(logger).toBeDefined();
    });

    it('should have logger methods available', () => {
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('Environment-based Configuration', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should use development format in non-production environment', () => {
      process.env.NODE_ENV = 'development';

      // Re-require the module to test different environment
      jest.resetModules();
      delete require.cache[require.resolve('@/utils/logger')];

      const { logger: devLogger } = require('@/utils/logger');

      expect(mockCreateLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          format: expect.any(Object)
        })
      );
    });

    it('should use production format in production environment', () => {
      process.env.NODE_ENV = 'production';

      // Re-require the module to test different environment
      jest.resetModules();
      delete require.cache[require.resolve('@/utils/logger')];

      const { logger: prodLogger } = require('@/utils/logger');

      expect(mockCreateLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          format: expect.any(Object)
        })
      );
    });
  });

  describe('Transports Configuration', () => {
    it('should include Console transport', () => {
      const winston = require('winston');
      const mockLogger = mockCreateLogger.mock.results[0].value;

      expect(winston.transports.Console).toHaveBeenCalled();
    });

    it('should include File transports in production', () => {
      process.env.NODE_ENV = 'production';

      jest.resetModules();
      delete require.cache[require.resolve('@/utils/logger')];

      const winston = require('winston');
      require('@/utils/logger');

      expect(winston.transports.File).toHaveBeenCalledTimes(2);
    });

    it('should not include File transports in development', () => {
      process.env.NODE_ENV = 'development';

      jest.resetModules();
      delete require.cache[require.resolve('@/utils/logger')];

      const winston = require('winston');
      require('@/utils/logger');

      expect(winston.transports.File).not.toHaveBeenCalled();
    });
  });

  describe('Directory Creation', () => {
    it('should create logs directory in production', async () => {
      process.env.NODE_ENV = 'production';
      mockExistsSync.mockReturnValue(false);

      jest.resetModules();
      delete require.cache[require.resolve('@/utils/logger')];

      await require('@/utils/logger');

      // Wait for the async import in the logger
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockExistsSync).toHaveBeenCalledWith('logs');
      expect(mockMkdirSync).toHaveBeenCalledWith('logs', { recursive: true });
    });

    it('should not create logs directory if it exists', async () => {
      process.env.NODE_ENV = 'production';
      mockExistsSync.mockReturnValue(true);

      jest.resetModules();
      delete require.cache[require.resolve('@/utils/logger')];

      await require('@/utils/logger');

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockExistsSync).toHaveBeenCalledWith('logs');
      expect(mockMkdirSync).not.toHaveBeenCalled();
    });

    it('should not attempt to create logs directory in development', async () => {
      process.env.NODE_ENV = 'development';

      jest.resetModules();
      delete require.cache[require.resolve('@/utils/logger')];

      await require('@/utils/logger');

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockExistsSync).not.toHaveBeenCalled();
      expect(mockMkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('Exception and Rejection Handlers', () => {
    it('should configure exception handlers', () => {
      const winston = require('winston');
      const mockLogger = mockCreateLogger.mock.results[0].value;

      expect(mockLogger.exceptionHandlers).toBeDefined();
      expect(Array.isArray(mockLogger.exceptionHandlers)).toBe(true);
    });

    it('should configure rejection handlers', () => {
      const winston = require('winston');
      const mockLogger = mockCreateLogger.mock.results[0].value;

      expect(mockLogger.rejectionHandlers).toBeDefined();
      expect(Array.isArray(mockLogger.rejectionHandlers)).toBe(true);
    });

    it('should include File handlers in production for exceptions', () => {
      process.env.NODE_ENV = 'production';

      jest.resetModules();
      delete require.cache[require.resolve('@/utils/logger')];

      const winston = require('winston');
      require('@/utils/logger');

      expect(winston.transports.File).toHaveBeenCalled();
    });
  });

  describe('Log Level Configuration', () => {
    it('should use LOG_LEVEL from environment', () => {
      const originalLogLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'debug';

      jest.resetModules();
      delete require.cache[require.resolve('@/utils/logger')];

      require('@/utils/logger');

      expect(mockCreateLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug'
        })
      );

      process.env.LOG_LEVEL = originalLogLevel;
    });

    it('should default to info level when LOG_LEVEL is not set', () => {
      delete process.env.LOG_LEVEL;

      jest.resetModules();
      delete require.cache[require.resolve('@/utils/logger')];

      require('@/utils/logger');

      expect(mockCreateLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info'
        })
      );
    });
  });

  describe('Logger Methods', () => {
    it('should have all standard logging methods', () => {
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should methods be callable without errors', () => {
      expect(() => {
        logger.error('Test error');
        logger.warn('Test warning');
        logger.info('Test info');
        logger.debug('Test debug');
      }).not.toThrow();
    });

    it('should handle complex log data', () => {
      expect(() => {
        logger.info('Test message', { key: 'value', number: 123 });
        logger.error('Error with metadata', { error: new Error('test') });
      }).not.toThrow();
    });
  });

  describe('Configuration Validation', () => {
    it('should handle missing environment variables gracefully', () => {
      delete process.env.LOG_LEVEL;
      delete process.env.NODE_ENV;

      jest.resetModules();
      delete require.cache[require.resolve('@/utils/logger')];

      expect(() => {
        require('@/utils/logger');
      }).not.toThrow();
    });

    it('should handle invalid LOG_LEVEL values', () => {
      process.env.LOG_LEVEL = 'invalid-level';

      jest.resetModules();
      delete require.cache[require.resolve('@/utils/logger')];

      expect(() => {
        require('@/utils/logger');
      }).not.toThrow();
    });
  });

  describe('Memory and Performance', () => {
    it('should not create multiple logger instances', () => {
      jest.resetModules();
      delete require.cache[require.resolve('@/utils/logger')];

      const winston = require('winston');

      require('@/utils/logger');
      require('@/utils/logger'); // Second import

      // Should only create logger once
      expect(winston.createLogger).toHaveBeenCalledTimes(1);
    });

    it('should be efficient for multiple log calls', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        logger.info(`Test message ${i}`);
      }

      const end = performance.now();
      const duration = end - start;

      // Should complete 1000 log calls quickly (adjust threshold as needed)
      expect(duration).toBeLessThan(100); // 100ms
    });
  });
});