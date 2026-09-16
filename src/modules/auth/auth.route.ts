import { FastifyInstance } from "fastify";
import { buildAuthService } from "./auth.service";
import { loginBodySchema, refreshBodySchema, registerBodySchema } from "./auth.schema";

export default async function authRoutes(fastify: FastifyInstance) {
  const authService = buildAuthService(fastify);

  fastify.post("/register", async (request, reply) => {
    const body = registerBodySchema.parse(request.body);
    const result = await authService.register(body);
    return reply.code(201).send(result);
  });

  fastify.post("/login", async (request, reply) => {
    const body = loginBodySchema.parse(request.body);
    const result = await authService.login(body);
    return reply.send(result);
  });

  fastify.post("/refresh", async (request, reply) => {
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
