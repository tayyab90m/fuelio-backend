import { FastifyInstance } from "fastify";
import { ForbiddenError } from "../../utils/errors";
import { buildAuthService } from "./auth.service";
import { loginBodySchema, refreshBodySchema, registerBodySchema } from "./auth.schema";

export interface AuthRoutesOptions {
  authRateLimitMax: number;
  registrationEnabled: boolean;
}

export default async function authRoutes(fastify: FastifyInstance, opts: AuthRoutesOptions) {
  const authService = buildAuthService(fastify);
  // Stricter per-IP limit than the global one: these are the endpoints
  // someone would hammer to guess passwords or mass-create accounts.
  const authLimit = { config: { rateLimit: { max: opts.authRateLimitMax, timeWindow: "1 minute" } } };

  fastify.post("/register", authLimit, async (request, reply) => {
    if (!opts.registrationEnabled) {
      throw new ForbiddenError("Registration is disabled. Ask an administrator to create an account for you.");
    }
    const body = registerBodySchema.parse(request.body);
    const result = await authService.register(body);
    return reply.code(201).send(result);
  });

  fastify.post("/login", authLimit, async (request, reply) => {
    const body = loginBodySchema.parse(request.body);
    const result = await authService.login(body);
    return reply.send(result);
  });

  fastify.post("/refresh", authLimit, async (request, reply) => {
    const body = refreshBodySchema.parse(request.body);
    const result = await authService.refresh(body);
    return reply.send(result);
  });

  fastify.get(
    "/me",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = await authService.me(request.user.sub);
      return reply.send({ user });
    }
  );
}
