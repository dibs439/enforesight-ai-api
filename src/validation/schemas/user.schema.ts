import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(['admin', 'editor']),
  isActive: z.boolean().optional().default(true),
});

export const updateUserSchema = createUserSchema.partial();

export const userFiltersSchema = z.object({
  role: z.enum(['admin', 'editor']).optional(),
  isActive: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform(val => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return val.toLowerCase() === 'true';
      return undefined;
    }),
  search: z.string().optional(),
  field: z.string().optional(),
});
