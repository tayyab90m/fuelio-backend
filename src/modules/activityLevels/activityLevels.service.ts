import { FastifyInstance } from "fastify";
import { NotFoundError } from "../../utils/errors";
import { CreateActivityLevelInput, UpdateActivityLevelInput } from "./activityLevels.schema";

export function buildActivityLevelsService(fastify: FastifyInstance) {
  const { prisma } = fastify;

  async function list() {
    return prisma.activityLevel.findMany({ orderBy: { createdAt: "asc" } });
  }

  async function getById(id: string) {
    const record = await prisma.activityLevel.findUnique({ where: { id } });
    if (!record) throw new NotFoundError("Activity level not found");
    return record;
  }

  async function create(data: CreateActivityLevelInput) {
    return prisma.activityLevel.create({ data });
  }

  async function update(id: string, data: UpdateActivityLevelInput) {
    await getById(id);
    return prisma.activityLevel.update({ where: { id }, data });
  }

  async function remove(id: string) {
    await getById(id);
    await prisma.activityLevel.delete({ where: { id } });
  }

  return { list, getById, create, update, remove };
}
