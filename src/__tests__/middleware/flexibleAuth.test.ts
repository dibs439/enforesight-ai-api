// Set required env vars before any module loads
process.env.JWT_SECRET = 'test-secret-key-for-jest-unit-tests-32chars';
process.env.NODE_ENV = 'test';

// Mock Clerk packages — they make external calls and require network/keys
jest.mock('@clerk/express', () => ({
  verifyToken: jest.fn(),
  clerkClient: {
    users: {
      getUser: jest.fn(),
    },
  },
}));

// Explicit @jest/globals imports prevent VS Code from auto-importing
// afterEach/describe/it from node:test, zod, or zod/v4/locales
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { flexibleAuth } from '../../middleware/flexibleAuth';

// Get the mocked Clerk helpers for controlling behaviour in tests
import { clerkClient as mockClerkClient, verifyToken as mockVerifyToken } from '@clerk/express';

const SECRET = process.env.JWT_SECRET as string;

/** Build a minimal Express app that uses flexibleAuth */
function makeApp() {
  const app = express();
  app.use(express.json());
  app.get('/secure', flexibleAuth, (req: Request, res: Response) => {
    res.json({ ok: true, user: (req as any).user, clerkUser: (req as any).clerkUser });
  });
  return app;
}

const app = makeApp();

/** Fake HS256 token — signed with our test secret */
function makeHs256Token(payload: object, secret = SECRET, opts?: jwt.SignOptions) {
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '1h', ...opts });
}

/** Creates a token that LOOKS like a Clerk RS256 token (has alg/kid in header)
 *  but carries a fake signature — used to route into the Clerk path while
 *  controlling the mock response of verifyToken. */
function makeRS256LikeToken(sub: string) {
  const enc = (s: string) =>
    Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const header = enc(JSON.stringify({ alg: 'RS256', kid: 'test-key-123', typ: 'JWT' }));
  const payload = enc(JSON.stringify({ sub, iat: Math.floor(Date.now() / 1000) }));
  return `${header}.${payload}.fakesig`;
}

afterEach(() => {
  jest.clearAllMocks();
  delete process.env.TEST_MODE;
  delete process.env.TEST_USER_ID;
});

// ─── TEST_MODE bypass ─────────────────────────────────────────────────────────

describe('flexibleAuth - TEST_MODE', () => {
  it('sets a mock user and calls next in test environment with TEST_MODE=true', async () => {
    process.env.TEST_MODE = 'true';
    const res = await request(app).get('/secure');
    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe('test-user-123');
    expect(res.body.user.username).toBe('test-user');
  });

  it('uses TEST_USER_ID env var when set', async () => {
    process.env.TEST_MODE = 'true';
    process.env.TEST_USER_ID = 'custom-id-456';
    const res = await request(app).get('/secure');
    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe('custom-id-456');
  });

  it('does NOT bypass auth in production even if TEST_MODE=true', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.TEST_MODE = 'true';

    const prodApp = express();
    prodApp.use(express.json());
    prodApp.get('/secure', flexibleAuth, (_req: Request, res: Response) =>
      res.json({ ok: true })
    );

    const res = await request(prodApp).get('/secure');
    expect(res.status).toBe(401);

    process.env.NODE_ENV = origEnv;
  });
});

// ─── Missing / malformed header ───────────────────────────────────────────────

describe('flexibleAuth - no auth header', () => {
  it('returns 401 when no Authorization header is present', async () => {
    const res = await request(app).get('/secure');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when Authorization header is not Bearer scheme', async () => {
    const res = await request(app)
      .get('/secure')
      .set('Authorization', 'Basic dXNlcjpwYXNz');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a token with fewer than 3 segments', async () => {
    const res = await request(app)
      .get('/secure')
      .set('Authorization', 'Bearer only.two');
    expect(res.status).toBe(401);
  });
});

// ─── Custom JWT (HS256) path ───────────────────────────────────────────────────

describe('flexibleAuth - custom JWT (HS256)', () => {
  it('accepts a valid HS256 token and attaches req.user', async () => {
    const token = makeHs256Token({ userId: 'u10', username: 'dave', email: 'dave@x.com' });
    const res = await request(app).get('/secure').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe('u10');
    expect(res.body.user.username).toBe('dave');
  });

  it('returns 401 for a tampered HS256 token', async () => {
    const token = makeHs256Token({ userId: 'u1', username: 'alice' });
    const tampered = token.slice(0, -4) + 'xxxx';
    const res = await request(app)
      .get('/secure')
      .set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 for an expired HS256 token', async () => {
    const token = jwt.sign(
      { userId: 'u1', username: 'alice', exp: Math.floor(Date.now() / 1000) - 5 },
      SECRET,
      { algorithm: 'HS256' }
    );
    const res = await request(app)
      .get('/secure')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});

// ─── Clerk (RS256) path ───────────────────────────────────────────────────────

describe('flexibleAuth - Clerk RS256 path', () => {
  const fakeClerkUser = {
    id: 'clerk-user-abc',
    username: 'clerkuser',
    emailAddresses: [{ emailAddress: 'clerk@example.com' }],
    firstName: 'Clerk',
    lastName: 'Test',
    imageUrl: 'https://img.clerk.com/avatar.jpg',
  };

  beforeEach(() => {
    (mockVerifyToken as jest.Mock).mockReset();
    (mockClerkClient.users.getUser as jest.Mock).mockReset();
  });

  it('accepts a Clerk RS256 token and populates req.user + req.clerkUser', async () => {
    (mockVerifyToken as jest.Mock).mockResolvedValue({ sub: 'clerk-user-abc' });
    (mockClerkClient.users.getUser as jest.Mock).mockResolvedValue(fakeClerkUser);

    const token = makeRS256LikeToken('clerk-user-abc');
    const res = await request(app).get('/secure').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe('clerk-user-abc');
    expect(res.body.user.username).toBe('clerkuser');
    expect(res.body.user.email).toBe('clerk@example.com');
    expect(res.body.clerkUser.id).toBe('clerk-user-abc');
    expect(res.body.clerkUser.firstName).toBe('Clerk');
  });

  it('uses email as username when Clerk user has no username', async () => {
    (mockVerifyToken as jest.Mock).mockResolvedValue({ sub: 'clerk-user-xyz' });
    (mockClerkClient.users.getUser as jest.Mock).mockResolvedValue({
      ...fakeClerkUser,
      id: 'clerk-user-xyz',
      username: null,
    });

    const token = makeRS256LikeToken('clerk-user-xyz');
    const res = await request(app).get('/secure').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('clerk@example.com');
  });

  it('returns 401 when Clerk verifyToken throws', async () => {
    (mockVerifyToken as jest.Mock).mockRejectedValue(new Error('Token verification failed'));

    const token = makeRS256LikeToken('bad-user');
    const res = await request(app).get('/secure').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid Clerk session token/i);
  });
});
