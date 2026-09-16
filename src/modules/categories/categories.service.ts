import { FastifyInstance } from "fastify";
import { NotFoundError } from "../../utils/errors";
import { CreateCategoryInput, UpdateCategoryInput } from "./categories.schema";

export function buildCategoriesService(fastify: FastifyInstance) {
  const { prisma } = fastify;

  async function list() {
    return prisma.category.findMany({ orderBy: { sortingPriority: "asc" } });
  }

  async function getById(id: string) {
    const record = await prisma.category.findUnique({ where: { id } });
    if (!record) throw new NotFoundError("Category not found");
    return record;
  }

  async function create(data: CreateCategoryInput) {
    return prisma.category.create({ data });
  }

  async function update(id: string, data: UpdateCategoryInput) {
    await getById(id);
    return prisma.category.update({ where: { id }, data });
  }

  async function remove(id: string) {
    await getById(id);
    await prisma.category.delete({ where: { id } });
  }

  return { list, getById, create, update, remove };
}
