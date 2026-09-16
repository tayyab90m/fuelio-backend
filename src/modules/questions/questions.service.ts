import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { NotFoundError } from "../../utils/errors";
import { CreateQuestionInput, UpdateQuestionInput } from "./questions.schema";

export function buildQuestionsService(fastify: FastifyInstance) {
  const { prisma } = fastify;

  async function list() {
    return prisma.question.findMany({ orderBy: { createdAt: "asc" } });
  }

  async function getById(id: string) {
    const record = await prisma.question.findUnique({ where: { id } });
    if (!record) throw new NotFoundError("Question not found");
    return record;
  }

  async function create(data: CreateQuestionInput) {
    return prisma.question.create({ data: data as Prisma.QuestionCreateInput });
  }

  async function update(id: string, data: UpdateQuestionInput) {
    await getById(id);
    return prisma.question.update({ where: { id }, data: data as Prisma.QuestionUpdateInput });
  }

  async function remove(id: string) {
    await getById(id);
    await prisma.question.delete({ where: { id } });
  }

  return { list, getById, create, update, remove };
}
