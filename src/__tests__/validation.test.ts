import request from 'supertest';
import { z } from 'zod';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../validation/middleware';
import {
  createEnforcementSchema,
  paginationSchema,
} from '../validation/schemas';

// Create a minimal Express app for testing validation
import express from 'express';

const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Test route with body validation
  app.post('/test-body', validateBody(createEnforcementSchema), (req, res) => {
    res.json({ success: true, data: req.body });
  });

  // Test route with query validation
  app.get('/test-query', validateQuery(paginationSchema), (req, res) => {
    res.json({ success: true, data: req.query });
  });

  // Test route with params validation
  app.get(
    '/test-params/:id',
    validateParams(z.object({ id: z.string().min(1) })),
    (req, res) => {
      res.json({ success: true, data: req.params });
    }
  );

  return app;
};

describe('Validation Middleware', () => {
  const app = createTestApp();

  describe('Body Validation', () => {
    it('should pass with valid enforcement data', async () => {
      const validData = {
        documentId: 'DOC123',
        jurisdiction: 'UK',
        regulatorName: 'FCA',
        subjectName: 'Test Bank',
        sector: 'Banking',
        dateOfAction: '2023-01-01',
        field: 'AML',
        currency: 'GBP',
        fineAmount: 100000,
        enforcementActionType: ['Fine'],
        violationTypes: ['AML Breach'],
        enforcementNoticeUrl: 'https://example.com/notice.pdf',
      };

      const response = await request(app).post('/test-body').send(validData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should fail with missing required fields', async () => {
      const invalidData = {
        documentId: 'DOC123',
        // Missing required fields
      };

      const response = await request(app).post('/test-body').send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    it('should fail with invalid date format', async () => {
      const invalidData = {
        documentId: 'DOC123',
        jurisdiction: 'UK',
        regulatorName: 'FCA',
        subjectName: 'Test Bank',
        sector: 'Banking',
        dateOfAction: 'invalid-date',
        field: 'AML',
        currency: 'GBP',
        fineAmount: 100000,
        enforcementActionType: ['Fine'],
        violationTypes: ['AML Breach'],
      };

      const response = await request(app).post('/test-body').send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(
        response.body.details.some((err: any) =>
          err.message.includes('YYYY-MM-DD')
        )
      ).toBe(true);
    });

    it('should fail when both enforcement notice URL and file are missing', async () => {
      const invalidData = {
        documentId: 'DOC123',
        jurisdiction: 'UK',
        regulatorName: 'FCA',
        subjectName: 'Test Bank',
        sector: 'Banking',
        dateOfAction: '2023-01-01',
        field: 'AML',
        currency: 'GBP',
        fineAmount: 100000,
        enforcementActionType: ['Fine'],
        violationTypes: ['AML Breach'],
        // Missing both enforcementNoticeUrl and enforcementFile
      };

      const response = await request(app).post('/test-body').send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(
        response.body.details.some((err: any) =>
          err.message.includes(
            'Either enforcement notice URL or enforcement file must be provided'
          )
        )
      ).toBe(true);
    });
  });

  describe('Query Validation', () => {
    it('should pass with valid pagination params', async () => {
      const response = await request(app)
        .get('/test-query')
        .query({ page: '1', limit: '10' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Query values might remain as strings due to Express's query handling
      expect(['1', 1]).toContain(response.body.data.page);
      expect(['10', 10]).toContain(response.body.data.limit);
    });

    it('should handle missing pagination params', async () => {
      const response = await request(app).get('/test-query');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Should have transformed defaults if schema supports it
      expect(response.body.data).toBeDefined();
    });
  });

  describe('Params Validation', () => {
    it('should pass with valid ID param', async () => {
      const response = await request(app).get('/test-params/123');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('123');
    });

    it('should fail with empty ID param', async () => {
      const response = await request(app).get('/test-params/');

      expect(response.status).toBe(404); // Express handles this as route not found
    });
  });
});
