// Set required env vars before any auth module loads
process.env.JWT_SECRET = 'test-secret-key-for-jest-unit-tests-32chars';
process.env.NODE_ENV = 'test';

import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { requireJwtAuth } from '../../middleware/jwtAuth';

const SECRET = process.env.JWT_SECRET as string;

function makeToken(payload = { userId: 'u1', username: 'alice', role: 'admin' }, secret = SECRET, opts?: jwt.SignOptions) {
  return jwt.sign(payload, secret, { expiresIn: '1h', ...opts });
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.get('/protected', requireJwtAuth, (req: Request, res: Response) => {
    res.json({ ok: true, user: (req as any).user, auth: (req as any).auth });
  });
  return app;
}

const app = makeApp();

describe('middleware/jwt-auth - requireJwtAuth', () => {
  describe('missing or malformed Authorization header', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const res = await request(app).get('/protected');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/No token/i);
    });

    it('returns 401 when Authorization header is not Bearer scheme', async () => {
      const res = await request(app)
        .get('/protected')
        .set('Authorization', 'Basic dXNlcjpwYXNz');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/No token/i);
    });

    it('returns 401 for "Bearer " with empty token', async () => {
      const res = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer ');
      // empty string after strip — verifyToken returns null
      expect(res.status).toBe(401);
    });
  });

  describe('invalid / expired tokens', () => {
    it('returns 401 for a token signed with a different secret', async () => {
      const badToken = makeToken({} as any, 'wrong-secret');
      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${badToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid or expired/i);
    });

    it('returns 401 for a tampered token', async () => {
      const token = makeToken();
      const tampered = token.slice(0, -4) + 'xxxx';
      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${tampered}`);
      expect(res.status).toBe(401);
    });

    it('returns 401 for an expired token', async () => {
      const expired = jwt.sign(
        { userId: 'u1', username: 'alice', role: 'admin', exp: Math.floor(Date.now() / 1000) - 10 },
        SECRET
      );
      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${expired}`);
      expect(res.status).toBe(401);
    });

    it('returns 401 for a completely nonsense string', async () => {
      const res = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer not.a.valid.jwt.at.all');
      expect(res.status).toBe(401);
    });
  });

  describe('valid token', () => {
    it('calls next and attaches req.user on a valid token', async () => {
      const token = makeToken({ userId: 'u99', username: 'bob', role: 'editor' });
      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.user.userId).toBe('u99');
      expect(res.body.user.username).toBe('bob');
      expect(res.body.user.role).toBe('editor');
    });

    it('attaches req.auth with userId and role claims', async () => {
      const token = makeToken({ userId: 'u5', username: 'carol', role: 'admin' });
      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.body.auth.userId).toBe('u5');
      expect(res.body.auth.claims.role).toBe('admin');
      expect(res.body.auth.sessionId).toBe('jwt-session');
    });
  });
});
