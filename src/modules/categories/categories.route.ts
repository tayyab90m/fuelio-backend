import { FastifyInstance } from "fastify";
import { buildCategoriesService } from "./categories.service";
import { createCategorySchema, idParamSchema, updateCategorySchema } from "./categories.schema";

export default async function categoriesRoutes(fastify: FastifyInstance) {
  const service = buildCategoriesService(fastify);

  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (_request, reply) => {
    const items = await service.list();
    return reply.send({ data: items });
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const item = await service.getById(id);
    return reply.send({ data: item });
  });

  fastify.post("/", async (request, reply) => {
    const body = createCategorySchema.parse(request.body);
    const item = await service.create(body);
    return reply.code(201).send({ data: item });
  });

  fastify.put("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const body = updateCategorySchema.parse(request.body);
    const item = await service.update(id, body);
    return reply.send({ data: item });
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await service.remove(id);
    return reply.code(204).send();
  });
}
