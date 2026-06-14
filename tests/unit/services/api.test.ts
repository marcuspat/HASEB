import { ApiService } from '@/services/api';
import { mockDatabaseConnection } from '../../helpers/mocks';

// Mock the database connection
jest.mock('../../../src/database/connection', () => ({
  db: mockDatabaseConnection,
}));

// Mock fetch for HTTP requests
global.fetch = jest.fn();

describe('ApiService', () => {
  let apiService: ApiService;

  beforeEach(() => {
    apiService = new ApiService({
      baseURL: 'http://localhost:3000/api',
      timeout: 5000,
      retryAttempts: 3,
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      const service = new ApiService();
      expect(service).toBeDefined();
    });

    it('should accept custom options', () => {
      const options = {
        baseURL: 'https://api.example.com',
        timeout: 10000,
        headers: { 'Authorization': 'Bearer token' },
      };

      const service = new ApiService(options);
      expect(service).toBeDefined();
    });
  });

  describe('HTTP Methods', () => {
    beforeEach(() => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: 'test' }),
        headers: new Headers(),
      });
    });

    describe('GET requests', () => {
      it('should make GET request', async () => {
        const response = await apiService.get('/test');

        expect(fetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/test',
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
          })
        );

        expect(response.success).toBe(true);
        expect(response.data).toBe('test');
      });

      it('should include query parameters', async () => {
        await apiService.get('/test', { page: 1, limit: 10 });

        expect(fetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/test?page=1&limit=10',
          expect.any(Object)
        );
      });

      it('should handle complex query parameters', async () => {
        const params = {
          filter: { status: 'active', type: 'swe' },
          sort: ['name', '-createdAt'],
        };

        await apiService.get('/test', params);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('filter='),
          expect.any(Object)
        );
      });
    });

    describe('POST requests', () => {
      it('should make POST request with data', async () => {
        const data = { name: 'Test', type: 'swe' };

        await apiService.post('/test', data);

        expect(fetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/test',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify(data),
          })
        );
      });

      it('should handle form data', async () => {
        const formData = new FormData();
        formData.append('file', new Blob(['test'], { type: 'text/plain' }));

        await apiService.post('/test', formData);

        expect(fetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/test',
          expect.objectContaining({
            method: 'POST',
            body: formData,
          })
        );
      });
    });

    describe('PUT requests', () => {
      it('should make PUT request with data', async () => {
        const data = { name: 'Updated' };

        await apiService.put('/test/1', data);

        expect(fetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/test/1',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify(data),
          })
        );
      });
    });

    describe('PATCH requests', () => {
      it('should make PATCH request with data', async () => {
        const data = { status: 'active' };

        await apiService.patch('/test/1/status', data);

        expect(fetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/test/1/status',
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify(data),
          })
        );
      });
    });

    describe('DELETE requests', () => {
      it('should make DELETE request', async () => {
        await apiService.delete('/test/1');

        expect(fetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/test/1',
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(apiService.get('/test')).rejects.toThrow('Network error');
    });

    it('should handle HTTP error responses', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Resource not found' }),
        headers: new Headers(),
      });

      await expect(apiService.get('/test')).rejects.toThrow('API Error: 404 - Not Found');
    });

    it('should handle timeout errors', async () => {
      (fetch as jest.Mock).mockImplementation(() =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 6000);
        })
      );

      await expect(apiService.get('/test')).rejects.toThrow('timeout');
    });

    it('should handle JSON parsing errors', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON')),
        headers: new Headers(),
      });

      const response = await apiService.get('/test');
      expect(response).toEqual({ error: 'Failed to parse response' });
    });
  });

  describe('Request Interceptors', () => {
    it('should add authorization header when token provided', async () => {
      const service = new ApiService({
        baseURL: 'http://localhost:3000/api',
        authToken: 'Bearer token123',
      });

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
        headers: new Headers(),
      });

      await service.get('/test');

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer token123',
          }),
        })
      );
    });

    it('should apply custom headers', async () => {
      const service = new ApiService({
        baseURL: 'http://localhost:3000/api',
        headers: {
          'X-Custom-Header': 'custom-value',
          'X-Request-ID': 'req-123',
        },
      });

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
        headers: new Headers(),
      });

      await service.get('/test');

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'custom-value',
            'X-Request-ID': 'req-123',
          }),
        })
      );
    });
  });

  describe('Response Interceptors', () => {
    it('should handle custom response transformations', async () => {
      const service = new ApiService({
        baseURL: 'http://localhost:3000/api',
        transformResponse: (response) => ({
          ...response,
          timestamp: new Date().toISOString(),
        }),
      });

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'test' }),
        headers: new Headers(),
      });

      const response = await service.get('/test');

      expect(response).toHaveProperty('timestamp');
      expect(response.data).toBe('test');
    });

    it('should log responses when debug mode enabled', async () => {
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

      const service = new ApiService({
        baseURL: 'http://localhost:3000/api',
        debug: true,
      });

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
        headers: new Headers(),
      });

      await service.get('/test');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('API Response:'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests', async () => {
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
          headers: new Headers(),
        });

      const response = await apiService.get('/test');

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(response.success).toBe(true);
    });

    it('should stop retrying after max attempts', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Persistent error'));

      await expect(apiService.get('/test')).rejects.toThrow('Persistent error');
      expect(fetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it('should not retry on client errors (4xx)', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid request' }),
        headers: new Headers(),
      });

      await expect(apiService.get('/test')).rejects.toThrow();
      expect(fetch).toHaveBeenCalledTimes(1); // No retry for 4xx errors
    });
  });

  describe('File Uploads', () => {
    it('should handle file uploads', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', file);

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, fileId: 'file-123' }),
        headers: new Headers(),
      });

      const response = await apiService.upload('/upload', file);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/upload',
        expect.objectContaining({
          method: 'POST',
          body: formData,
        })
      );

      expect(response.fileId).toBe('file-123');
    });

    it('should handle multiple file uploads', async () => {
      const files = [
        new File(['content1'], 'file1.txt'),
        new File(['content2'], 'file2.txt'),
      ];

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, files: ['file-1', 'file-2'] }),
        headers: new Headers(),
      });

      const response = await apiService.uploadMultiple('/upload', files);

      expect(response.files).toHaveLength(2);
    });
  });

  describe('Request Cancellation', () => {
    it('should support request cancellation', async () => {
      const abortController = new AbortController();

      (fetch as jest.Mock).mockImplementation(() =>
        new Promise((_, reject) => {
          abortController.signal.addEventListener('abort', () => {
            reject(new Error('Request cancelled'));
          });
        })
      );

      const requestPromise = apiService.get('/test', {}, { signal: abortController.signal });

      // Cancel the request
      abortController.abort();

      await expect(requestPromise).rejects.toThrow('Request cancelled');
    });
  });

  describe('Performance', () => {
    it('should handle concurrent requests', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, id: Math.random() }),
        headers: new Headers(),
      });

      const promises = Array.from({ length: 10 }, () => apiService.get('/test'));
      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(10);
      expect(fetch).toHaveBeenCalledTimes(10);

      // Verify all responses are successful
      responses.forEach(response => {
        expect(response.success).toBe(true);
      });
    });

    it('should cache GET requests when enabled', async () => {
      const service = new ApiService({
        baseURL: 'http://localhost:3000/api',
        cache: true,
        cacheMaxAge: 60000, // 1 minute
      });

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'cached' }),
        headers: new Headers(),
      });

      // First request
      await service.get('/test');
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second request (should use cache)
      await service.get('/test');
      expect(fetch).toHaveBeenCalledTimes(1); // Still only called once
    });
  });
});