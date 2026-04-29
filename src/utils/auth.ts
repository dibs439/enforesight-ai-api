import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 10;
if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required but not set. Set it in your .env file.'
  );
}
const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = '24h'; // Token expires in 24 hours

/**
 * Hash a plain text password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a plain text password against a hashed password
 */
export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: {
  userId: string;
  username: string;
  role: string;
}): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (_error) {
    return null;
  }
}
