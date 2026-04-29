// Set required env vars before any module loads
process.env.JWT_SECRET = 'test-secret-key-for-jest-unit-tests-32chars';
process.env.NODE_ENV = 'test';

import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { requireAdmin, requireJWTAuth } from '../../middleware/adminAuth';

const SECRET = process.env.JWT_SECRET as string;

function makeToken(
  payload: object = { userId: 'u1', username: 'alice', role: 'admin' },
  secret = SECRET,
  opts?: jwt.SignOptions
) {
  return jwt.sign(payload, secret, { expiresIn: '1h', ...opts });
}

// ─── requireJWTAuth app ───────────────────────────────────────────────────────

function makeAuthApp() {
  const app = express();
  app.use(express.json());
  app.get('/protected', requireJWTAuth, (req: Request, res: Response) => {
    res.json({ ok: true, user: (req as any).user });
  });
  return app;
}

const authApp = makeAuthApp();

// ─── requireAdmin app (uses both middleware in chain) ────────────────────────

function makeAdminApp() {
  const app = express();
  app.use(express.json());
  app.get(
    '/admin-only',
    requireJWTAuth,
    requireAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true });
    }
  );
  return app;
}

const adminApp = makeAdminApp();

// ─── requireJWTAuth tests ─────────────────────────────────────────────────────

describe('middleware/admin-auth - requireJWTAuth', () => {
  describe('missing or malformed Authorization header', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const res = await request(authApp).get('/protected');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
      expect(res.body.message).toMatch(/Authorization header is required/i);
    });

    it('returns 401 when Authorization header is not Bearer scheme', async () => {
      const res = await request(authApp)
        .get('/protected')
        .set('Authorization', 'Basic dXNlcjpwYXNz');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('returns 401 for "Bearer " with empty token after stripping', async () => {
      // HTTP clients trim trailing whitespace in headers, so "Bearer " arrives
      // as "Bearer" — the token becomes the literal string "Bearer" which
      // fails JWT verification and hits the invalid-token 401 path.
      const res = await request(authApp)
        .get('/protected')
        .set('Authorization', 'Bearer ');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });
  });

  describe('invalid or expired tokens', () => {
    it('returns 401 for a token signed with a different secret', async () => {
      const badToken = makeToken({}, 'wrong-secret');
      const res = await request(authApp)
        .get('/protected')
        .set('Authorization', `Bearer ${badToken}`);
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Invalid or expired token/i);
    });

    it('returns 401 for a tampered token', async () => {
      const token = makeToken();
      const tampered = token.slice(0, -4) + 'xxxx';
      const res = await request(authApp)
        .get('/protected')
        .set('Authorization', `Bearer ${tampered}`);
      expect(res.status).toBe(401);
    });

    it('returns 401 for an expired token', async () => {
      const expired = jwt.sign(
        {
          userId: 'u1',
          username: 'alice',
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) - 10,
        },
        SECRET
      );
      const res = await request(authApp)
        .get('/protected')
        .set('Authorization', `Bearer ${expired}`);
      expect(res.status).toBe(401);
    });

    it('returns 401 for a completely nonsense token string', async () => {
      const res = await request(authApp)
        .get('/protected')
        .set('Authorization', 'Bearer not.a.valid.jwt');
      expect(res.status).toBe(401);
    });
  });

  describe('valid token', () => {
    it('calls next and attaches req.user on a valid token', async () => {
      const token = makeToken({ userId: 'u99', username: 'bob', role: 'editor' });
      const res = await request(authApp)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.user.userId).toBe('u99');
      expect(res.body.user.username).toBe('bob');
      expect(res.body.user.role).toBe('editor');
    });

    it('attaches userId and role from token payload to req.user', async () => {
      const token = makeToken({ userId: 'u5', username: 'carol', role: 'admin' });
      const res = await request(authApp)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.body.user.userId).toBe('u5');
      expect(res.body.user.username).toBe('carol');
      expect(res.body.user.role).toBe('admin');
    });
  });
});

// ─── requireAdmin tests ───────────────────────────────────────────────────────

describe('middleware/admin-auth - requireAdmin', () => {
  it('returns 403 when authenticated user does not have admin role', async () => {
    const token = makeToken({ userId: 'u2', username: 'editor', role: 'editor' });
    const res = await request(adminApp)
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toMatch(/Admin role required/i);
  });

  it('calls next when authenticated user has admin role', async () => {
    const token = makeToken({ userId: 'u1', username: 'alice', role: 'admin' });
    const res = await request(adminApp)
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 401 when called without a preceding auth middleware (no req.user)', async () => {
    const noAuthApp = express();
    noAuthApp.use(express.json());
    noAuthApp.get('/admin-only', requireAdmin, (_req: Request, res: Response) => {
      res.json({ ok: true });
    });

    const res = await request(noAuthApp).get('/admin-only');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(res.body.message).toMatch(/Authentication required/i);
  });
});
