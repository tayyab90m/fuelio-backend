import { FastifyInstance } from "fastify";
import { buildGeneralMealTypesService } from "./generalMealTypes.service";
import {
  createGeneralMealTypeSchema,
  idParamSchema,
  updateGeneralMealTypeSchema,
} from "./generalMealTypes.schema";

export default async function generalMealTypesRoutes(fastify: FastifyInstance) {
  const service = buildGeneralMealTypesService(fastify);

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
    const body = createGeneralMealTypeSchema.parse(request.body);
    const item = await service.create(body);
    return reply.code(201).send({ data: item });
  });

  fastify.put("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const body = updateGeneralMealTypeSchema.parse(request.body);
    const item = await service.update(id, body);
    return reply.send({ data: item });
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await service.remove(id);
    return reply.code(204).send();
  });
}
