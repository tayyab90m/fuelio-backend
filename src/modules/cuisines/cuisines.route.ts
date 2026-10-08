import { FastifyInstance } from "fastify";
import { buildCuisinesService } from "./cuisines.service";
import {
  createCuisineSchema,
  idParamSchema,
  listQuerySchema,
  updateCuisineSchema,
} from "./cuisines.schema";
import { buildPaginationMeta } from "../../utils/pagination";

export default async function cuisinesRoutes(fastify: FastifyInstance) {
  const service = buildCuisinesService(fastify);

  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const { items, total } = await service.list(query);
    return reply.send({ data: items, meta: buildPaginationMeta(query, total) });
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const item = await service.getById(id);
    return reply.send({ data: item });
  });

  fastify.post("/", async (request, reply) => {
    const body = createCuisineSchema.parse(request.body);
    const item = await service.create(body);
    return reply.code(201).send({ data: item });
  });

  fastify.put("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const body = updateCuisineSchema.parse(request.body);
    const item = await service.update(id, body);
    return reply.send({ data: item });
  });

  fastify.patch("/:id/toggle-state", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const item = await service.toggleState(id);
    return reply.send({ data: item });
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await service.remove(id);
    return reply.code(204).send();
  });
}
