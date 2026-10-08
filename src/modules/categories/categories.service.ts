import { FastifyInstance } from "fastify";
import { NotFoundError } from "../../utils/errors";
import { paginationArgs } from "../../utils/pagination";
import { CreateCategoryInput, ListCategoriesQuery, UpdateCategoryInput } from "./categories.schema";

export function buildCategoriesService(fastify: FastifyInstance) {
  const { prisma } = fastify;

  const include = { goals: { select: { id: true, name: true } } } as const;

  async function list(query: ListCategoriesQuery) {
    const [items, total] = await Promise.all([
      prisma.category.findMany({ include, orderBy: { sortingPriority: "asc" }, ...paginationArgs(query) }),
      prisma.category.count(),
    ]);
    return { items, total };
  }

  async function getById(id: string) {
    const record = await prisma.category.findUnique({ where: { id }, include });
    if (!record) throw new NotFoundError("Category not found");
    return record;
  }

  async function create(data: CreateCategoryInput) {
    const { goalIds, ...rest } = data;
    return prisma.category.create({
      data: {
        ...rest,
        goals: goalIds ? { connect: goalIds.map((id) => ({ id })) } : undefined,
      },
      include,
    });
  }

  async function update(id: string, data: UpdateCategoryInput) {
    await getById(id);
    const { goalIds, ...rest } = data;
    return prisma.category.update({
      where: { id },
      data: {
        ...rest,
        goals: goalIds === undefined ? undefined : { set: goalIds.map((goalId) => ({ id: goalId })) },
      },
      include,
    });
  }

  async function remove(id: string) {
    await getById(id);
    await prisma.category.delete({ where: { id } });
  }

  return { list, getById, create, update, remove };
}
