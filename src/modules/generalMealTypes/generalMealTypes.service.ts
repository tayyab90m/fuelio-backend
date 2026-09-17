import { FastifyInstance } from "fastify";
import { NotFoundError } from "../../utils/errors";
import { paginationArgs } from "../../utils/pagination";
import {
  CreateGeneralMealTypeInput,
  ListGeneralMealTypesQuery,
  UpdateGeneralMealTypeInput,
} from "./generalMealTypes.schema";

export function buildGeneralMealTypesService(fastify: FastifyInstance) {
  const { prisma } = fastify;

  async function list(query: ListGeneralMealTypesQuery) {
    const [items, total] = await Promise.all([
      prisma.generalMealType.findMany({ orderBy: { createdAt: "asc" }, ...paginationArgs(query) }),
      prisma.generalMealType.count(),
    ]);
    return { items, total };
  }

  async function getById(id: string) {
    const record = await prisma.generalMealType.findUnique({ where: { id } });
    if (!record) throw new NotFoundError("General meal type not found");
    return record;
  }

  async function create(data: CreateGeneralMealTypeInput) {
    return prisma.generalMealType.create({ data });
  }

  async function update(id: string, data: UpdateGeneralMealTypeInput) {
    await getById(id);
    return prisma.generalMealType.update({ where: { id }, data });
  }

  async function remove(id: string) {
    await getById(id);
    await prisma.generalMealType.delete({ where: { id } });
  }

  return { list, getById, create, update, remove };
}
