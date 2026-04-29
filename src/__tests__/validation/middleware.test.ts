process.env.NODE_ENV = 'test';

import express, { Request, Response } from 'express';
import request from 'supertest';
import { z } from 'zod';
import {
  validateBody,
  validateMultiple,
  validateParams,
  validateQuery,
} from '../../validation/middleware';

// ─── test app factory ─────────────────────────────────────────────────────────

function makeApp() {
  const app = express();
  app.use(express.json());

  // validateBody
  app.post(
    '/body',
    validateBody(z.object({ name: z.string().min(1), age: z.number().int().positive() })),
    (req: Request, res: Response) => res.json({ ok: true, data: req.body })
  );

  // validateQuery
  app.get(
    '/query',
    validateQuery(
      z.object({
        page: z.string().optional().default('1').transform(v => parseInt(v) || 1),
      })
    ),
    (req: Request, res: Response) => res.json({ ok: true, data: req.query })
  );

  // validateParams
  app.get(
    '/item/:id',
    validateParams(z.object({ id: z.string().min(1) })),
    (req: Request, res: Response) => res.json({ ok: true, data: req.params })
  );

  // validateMultiple — body + query
  app.post(
    '/multi',
    validateMultiple({
      body: z.object({ title: z.string().min(1) }),
      query: z.object({
        version: z.string().optional().default('1'),
      }),
    }),
    (req: Request, res: Response) =>
      res.json({ ok: true, body: req.body, query: req.query })
  );

  return app;
}

const app = makeApp();

// ─── validateBody ─────────────────────────────────────────────────────────────

describe('validateBody', () => {
  it('calls next and parses body on valid input', async () => {
    const res = await request(app).post('/body').send({ name: 'Alice', age: 30 });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Alice');
    expect(res.body.data.age).toBe(30);
  });

  it('returns 400 with details on invalid body', async () => {
    const res = await request(app).post('/body').send({ name: '', age: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('returns 400 with field paths in details', async () => {
    const res = await request(app).post('/body').send({ age: 'not-a-number' });
    expect(res.status).toBe(400);
    const fields = res.body.details.map((d: any) => d.field);
    // 'name' field is missing and 'age' has wrong type
    expect(fields).toContain('age');
  });

  it('replaces req.body with transformed/parsed data', async () => {
    const res = await request(app).post('/body').send({ name: 'Bob', age: 25 });
    expect(res.body.data).toEqual({ name: 'Bob', age: 25 });
  });
});

// ─── validateQuery ────────────────────────────────────────────────────────────

describe('validateQuery', () => {
  it('passes and transforms query params on valid input', async () => {
    const res = await request(app).get('/query?page=3');
    expect(res.status).toBe(200);
    // page is transformed to integer as a string representation in query
    expect(Number(res.body.data.page)).toBe(3);
  });

  it('applies schema default when query param is absent (request succeeds)', async () => {
    const res = await request(app).get('/query');
    // Middleware must pass (200) when required fields have defaults
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ─── validateParams ───────────────────────────────────────────────────────────

describe('validateParams', () => {
  it('passes with a valid param', async () => {
    const res = await request(app).get('/item/abc123');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('abc123');
  });
});

// ─── validateMultiple ─────────────────────────────────────────────────────────

describe('validateMultiple', () => {
  it('passes when both body and query are valid', async () => {
    const res = await request(app)
      .post('/multi?version=2')
      .send({ title: 'My Post' });
    expect(res.status).toBe(200);
    expect(res.body.body.title).toBe('My Post');
  });

  it('returns 400 and collects errors from body when body is invalid', async () => {
    const res = await request(app)
      .post('/multi?version=1')
      .send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Validation failed/i);
    const bodyErrors = res.body.details.filter((d: any) => d.target === 'body');
    expect(bodyErrors.length).toBeGreaterThan(0);
  });

  it('returns 400 for multiple targets failing simultaneously', async () => {
    // Create a strict app with a required query param so both targets can fail
    const strictApp = express();
    strictApp.use(express.json());
    strictApp.post(
      '/strict',
      validateMultiple({
        body: z.object({ name: z.string().min(1) }),
        query: z.object({ required: z.string().min(1) }),
      }),
      (_req: Request, res: Response) => res.json({ ok: true })
    );

    const res = await request(strictApp).post('/strict?required=').send({ name: '' });
    expect(res.status).toBe(400);
    const targets = res.body.details.map((d: any) => d.target);
    expect(targets).toContain('body');
  });

  it('validates params when included in validateMultiple — valid params pass', async () => {
    const paramApp = express();
    paramApp.use(express.json());
    paramApp.get(
      '/things/:id',
      validateMultiple({ params: z.object({ id: z.string().min(1) }) }),
      (req: Request, res: Response) => res.json({ ok: true, id: req.params.id })
    );

    const res = await request(paramApp).get('/things/abc');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('abc');
  });

  it('returns 400 with target=params when params fail in validateMultiple', async () => {
    const paramApp = express();
    paramApp.use(express.json());
    paramApp.get(
      '/things/:id',
      validateMultiple({ params: z.object({ id: z.string().min(5) }) }),
      (_req: Request, res: Response) => res.json({ ok: true })
    );

    const res = await request(paramApp).get('/things/x');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Validation failed/i);
    const targets = res.body.details.map((d: any) => d.target);
    expect(targets).toContain('params');
  });

  it('collects errors from both body and params when both fail in validateMultiple', async () => {
    const multiApp = express();
    multiApp.use(express.json());
    multiApp.post(
      '/combined/:id',
      validateMultiple({
        body: z.object({ name: z.string().min(1) }),
        params: z.object({ id: z.string().min(3) }),
      }),
      (_req: Request, res: Response) => res.json({ ok: true })
    );

    const res = await request(multiApp).post('/combined/x').send({ name: '' });
    expect(res.status).toBe(400);
    const targets = res.body.details.map((d: any) => d.target);
    expect(targets).toContain('body');
    expect(targets).toContain('params');
  });
});
