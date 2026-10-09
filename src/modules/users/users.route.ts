import { FastifyInstance } from "fastify";
import { buildUsersService } from "./users.service";
import { createUserSchema, idParamSchema, listQuerySchema, updateUserSchema } from "./users.schema";
import { buildPaginationMeta } from "../../utils/pagination";

// Admin-only user management.
export default async function usersRoutes(fastify: FastifyInstance) {
  const service = buildUsersService(fastify);

  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("admin"));

  fastify.get("/", async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const { items, total } = await service.list(query);
    return reply.send({ data: items, meta: buildPaginationMeta(query, total) });
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    return reply.send({ data: await service.getById(id) });
  });

  fastify.post("/", async (request, reply) => {
    const body = createUserSchema.parse(request.body);
    return reply.code(201).send({ data: await service.create(body) });
  });

  fastify.patch("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const body = updateUserSchema.parse(request.body);
    return reply.send({ data: await service.update(id, body) });
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await service.remove(id, request.user.sub);
    return reply.code(204).send();
  });
}
