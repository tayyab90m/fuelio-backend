import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { NotFoundError } from "../../utils/errors";
import { CreateIngredientInput, ListIngredientsQuery, UpdateIngredientInput } from "./ingredients.schema";

export function buildIngredientsService(fastify: FastifyInstance) {
  const { prisma } = fastify;

  const include = { category: true, unit: true } as const;

  async function list(query: ListIngredientsQuery) {
    const where: Prisma.IngredientWhereInput = {};
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.search) where.name = { contains: query.search, mode: "insensitive" };

    return prisma.ingredient.findMany({ where, include, orderBy: { createdAt: "asc" } });
  }

  async function getById(id: string) {
    const record = await prisma.ingredient.findUnique({ where: { id }, include });
    if (!record) throw new NotFoundError("Ingredient not found");
    return record;
  }

  async function create(data: CreateIngredientInput) {
    return prisma.ingredient.create({ data, include });
  }

  async function update(id: string, data: UpdateIngredientInput) {
    await getById(id);
    return prisma.ingredient.update({ where: { id }, data, include });
  }

  async function remove(id: string) {
    await getById(id);
    await prisma.ingredient.delete({ where: { id } });
  }

  return { list, getById, create, update, remove };
}
