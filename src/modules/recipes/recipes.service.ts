import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { NotFoundError } from "../../utils/errors";
import { paginationArgs } from "../../utils/pagination";
import { CreateRecipeInput, ListRecipesQuery, RecipeIngredientInput, UpdateRecipeInput } from "./recipes.schema";

export function buildRecipesService(fastify: FastifyInstance) {
  const { prisma } = fastify;

  // GET /recipes/:id expands recipeIngredients -> ingredient/unit/substitutes.
  const detailInclude = {
    recipeIngredients: {
      include: {
        ingredient: true,
        unit: true,
        substitutes: { include: { substituteIngredient: true, unit: true } },
      },
    },
  } satisfies Prisma.RecipeInclude;

  function toRecipeIngredientCreate(ri: RecipeIngredientInput) {
    return {
      minAmount: ri.minAmount,
      baseAmount: ri.baseAmount,
      maxAmount: ri.maxAmount,
      roundAmount: ri.roundAmount,
      ingredient: { connect: { id: ri.ingredientId } },
      unit: { connect: { id: ri.unitId } },
      substitutes: ri.substitutes
        ? {
            create: ri.substitutes.map((sub) => ({
              minAmount: sub.minAmount,
              baseAmount: sub.baseAmount,
              maxAmount: sub.maxAmount,
              roundAmount: sub.roundAmount,
              substituteIngredient: { connect: { id: sub.substituteIngredientId } },
              unit: { connect: { id: sub.unitId } },
            })),
          }
        : undefined,
    } satisfies Prisma.RecipeIngredientCreateWithoutRecipeInput;
  }

  // Includes the same nested expansion as getById - the frontend's recipe
  // list screen computes per-recipe nutrition from recipeIngredients and
  // its edit form needs them populated too. Paginated to keep that nested
  // expansion bounded as recipe counts grow.
  async function list(query: ListRecipesQuery) {
    const [items, total] = await Promise.all([
      prisma.recipe.findMany({
        orderBy: { createdAt: "asc" },
        include: detailInclude,
        ...paginationArgs(query),
      }),
      prisma.recipe.count(),
    ]);
    return { items, total };
  }

  async function getById(id: string) {
    const record = await prisma.recipe.findUnique({ where: { id }, include: detailInclude });
    if (!record) throw new NotFoundError("Recipe not found");
    return record;
  }

  async function create(data: CreateRecipeInput) {
    const { recipeIngredients, ...rest } = data;
    return prisma.recipe.create({
      data: {
        ...rest,
        recipeIngredients: recipeIngredients
          ? { create: recipeIngredients.map(toRecipeIngredientCreate) }
          : undefined,
      },
      include: detailInclude,
    });
  }

  async function update(id: string, data: UpdateRecipeInput) {
    await getById(id);
    const { recipeIngredients, ...rest } = data;

    // recipeIngredients omitted entirely -> leave existing rows untouched.
    if (recipeIngredients === undefined) {
      return prisma.recipe.update({ where: { id }, data: rest, include: detailInclude });
    }

    // recipeIngredients provided (possibly []) -> replace-all: delete every
    // existing RecipeIngredient row for this recipe (cascades to its
    // IngredientSubstitute rows) and recreate from the payload, in one
    // Prisma transaction rather than diffing the old/new sets.
    const [, updated] = await prisma.$transaction([
      prisma.recipeIngredient.deleteMany({ where: { recipeId: id } }),
      prisma.recipe.update({
        where: { id },
        data: {
          ...rest,
          recipeIngredients: { create: recipeIngredients.map(toRecipeIngredientCreate) },
        },
        include: detailInclude,
      }),
    ]);
    return updated;
  }

  async function remove(id: string) {
    await getById(id);
    await prisma.recipe.delete({ where: { id } });
  }

  return { list, getById, create, update, remove };
}
