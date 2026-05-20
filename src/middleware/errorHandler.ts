import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types/index';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public details: any;

  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(message, 500, 'DATABASE_ERROR');
  }
}

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: any = undefined;

  // Log the error
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Handle known application errors
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
    if (error instanceof ValidationError) {
      details = error.details;
    }
  }
  // Handle PostgreSQL errors
  else if (error instanceof Error) {
    const pgError = error as any;
    if (pgError.code) {
      switch (pgError.code) {
        case '23505': // unique_violation
          statusCode = 409;
          errorCode = 'DUPLICATE_ENTRY';
          message = 'Resource already exists';
          details = { constraint: pgError.constraint };
          break;
        case '23503': // foreign_key_violation
          statusCode = 400;
          errorCode = 'FOREIGN_KEY_VIOLATION';
          message = 'Referenced resource does not exist';
          details = { constraint: pgError.constraint };
          break;
        case '23502': // not_null_violation
          statusCode = 400;
          errorCode = 'REQUIRED_FIELD_MISSING';
          message = 'Required field is missing';
          details = { column: pgError.column };
          break;
        case '23514': // check_violation
          statusCode = 400;
          errorCode = 'CHECK_VIOLATION';
          message = 'Data constraint violation';
          break;
        case '28P01': // invalid_password
          statusCode = 500;
          errorCode = 'DATABASE_AUTH_ERROR';
          message = 'Database authentication failed';
          break;
        case 'ECONNREFUSED':
          statusCode = 503;
          errorCode = 'DATABASE_CONNECTION_ERROR';
          message = 'Database connection refused';
          break;
        case 'ETIMEDOUT':
          statusCode = 503;
          errorCode = 'DATABASE_TIMEOUT';
          message = 'Database connection timeout';
          break;
        default:
          statusCode = 500;
          errorCode = 'DATABASE_ERROR';
          message = 'Database operation failed';
          details = { code: pgError.code };
      }
    }
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  }

  // Handle multipart/form-data errors
  if (error instanceof Error && error.message.includes('Max file size exceeded')) {
    statusCode = 413;
    errorCode = 'FILE_TOO_LARGE';
    message = 'File size exceeds maximum allowed limit';
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
    details = undefined;
  }

  const response: ApiResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      details,
      timestamp: new Date(),
    },
    metadata: {
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string || 'unknown',
      version: '1.0.0',
    },
  };

  res.status(statusCode).json(response);
};

// Async error wrapper for route handlers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validate required environment variables
export const validateEnvironment = (): void => {
  const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};