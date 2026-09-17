import { FastifyInstance } from "fastify";
import { buildQuestionsService } from "./questions.service";
import { calculateDietPlan } from "./dietPlan.service";
import {
  createQuestionSchema,
  idParamSchema,
  listQuerySchema,
  submitAnswerSchema,
  updateQuestionSchema,
} from "./questions.schema";
import { buildPaginationMeta } from "../../utils/pagination";

export default async function questionsRoutes(fastify: FastifyInstance) {
  const service = buildQuestionsService(fastify);

  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const { items, total } = await service.list(query);
    return reply.send({ data: items, meta: buildPaginationMeta(query, total) });
  });

  // Registered ahead of the generic "/:id" routes below purely for
  // readability; the literal path never collides with the ":id" param route.
  fastify.post("/submit-answer", async (request, reply) => {
    const body = submitAnswerSchema.parse(request.body);
    const result = await calculateDietPlan(fastify, body);
    return reply.send(result);
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const item = await service.getById(id);
    return reply.send({ data: item });
  });

  fastify.post("/", async (request, reply) => {
    const body = createQuestionSchema.parse(request.body);
    const item = await service.create(body);
    return reply.code(201).send({ data: item });
  });

  fastify.put("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const body = updateQuestionSchema.parse(request.body);
    const item = await service.update(id, body);
    return reply.send({ data: item });
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await service.remove(id);
    return reply.code(204).send();
  });
}
