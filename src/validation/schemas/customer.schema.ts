import { z } from 'zod';

export const createCustomerSchema = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  subscriptionTier: z.string().optional(),
  active: z.boolean().optional(),
  phoneNumber: z.string().optional(),
  occupation: z.string().optional(),
  isSuspended: z.boolean().optional(),
});

export const updateCustomerSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  subscriptionTier: z.string().optional(),
  active: z.boolean().optional(),
  imageUrl: z.string().url().optional(),
  phoneNumber: z.string().optional(),
  occupation: z.string().optional(),
  isSuspended: z.boolean().optional(),
});

export const patchCustomerSchema = z.object({
  isSuspended: z.boolean({ error: 'isSuspended is required and must be a boolean' }),
});

export const customerListQuerySchema = z.object({
  page: z.string().optional().default('1').transform(v => parseInt(v) || 1),
  limit: z.string().optional().default('20').transform(v => parseInt(v) || 20),
  search: z.string().optional(),
  q: z.string().optional(),
  active: z
    .string()
    .optional()
    .transform(v => (v === 'true' ? true : v === 'false' ? false : undefined)),
  subscriptionTier: z.string().optional(),
});
