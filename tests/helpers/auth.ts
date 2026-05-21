import jwt from 'jsonwebtoken';
import { UserModel } from '@/database/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

export interface TestUser {
  id: string;
  email: string;
  username: string;
  role: string;
  token: string;
  password: string;
}

let counter = 0;

/**
 * Creates an active user (with a known password) and returns a signed Bearer
 * token for it. Used by suites that exercise the authenticated HTTP routes.
 */
export async function createTestUserAndToken(
  role: 'admin' | 'user' | 'viewer' = 'admin'
): Promise<TestUser> {
  const bcrypt = await import('bcryptjs');
  const unique = `${Date.now()}_${counter++}`;
  const password = 'TestPassword123!';

  const user = await UserModel.create({
    email: `auth_${unique}@test.com`,
    username: `authuser_${unique}`,
    fullName: 'Auth Test User',
    role,
    isActive: true,
  } as any);

  await UserModel.updatePassword(user.id, await bcrypt.hash(password, 10));

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });

  return { id: user.id, email: user.email, username: user.username, role: user.role, token, password };
}

export function signToken(userId: string, expiresIn: string | number = '1h'): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: expiresIn as any });
}
