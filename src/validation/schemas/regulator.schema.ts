import { z } from 'zod';

export const createRegulatorSchema = z.object({
  name: z.string().min(1, 'Regulator name is required'),
  country: z.string().min(1, 'country is required'),
  currency: z.string().min(1, 'currency is required'),
  active: z.boolean().optional().default(true),
});

export const updateRegulatorSchema = createRegulatorSchema.partial();
