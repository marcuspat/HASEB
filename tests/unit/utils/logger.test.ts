import { describe, it, expect } from '@jest/globals';
import { logger } from '@/utils/logger';

/**
 * ESM-compatible logger tests.
 *
 * These exercise the REAL exported `logger` singleton and its observable
 * behavior. The previous CommonJS suite re-`require()`-d the module under
 * different NODE_ENV values and asserted winston.createLogger call counts /
 * File-transport internals via `require.cache`. None of that is portable to
 * Jest's ESM runner (no `require`, no `require.cache`, no `require.resolve`,
 * and ESM module records cannot be re-evaluated mid-test), so those tests are
 * intentionally dropped in favor of behavioral assertions on the public API.
 */
describe('Logger', () => {
  describe('Logger Creation', () => {
    it('should export a defined logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger).not.toBeNull();
    });

    it('should expose the standard logging methods', () => {
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('Logger Methods', () => {
    it('should call each level with a plain string without throwing', () => {
      expect(() => {
        logger.error('Test error');
        logger.warn('Test warning');
        logger.info('Test info');
        logger.debug('Test debug');
      }).not.toThrow();
    });

    it('should accept structured metadata without throwing', () => {
      expect(() => {
        logger.info('Test message', { key: 'value', number: 123 });
        logger.error('Error with metadata', { error: new Error('test') });
      }).not.toThrow();
    });

    it('should handle empty and edge-case arguments without throwing', () => {
      expect(() => {
        logger.info('');
        logger.warn('warn', {});
        logger.debug('debug', { nested: { deep: { value: true } } });
      }).not.toThrow();
    });
  });

  describe('Singleton Behavior', () => {
    it('should return the same instance on re-import', async () => {
      const { logger: reimported } = await import('@/utils/logger');
      expect(reimported).toBe(logger);
    });
  });

  describe('Performance', () => {
    it('should be efficient for many log calls', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        logger.info(`Test message ${i}`);
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1000);
    });
  });
});
