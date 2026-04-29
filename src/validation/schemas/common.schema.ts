import { z } from 'zod';

export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform(val => parseInt(val) || 1),
  limit: z
    .string()
    .optional()
    .default('20')
    .transform(val => parseInt(val) || 20),
});

export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
});
