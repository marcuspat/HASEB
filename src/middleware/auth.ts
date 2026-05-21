import express from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../database/models/User';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

function unauthorized(res: express.Response, message: string): void {
  res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message,
      timestamp: new Date(),
    },
  });
}

/**
 * Verifies a Bearer JWT and attaches the resolved (active) user to req.user.
 * Accepts tokens that carry the subject as either `userId` or `id`.
 */
export async function authenticateToken(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : undefined;

  if (!token) {
    unauthorized(res, 'Access token required');
    return;
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET as string);
  } catch {
    unauthorized(res, 'Invalid or expired token');
    return;
  }

  const userId = decoded.userId ?? decoded.id;
  if (!userId) {
    unauthorized(res, 'Invalid or expired token');
    return;
  }

  try {
    const user = await UserModel.findById(userId);
    if (!user || !user.isActive) {
      unauthorized(res, 'User not found or inactive');
      return;
    }

    (req as any).user = user;
    next();
  } catch (error) {
    logger.error('Error fetching user during authentication:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        timestamp: new Date(),
      },
    });
  }
}

/**
 * Requires the authenticated user to hold a specific role (admins always pass).
 * Must run after authenticateToken.
 */
export function requireRole(role: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
      unauthorized(res, 'Authentication required');
      return;
    }

    if (user.role !== role && user.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          timestamp: new Date(),
        },
      });
      return;
    }

    next();
  };
}
