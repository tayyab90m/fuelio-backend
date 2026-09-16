import { z } from "zod";

export const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  name: z.string().min(1),
  phoneNumber: z.string().min(1).optional(),
});
export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshBody = z.infer<typeof refreshBodySchema>;

export function toPublicUser(user: { id: string; email: string; name: string; phoneNumber: string | null }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phoneNumber: user.phoneNumber,
  };
}
