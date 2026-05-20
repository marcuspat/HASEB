import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errorHandler';

export interface ValidationSchema {
  body?: Record<string, ValidationRule>;
  query?: Record<string, ValidationRule>;
  params?: Record<string, ValidationRule>;
}

export interface ValidationRule {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'email' | 'uuid';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  format?: string;
  enum?: any[];
  default?: any;
  items?: ValidationRule;
  properties?: Record<string, ValidationRule>;
  custom?: (value: any) => boolean | string;
}

export const validateRequest = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    // Validate request body
    if (schema.body) {
      const bodyErrors = validateObject(req.body, schema.body, 'body');
      errors.push(...bodyErrors);
    }

    // Validate query parameters
    if (schema.query) {
      const queryErrors = validateObject(req.query, schema.query, 'query');
      errors.push(...queryErrors);
    }

    // Validate path parameters
    if (schema.params) {
      const paramErrors = validateObject(req.params, schema.params, 'params');
      errors.push(...paramErrors);
    }

    if (errors.length > 0) {
      throw new ValidationError('Validation failed', { errors });
    }

    next();
  };
};

function validateObject(obj: any, schema: Record<string, ValidationRule>, context: string): string[] {
  const errors: string[] = [];

  for (const [key, rule] of Object.entries(schema)) {
    const value = obj[key];

    // Check required fields
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${context}.${key} is required`);
      continue;
    }

    // Skip validation if field is not required and value is missing
    if (!rule.required && (value === undefined || value === null)) {
      continue;
    }

    // Type validation
    if (!validateType(value, rule.type)) {
      errors.push(`${context}.${key} must be of type ${rule.type}`);
      continue;
    }

    // String validation
    if (rule.type === 'string' && typeof value === 'string') {
      if (rule.min && value.length < rule.min) {
        errors.push(`${context}.${key} must be at least ${rule.min} characters long`);
      }
      if (rule.max && value.length > rule.max) {
        errors.push(`${context}.${key} must be at most ${rule.max} characters long`);
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(`${context}.${key} does not match required pattern`);
      }
    }

    // Number validation
    if (rule.type === 'number' && typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push(`${context}.${key} must be at least ${rule.min}`);
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push(`${context}.${key} must be at most ${rule.max}`);
      }
    }

    // Array validation
    if (rule.type === 'array' && Array.isArray(value)) {
      if (rule.min && value.length < rule.min) {
        errors.push(`${context}.${key} must contain at least ${rule.min} items`);
      }
      if (rule.max && value.length > rule.max) {
        errors.push(`${context}.${key} must contain at most ${rule.max} items`);
      }
    }

    // Enum validation
    if (rule.enum && !rule.enum.includes(value)) {
      errors.push(`${context}.${key} must be one of: ${rule.enum.join(', ')}`);
    }

    // Custom validation
    if (rule.custom) {
      const customResult = rule.custom(value);
      if (customResult !== true) {
        errors.push(typeof customResult === 'string'
          ? `${context}.${key}: ${customResult}`
          : `${context}.${key} failed custom validation`);
      }
    }
  }

  return errors;
}

function validateType(value: any, type: ValidationRule['type']): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'email':
      return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'uuid':
      return typeof value === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    default:
      return false;
  }
}

// Common validation schemas
export const commonSchemas = {
  pagination: {
    query: {
      page: { type: 'number', min: 1, default: 1 },
      limit: { type: 'number', min: 1, max: 100, default: 20 },
      sortBy: { type: 'string', required: false },
      sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
    } as Record<string, ValidationRule>,
  },

  id: {
    params: {
      id: { type: 'uuid', required: true },
    },
  },

  search: {
    query: {
      q: { type: 'string', required: true, min: 1, max: 100 },
      page: { type: 'number', min: 1, default: 1 },
      limit: { type: 'number', min: 1, max: 100, default: 20 },
    },
  },

  agentCreate: {
    body: {
      name: { type: 'string', required: true, min: 1, max: 255 },
      type: { type: 'string', required: true, enum: ['swe', 'gui', 'general', 'orchestrator'] },
      description: { type: 'string', required: false, max: 1000 },
      capabilities: { type: 'array', required: false, max: 50 },
      configuration: { type: 'object', required: false },
    },
  },

  benchmarkCreate: {
    body: {
      name: { type: 'string', required: true, min: 1, max: 255 },
      type: { type: 'string', required: true, enum: ['swe-bench', 'gaia', 'osworld', 'webarena', 'agentbench', 'custom'] },
      description: { type: 'string', required: false, max: 1000 },
      dataset: { type: 'string', required: true, min: 1, max: 255 },
      evaluationCriteria: { type: 'array', required: false },
      configuration: { type: 'object', required: false },
    },
  },

  evaluationCreate: {
    body: {
      agentId: { type: 'uuid', required: true },
      benchmarkId: { type: 'uuid', required: true },
      configuration: { type: 'object', required: false },
    },
  },

  userCreate: {
    body: {
      email: { type: 'email', required: true },
      username: { type: 'string', required: true, min: 3, max: 50, pattern: /^[a-zA-Z0-9_-]+$/ },
      fullName: { type: 'string', required: true, min: 1, max: 255 },
      password: { type: 'string', required: true, min: 8, max: 128 },
      role: { type: 'string', enum: ['admin', 'user', 'viewer'], default: 'user' },
    },
  },

  userLogin: {
    body: {
      email: { type: 'email', required: true },
      password: { type: 'string', required: true, min: 1 },
    },
  },
};

// Middleware to extract and validate pagination
export const extractPagination = (req: Request, res: Response, next: NextFunction): void => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const sortBy = req.query.sortBy as string;
  const sortOrder = req.query.sortOrder as string === 'asc' ? 'asc' : 'desc';

  req.pagination = {
    page: Math.max(1, page),
    limit: Math.min(100, Math.max(1, limit)),
    sortBy,
    sortOrder,
  };

  next();
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      pagination?: {
        page: number;
        limit: number;
        sortBy?: string;
        sortOrder: 'asc' | 'desc';
      };
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}