import { FastifyInstance } from "fastify";
import { NotFoundError } from "../../utils/errors";
import { CreateGoalInput, UpdateGoalInput } from "./goals.schema";

export function buildGoalsService(fastify: FastifyInstance) {
  const { prisma } = fastify;

  const include = { categories: true } as const;

  async function list() {
    return prisma.goal.findMany({ include, orderBy: { createdAt: "asc" } });
  }

  async function getById(id: string) {
    const record = await prisma.goal.findUnique({ where: { id }, include });
    if (!record) throw new NotFoundError("Goal not found");
    return record;
  }

  function toCategoriesRelation(categoryIds?: string[]) {
    if (categoryIds === undefined) return undefined;
    return { set: categoryIds.map((id) => ({ id })) };
  }

  async function create(data: CreateGoalInput) {
    const { categoryIds, ...rest } = data;
    return prisma.goal.create({
      data: {
        ...rest,
        categories: categoryIds ? { connect: categoryIds.map((id) => ({ id })) } : undefined,
      },
      include,
    });
  }

  async function update(id: string, data: UpdateGoalInput) {
    await getById(id);
    const { categoryIds, ...rest } = data;
    return prisma.goal.update({
      where: { id },
      data: {
        ...rest,
        categories: toCategoriesRelation(categoryIds),
      },
      include,
    });
  }

  async function remove(id: string) {
    await getById(id);
    await prisma.goal.delete({ where: { id } });
  }

  async function toggleState(id: string) {
    const existing = await getById(id);
    const nextState = existing.state === "active" ? "inactive" : "active";
    return prisma.goal.update({ where: { id }, data: { state: nextState }, include });
  }

  return { list, getById, create, update, remove, toggleState };
}
