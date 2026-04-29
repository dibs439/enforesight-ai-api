// Must be set before auth.ts is imported (it throws at module load if absent)
process.env.JWT_SECRET = 'test-secret-key-for-jest-unit-tests-32chars';
process.env.NODE_ENV = 'test';

import jwt from 'jsonwebtoken';
import {
    generateToken,
    hashPassword,
    verifyPassword,
    verifyToken,
} from '../../utils/auth';

const SECRET = process.env.JWT_SECRET as string;

describe('utils/auth', () => {
  describe('hashPassword / verifyPassword', () => {
    it('produces a bcrypt hash that verifies correctly', async () => {
      const hash = await hashPassword('MyP@ss1234');
      expect(hash).toMatch(/^\$2[ab]\$/);
      expect(await verifyPassword('MyP@ss1234', hash)).toBe(true);
    });

    it('returns false for the wrong password', async () => {
      const hash = await hashPassword('correct-password');
      expect(await verifyPassword('wrong-password', hash)).toBe(false);
    });

    it('generates different hashes for the same password (salt randomness)', async () => {
      const [h1, h2] = await Promise.all([
        hashPassword('same'),
        hashPassword('same'),
      ]);
      expect(h1).not.toBe(h2);
    });
  });

  describe('generateToken', () => {
    const payload = { userId: 'u1', username: 'alice', role: 'admin' };

    it('returns a string with three JWT segments', () => {
      const token = generateToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('encodes the payload claims into the token', () => {
      const token = generateToken(payload);
      const decoded = jwt.verify(token, SECRET) as any;
      expect(decoded.userId).toBe('u1');
      expect(decoded.username).toBe('alice');
      expect(decoded.role).toBe('admin');
    });

    it('token expires in 24 h (exp is ~86400 s from now)', () => {
      const before = Math.floor(Date.now() / 1000);
      const token = generateToken(payload);
      const decoded = jwt.verify(token, SECRET) as any;
      const ttl = decoded.exp - before;
      expect(ttl).toBeGreaterThan(86390);
      expect(ttl).toBeLessThanOrEqual(86400);
    });
  });

  describe('verifyToken', () => {
    const payload = { userId: 'u2', username: 'bob', role: 'editor' };

    it('returns the decoded payload for a valid token', () => {
      const token = generateToken(payload);
      const result = verifyToken(token);
      expect(result).not.toBeNull();
      expect(result.userId).toBe('u2');
      expect(result.role).toBe('editor');
    });

    it('returns null for a token signed with a different secret', () => {
      const badToken = jwt.sign(payload, 'totally-wrong-secret');
      expect(verifyToken(badToken)).toBeNull();
    });

    it('returns null for a tampered token', () => {
      const token = generateToken(payload);
      const tampered = token.slice(0, -4) + 'xxxx';
      expect(verifyToken(tampered)).toBeNull();
    });

    it('returns null for a completely invalid string', () => {
      expect(verifyToken('not.a.jwt')).toBeNull();
      expect(verifyToken('')).toBeNull();
    });

    it('returns null for an expired token', () => {
      const expired = jwt.sign({ ...payload, exp: Math.floor(Date.now() / 1000) - 1 }, SECRET);
      expect(verifyToken(expired)).toBeNull();
    });
  });
});
