import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest } from '../middleware/validation';
import { UserModel } from '../database/models/User';
import { UnauthorizedError, ConflictError } from '../middleware/errorHandler';
import { ApiResponse, User } from '../types/index';
import { logger } from '../utils/logger';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET!;
// Access and refresh tokens are signed with distinct secrets so that an access
// token can never be replayed as a refresh token (and vice versa). If a
// dedicated refresh secret is not configured we fall back to JWT_SECRET.
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

function generateToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
}

function generateRefreshToken(userId: string): string {
  // Each refresh token carries a unique id (jti). Because a fresh refresh token
  // is issued on every /refresh call (rotation), the jti uniquely identifies an
  // individual token in the rotation chain and is the hook a persistent
  // allow/deny list would key off for reuse detection.
  return jwt.sign(
    { userId, type: 'refresh', jti: randomUUID() },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions
  );
}

function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

function verifyRefreshToken(token: string): any {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
}

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - username
 *               - fullName
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *                 pattern: '^[a-zA-Z0-9_-]+$'
 *               fullName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 128
 *               role:
 *                 type: string
 *                 enum: [admin, user, viewer]
 *                 default: user
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
router.post('/register',
  validateRequest({
    body: {
      email: { type: 'email', required: true },
      username: { type: 'string', required: true, min: 3, max: 50, pattern: /^[a-zA-Z0-9_-]+$/ },
      fullName: { type: 'string', required: true, min: 1, max: 255 },
      password: { type: 'string', required: true, min: 8, max: 128 },
      role: { type: 'string', enum: ['admin', 'user', 'viewer'], default: 'user' },
    },
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { email, username, fullName, password, role = 'user' } = req.body;

    // Check if user already exists
    const existingUserByEmail = await UserModel.findByEmail(email);
    if (existingUserByEmail) {
      throw new ConflictError('User with this email already exists');
    }

    const existingUserByUsername = await UserModel.findByUsername(username);
    if (existingUserByUsername) {
      throw new ConflictError('User with this username already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const userData = {
      email,
      username,
      fullName,
      role,
      isActive: true,
    };

    // We need to manually set the password hash since UserModel expects it
    const user = await UserModel.create(userData as any);
    await UserModel.updatePassword(user.id, passwordHash);

    // Generate tokens
    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    logger.info('User registered successfully', { userId: user.id, email, username });

    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
        },
        token,
        refreshToken,
      },
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    res.status(201).json(response);
  })
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Authentication successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login',
  validateRequest({
    body: {
      email: { type: 'email', required: true },
      password: { type: 'string', required: true },
    },
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { email, password } = req.body;

    // Find user
    const user = await UserModel.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    // Verify password
    const passwordHash = await UserModel.getPasswordHash(user.id);
    if (!passwordHash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isValidPassword = await bcrypt.compare(password, passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    logger.info('User logged in successfully', { userId: user.id, email });

    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
        },
        token,
        refreshToken,
      },
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh',
  validateRequest({
    body: {
      refreshToken: { type: 'string', required: true },
    },
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { refreshToken } = req.body;

    // Verify refresh token against the dedicated refresh secret
    const decoded = verifyRefreshToken(refreshToken);
    if (decoded.type !== 'refresh') {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Find user
    const user = await UserModel.findById(decoded.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    // Rotate tokens: issue a brand-new access token AND a brand-new refresh
    // token (with a fresh jti) on every refresh, so the previous refresh token
    // is superseded rather than reused indefinitely.
    const newToken = generateToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    const response: ApiResponse = {
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
      },
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *       401:
 *         description: Unauthorized
 */
router.get('/profile',
  authenticateToken,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const user = req.user!;

    const response: ApiResponse = {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Email already exists
 */
router.put('/profile',
  authenticateToken,
  validateRequest({
    body: {
      fullName: { type: 'string', min: 1, max: 255, required: false },
      email: { type: 'email', required: false },
    },
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const user = req.user!;
    const updates: any = {};

    if (req.body.fullName !== undefined) {
      updates.fullName = req.body.fullName;
    }
    if (req.body.email !== undefined) {
      // Check if email is already taken by another user
      const existingUser = await UserModel.findByEmail(req.body.email);
      if (existingUser && existingUser.id !== user.id) {
        throw new ConflictError('Email already exists');
      }
      updates.email = req.body.email;
    }

    const updatedUser = await UserModel.update(user.id, updates);

    const response: ApiResponse = {
      success: true,
      data: {
        id: updatedUser!.id,
        email: updatedUser!.email,
        username: updatedUser!.username,
        fullName: updatedUser!.fullName,
        role: updatedUser!.role,
        isActive: updatedUser!.isActive,
        createdAt: updatedUser!.createdAt,
        updatedAt: updatedUser!.updatedAt,
      },
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     summary: Change user password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 128
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Invalid current password
 */
router.put('/change-password',
  authenticateToken,
  validateRequest({
    body: {
      currentPassword: { type: 'string', required: true },
      newPassword: { type: 'string', required: true, min: 8, max: 128 },
    },
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const user = req.user!;
    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const passwordHash = await UserModel.getPasswordHash(user.id);
    if (!passwordHash) {
      throw new UnauthorizedError('Invalid current password');
    }

    const isValidPassword = await bcrypt.compare(currentPassword, passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid current password');
    }

    // Hash and update new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await UserModel.updatePassword(user.id, newPasswordHash);

    logger.info('Password changed successfully', { userId: user.id });

    const response: ApiResponse = {
      success: true,
      data: { message: 'Password changed successfully' },
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    res.json(response);
  })
);

// Middleware to authenticate JWT token
function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return void res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Access token required',
        timestamp: new Date(),
      },
    });
  }

  try {
    const decoded = verifyToken(token);

    // Attach user to request
    UserModel.findById(decoded.userId)
      .then(user => {
        if (!user || !user.isActive) {
          return void res.status(401).json({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'User not found or inactive',
              timestamp: new Date(),
            },
          });
        }

        (req as any).user = user;
        next();
      })
      .catch(error => {
        logger.error('Error fetching user during authentication:', error);
        return void res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            timestamp: new Date(),
          },
        });
      });
  } catch (error) {
    return void res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
        timestamp: new Date(),
      },
    });
  }
}

// Middleware to check user role
function requireRole(role: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
      return void res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date(),
        },
      });
    }

    if (user.role !== role && user.role !== 'admin') {
      return void res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          timestamp: new Date(),
        },
      });
    }

    next();
  };
}

export { authenticateToken, requireRole };
export default router;