import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Generate unique request ID
  const requestId = uuidv4();
  req.headers['x-request-id'] = requestId;

  // Extract relevant information
  const startTime = Date.now();
  const { method, url, ip } = req;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const contentLength = req.get('Content-Length') || '0';

  // Log request
  logger.info('Incoming request', {
    requestId,
    method,
    url,
    ip,
    userAgent,
    contentLength,
    timestamp: new Date().toISOString(),
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    const { statusCode } = res;

    logger.info('Request completed', {
      requestId,
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || '0',
      timestamp: new Date().toISOString(),
    });

    // Call original end
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

export const logApiCall = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string;
  const { method, url } = req;
  const userId = (req as any).user?.id;

  logger.info('API call', {
    requestId,
    method,
    url,
    userId,
    timestamp: new Date().toISOString(),
  });

  next();
};