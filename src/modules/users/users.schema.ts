import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination";
import { ROLES } from "../../utils/roles";

const roleSchema = z.enum(ROLES);

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  name: z.string().min(1),
  phoneNumber: z.string().min(1).optional(),
  role: roleSchema.default("client"),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  phoneNumber: z.string().min(1).nullable().optional(),
  role: roleSchema.optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const idParamSchema = z.object({ id: z.string().uuid() });

export const listQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  role: roleSchema.optional(),
});
export type ListUsersQuery = z.infer<typeof listQuerySchema>;
