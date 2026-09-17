import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination";

export const createUnitSchema = z.object({
  name: z.string().min(1),
  short: z.string().min(1).optional(),
  equivalentTo: z.number().optional(),
  unitType: z.string().min(1).optional(),
  system: z.string().min(1).optional(),
});
export type CreateUnitInput = z.infer<typeof createUnitSchema>;

export const updateUnitSchema = createUnitSchema.partial();
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const listQuerySchema = paginationQuerySchema;
export type ListUnitsQuery = z.infer<typeof listQuerySchema>;
