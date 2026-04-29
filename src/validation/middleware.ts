import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

export type ValidationTarget = 'body' | 'query' | 'params';

export function validateSchema(
  schema: z.ZodSchema<any>,
  target: ValidationTarget = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      let dataToValidate;

      switch (target) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        default:
          dataToValidate = req.body;
      }

      const result = schema.safeParse(dataToValidate);

      if (!result.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: result.error.issues.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        });
        return;
      }

      // Replace the original data with the parsed and transformed data
      switch (target) {
        case 'body':
          req.body = result.data;
          break;
        case 'query':
          // Can't assign directly to req.query, so we need to replace properties
          Object.keys(req.query).forEach(key => delete req.query[key]);
          Object.assign(req.query, result.data);
          break;
        case 'params':
          req.params = result.data;
          break;
      }

      next();
    } catch (error) {
      res.status(500).json({
        error: 'Schema validation error',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  };
}

// Convenience functions for common validation patterns
export const validateBody = (schema: z.ZodSchema<any>) =>
  validateSchema(schema, 'body');

export const validateQuery = (schema: z.ZodSchema<any>) =>
  validateSchema(schema, 'query');

export const validateParams = (schema: z.ZodSchema<any>) =>
  validateSchema(schema, 'params');

// Combined validation for routes that need multiple validations
export function validateMultiple(validations: {
  body?: z.ZodSchema<any>;
  query?: z.ZodSchema<any>;
  params?: z.ZodSchema<any>;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: any[] = [];

    // Validate body if schema provided
    if (validations.body) {
      const bodyResult = validations.body.safeParse(req.body);
      if (!bodyResult.success) {
        errors.push(
          ...bodyResult.error.issues.map((err: any) => ({
            target: 'body',
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          }))
        );
      } else {
        req.body = bodyResult.data;
      }
    }

    // Validate query if schema provided
    if (validations.query) {
      const queryResult = validations.query.safeParse(req.query);
      if (!queryResult.success) {
        errors.push(
          ...queryResult.error.issues.map((err: any) => ({
            target: 'query',
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          }))
        );
      } else {
        // Can't assign directly to req.query, so we need to replace properties
        Object.keys(req.query).forEach(key => delete req.query[key]);
        Object.assign(req.query, queryResult.data);
      }
    }

    // Validate params if schema provided
    if (validations.params) {
      const paramsResult = validations.params.safeParse(req.params);
      if (!paramsResult.success) {
        errors.push(
          ...paramsResult.error.issues.map((err: any) => ({
            target: 'params',
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          }))
        );
      } else {
        req.params = paramsResult.data;
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    next();
  };
}
