import "dotenv/config";
import { z } from "zod";

const booleanFlag = (fallback: "true" | "false") =>
  z.enum(["true", "false"]).default(fallback).transform((value) => value === "true");

const envSchema = z
  .object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("*"),
  // Set to true when running behind a reverse proxy / load balancer so rate
  // limits and logs use the real client IP from X-Forwarded-For.
  TRUST_PROXY: booleanFlag("false"),
  // When false, POST /auth/register returns 403 (admins can still create users).
  REGISTRATION_ENABLED: booleanFlag("true"),
  // Requests per minute per IP: general API traffic, and the stricter limit
  // for login/register/refresh to slow down password guessing.
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;
    const problem = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });

    if (env.CORS_ORIGIN.trim() === "*") {
      problem("CORS_ORIGIN", "must list your frontend origin(s) in production, not *");
    }
    for (const key of ["JWT_SECRET", "JWT_REFRESH_SECRET"] as const) {
      if (env[key].length < 32) problem(key, "must be at least 32 characters in production");
    }
    if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
      problem("JWT_REFRESH_SECRET", "must differ from JWT_SECRET");
    }
  });

export type Env = z.infer<typeof envSchema>;

export { envSchema };

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}

export const env = loadEnv();
