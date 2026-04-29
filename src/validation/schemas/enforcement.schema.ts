import { z } from 'zod';

const isValidDateString = (dateStr: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const date = new Date(dateStr);
  const [year, month, day] = dateStr.split('-').map(Number);
  return (
    !isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() === month! - 1 &&
    date.getDate() === day
  );
};

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

const enforcementBaseSchema = z.object({
  documentId: z.string().min(1, 'Document ID is required'),
  jurisdiction: z.string().min(1, 'Jurisdiction is required'),
  regulatorName: z.string().min(1, 'Regulator name is required'),
  subjectName: z.string().min(1, 'Subject name is required'),
  sector: z.string().min(1, 'Sector is required'),
  dateOfAction: z
    .string()
    .refine(isValidDateString, 'Date of action must be a valid date in YYYY-MM-DD format'),
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
    .refine(arr => arr.length > 0, 'At least one enforcement action type is required'),
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
    const hasUrl = data.enforcementNoticeUrl && data.enforcementNoticeUrl !== '';
    const hasFile = data.enforcementFile && data.enforcementFile !== '';
    return hasUrl || hasFile;
  },
  {
    message: 'Either enforcement notice URL or enforcement file must be provided',
    path: ['enforcementNotice'],
  }
);

export const updateEnforcementSchema = enforcementBaseSchema.partial().refine(
  data => {
    const urlProvided = 'enforcementNoticeUrl' in data;
    const fileProvided = 'enforcementFile' in data;
    if (!urlProvided && !fileProvided) return true;
    const hasUrl = data.enforcementNoticeUrl && data.enforcementNoticeUrl !== '';
    const hasFile = data.enforcementFile && data.enforcementFile !== '';
    return hasUrl || hasFile;
  },
  {
    message: 'If updating enforcement notice, either URL or file must be provided',
    path: ['enforcementNotice'],
  }
);
