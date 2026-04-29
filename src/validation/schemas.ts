import { z } from 'zod';

// Helper function for date validation
const isValidDateString = (dateStr: string): boolean => {
  // First check format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }

  // Then check if it's a valid date
  const date = new Date(dateStr);
  const parts = dateStr.split('-');

  // Ensure we have exactly 3 parts
  if (parts.length !== 3) {
    return false;
  }

  const year = parseInt(parts[0]!, 10);
  const month = parseInt(parts[1]!, 10);
  const day = parseInt(parts[2]!, 10);

  // Verify the date components match what was parsed
  // This catches invalid dates like 2023-13-01 or 2023-02-30
  return (
    !isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 && // getMonth() is 0-indexed
    date.getDate() === day
  );
}; // Common schemas
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

// Enforcement schemas
export const enforcementFiltersSchema = z.object({
  regulator: z.string().optional(),
  regulatorName: z.string().optional(),
  jurisdiction: z.string().optional(),
  sector: z.string().optional(),
  actionType: z.string().optional(),
  violationType: z.string().optional(),
  currency: z.string().optional(),
  minFineAmount: z
    .string()
    .optional()
    .transform(val => (val ? parseFloat(val) : undefined)),
  maxFineAmount: z
    .string()
    .optional()
    .transform(val => (val ? parseFloat(val) : undefined)),
  dateFrom: z
    .string()
    .optional()
    .refine(
      val => !val || isValidDateString(val),
      'dateFrom must be a valid date in YYYY-MM-DD format'
    ),
  dateTo: z
    .string()
    .optional()
    .refine(
      val => !val || isValidDateString(val),
      'dateTo must be a valid date in YYYY-MM-DD format'
    ),
  search: z.string().optional(),
  field: z.string().optional(),
});

// Base enforcement object schema (without top-level refinements)
const enforcementBaseSchema = z.object({
  documentId: z.string().min(1, 'Document ID is required'),
  jurisdiction: z.string().min(1, 'Jurisdiction is required'),
  regulatorName: z.string().min(1, 'Regulator name is required'),
  subjectName: z.string().min(1, 'Subject name is required'),
  sector: z.string().min(1, 'Sector is required'),
  dateOfAction: z
    .string()
    .refine(
      val => isValidDateString(val),
      'Date of action must be a valid date in YYYY-MM-DD format'
    ),
  field: z.string().min(1, 'Field is required'),
  currency: z.string().min(1, 'Currency is required'),
  fineAmount: z
    .union([z.string(), z.number()])
    .transform((val, ctx) => {
      const num = typeof val === 'string' ? parseFloat(val) : val;
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Fine amount must be a valid number',
        });
        return z.NEVER;
      }
      return num;
    })
    .refine(val => val >= 0, 'Fine amount must be non-negative'),
  enforcementActionType: z
    .union([z.string(), z.array(z.string())])
    .transform(val => (Array.isArray(val) ? val : [val]))
    .refine(
      arr => arr.length > 0,
      'At least one enforcement action type is required'
    ),
  violationTypes: z
    .union([z.string(), z.array(z.string())])
    .transform(val => (Array.isArray(val) ? val : [val]))
    .refine(arr => arr.length > 0, 'At least one violation type is required'),
  enforcementNoticeUrl: z.string().url().optional().or(z.literal('')),
  enforcementNoticeData: z.string().optional(),
  enforcementFile: z.string().optional(),
});

export const createEnforcementSchema = enforcementBaseSchema.refine(
  data => {
    const hasUrl =
      data.enforcementNoticeUrl && data.enforcementNoticeUrl !== '';
    const hasFile = data.enforcementFile && data.enforcementFile !== '';
    return hasUrl || hasFile;
  },
  {
    message:
      'Either enforcement notice URL or enforcement file must be provided',
    path: ['enforcementNotice'],
  }
);

export const updateEnforcementSchema = enforcementBaseSchema.partial().refine(
  data => {
    // If both fields are provided in the update, at least one must have a value
    const urlProvided = 'enforcementNoticeUrl' in data;
    const fileProvided = 'enforcementFile' in data;

    // If neither is being updated, validation passes (existing values preserved)
    if (!urlProvided && !fileProvided) {
      return true;
    }

    // If updating, ensure at least one has a value
    const hasUrl =
      data.enforcementNoticeUrl && data.enforcementNoticeUrl !== '';
    const hasFile = data.enforcementFile && data.enforcementFile !== '';

    return hasUrl || hasFile;
  },
  {
    message:
      'If updating enforcement notice, either URL or file must be provided',
    path: ['enforcementNotice'],
  }
);

// User schemas
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
      if (typeof val === 'string') {
        return val.toLowerCase() === 'true';
      }
      return undefined;
    }),
  search: z.string().optional(),
  field: z.string().optional(),
});

// Regulator schemas
export const createRegulatorSchema = z.object({
  name: z.string().min(1, 'Regulator name is required'),
  country: z.string().min(1, 'country is required'),
  currency: z.string().min(1, 'currency is required'),
  active: z.boolean().optional().default(true),
});

export const updateRegulatorSchema = createRegulatorSchema.partial();

export const regulatorFiltersSchema = z.object({
  jurisdiction: z.string().optional(),
  isActive: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform(val => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        return val.toLowerCase() === 'true';
      }
      return undefined;
    }),
  search: z.string().optional(),
  field: z.string().optional(),
});

// Client schemas
export const createClientSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  email: z.string().email('Invalid email format'),
  company: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateClientSchema = createClientSchema.partial();

export const clientFiltersSchema = z.object({
  isActive: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform(val => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        return val.toLowerCase() === 'true';
      }
      return undefined;
    }),
  search: z.string().optional(),
  field: z.string().optional(),
});

// Content schemas
export const createContentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  type: z.enum(['article', 'news', 'update']),
  isPublished: z.boolean().optional().default(false),
  publishedAt: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateContentSchema = createContentSchema.partial();

export const contentFiltersSchema = z.object({
  type: z.enum(['article', 'news', 'update']).optional(),
  isPublished: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform(val => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        return val.toLowerCase() === 'true';
      }
      return undefined;
    }),
  search: z.string().optional(),
  field: z.string().optional(),
});

// Authentication schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters long'),
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
