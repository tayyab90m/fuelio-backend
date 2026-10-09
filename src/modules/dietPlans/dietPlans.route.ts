import { FastifyInstance } from "fastify";
import { buildDietPlansService } from "./dietPlans.service";
import { createDietPlanSchema, idParamSchema, listQuerySchema, updateDietPlanSchema } from "./dietPlans.schema";
import { buildPaginationMeta } from "../../utils/pagination";

// Saved plans belong to the signed-in user; every role (including clients)
// manages their own, and nobody can see anyone else's.
export default async function dietPlansRoutes(fastify: FastifyInstance) {
  const service = buildDietPlansService(fastify);

  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const { items, total } = await service.list(request.user.sub, query);
    return reply.send({ data: items, meta: buildPaginationMeta(query, total) });
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    return reply.send({ data: await service.getById(id, request.user.sub) });
  });

  fastify.post("/", async (request, reply) => {
    const body = createDietPlanSchema.parse(request.body);
    return reply.code(201).send({ data: await service.create(request.user.sub, body) });
  });

  fastify.patch("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const body = updateDietPlanSchema.parse(request.body);
    return reply.send({ data: await service.rename(id, request.user.sub, body) });
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await service.remove(id, request.user.sub);
    return reply.code(204).send();
  });
}
