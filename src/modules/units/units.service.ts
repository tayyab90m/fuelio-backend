import { FastifyInstance } from "fastify";
import { NotFoundError } from "../../utils/errors";
import { CreateUnitInput, UpdateUnitInput } from "./units.schema";

export function buildUnitsService(fastify: FastifyInstance) {
  const { prisma } = fastify;

  async function list() {
    return prisma.unit.findMany({ orderBy: { createdAt: "asc" } });
  }

  async function getById(id: string) {
    const record = await prisma.unit.findUnique({ where: { id } });
    if (!record) throw new NotFoundError("Unit not found");
    return record;
  }

  async function create(data: CreateUnitInput) {
    return prisma.unit.create({ data });
  }

  async function update(id: string, data: UpdateUnitInput) {
    await getById(id);
    return prisma.unit.update({ where: { id }, data });
  }

  async function remove(id: string) {
    await getById(id);
    await prisma.unit.delete({ where: { id } });
  }

  return { list, getById, create, update, remove };
}
