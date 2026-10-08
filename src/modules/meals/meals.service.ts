import { FastifyInstance } from "fastify";
import { NotFoundError } from "../../utils/errors";
import { paginationArgs } from "../../utils/pagination";
import { CreateMealInput, ListMealsQuery, UpdateMealInput } from "./meals.schema";

export function buildMealsService(fastify: FastifyInstance) {
  const { prisma } = fastify;

  const include = { categories: true, generalMealTypes: true, recipes: true } as const;

  function toIdsRelation(ids?: string[]) {
    if (ids === undefined) return undefined;
    return { set: ids.map((id) => ({ id })) };
  }

  async function list(query: ListMealsQuery) {
    const [items, total] = await Promise.all([
      prisma.meal.findMany({ include, orderBy: { createdAt: "asc" }, ...paginationArgs(query) }),
      prisma.meal.count(),
    ]);
    return { items, total };
  }

  async function getById(id: string) {
    const record = await prisma.meal.findUnique({ where: { id }, include });
    if (!record) throw new NotFoundError("Meal not found");
    return record;
  }

  async function create(data: CreateMealInput) {
    const { categoryIds, generalMealTypeIds, recipeIds, ...rest } = data;
    return prisma.meal.create({
      data: {
        ...rest,
        categories: categoryIds ? { connect: categoryIds.map((id) => ({ id })) } : undefined,
        generalMealTypes: generalMealTypeIds
          ? { connect: generalMealTypeIds.map((id) => ({ id })) }
          : undefined,
        recipes: recipeIds ? { connect: recipeIds.map((id) => ({ id })) } : undefined,
      },
      include,
    });
  }

  async function update(id: string, data: UpdateMealInput) {
    await getById(id);
    const { categoryIds, generalMealTypeIds, recipeIds, ...rest } = data;
    return prisma.meal.update({
      where: { id },
      data: {
        ...rest,
        categories: toIdsRelation(categoryIds),
        generalMealTypes: toIdsRelation(generalMealTypeIds),
        recipes: toIdsRelation(recipeIds),
      },
      include,
    });
  }

  async function remove(id: string) {
    await getById(id);
    await prisma.meal.delete({ where: { id } });
  }

  return { list, getById, create, update, remove };
}
