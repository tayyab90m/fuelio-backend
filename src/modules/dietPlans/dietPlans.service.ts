import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../utils/errors";
import { paginationArgs } from "../../utils/pagination";
import { calculateDietPlan } from "../questions/dietPlan.service";
import { CreateDietPlanInput, ListDietPlansQuery, UpdateDietPlanInput } from "./dietPlans.schema";

// Keeps a single account from filling the table with snapshots.
export const MAX_PLANS_PER_USER = 50;

interface StoredPlan {
  id: string;
  name: string;
  input: Prisma.JsonValue;
  result: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

const toDto = (plan: StoredPlan) => ({
  id: plan.id,
  name: plan.name,
  input: plan.input,
  result: plan.result,
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt,
});

// The list view only needs the headline numbers, not the whole week.
const toSummary = (plan: StoredPlan) => ({
  id: plan.id,
  name: plan.name,
  macros: (plan.result as { macros?: unknown } | null)?.macros ?? null,
  createdAt: plan.createdAt,
});

export function buildDietPlansService(fastify: FastifyInstance) {
  const { prisma } = fastify;

  async function getOwned(id: string, userId: string) {
    // Someone else's plan is reported as missing, not forbidden, so ids can't be probed.
    const plan = await prisma.dietPlan.findFirst({ where: { id, userId } });
    if (!plan) throw new NotFoundError("Diet plan not found");
    return plan;
  }

  async function list(userId: string, query: ListDietPlansQuery) {
    const [items, total] = await Promise.all([
      prisma.dietPlan.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, ...paginationArgs(query) }),
      prisma.dietPlan.count({ where: { userId } }),
    ]);
    return { items: items.map(toSummary), total };
  }

  async function getById(id: string, userId: string) {
    return toDto(await getOwned(id, userId));
  }

  async function create(userId: string, body: CreateDietPlanInput) {
    if ((await prisma.dietPlan.count({ where: { userId } })) >= MAX_PLANS_PER_USER) {
      throw new ConflictError(`You can keep up to ${MAX_PLANS_PER_USER} saved plans. Delete an old one first.`);
    }

    const { name, ...input } = body;
    const result = await calculateDietPlan(fastify, input);
    const plan = await prisma.dietPlan.create({
      data: {
        userId,
        name: name ?? `Diet plan ${new Date().toISOString().slice(0, 10)}`,
        input: input as Prisma.InputJsonValue,
        result: result as unknown as Prisma.InputJsonValue,
      },
    });
    return toDto(plan);
  }

  async function rename(id: string, userId: string, data: UpdateDietPlanInput) {
    await getOwned(id, userId);
    return toDto(await prisma.dietPlan.update({ where: { id }, data: { name: data.name } }));
  }

  async function remove(id: string, userId: string) {
    await getOwned(id, userId);
    await prisma.dietPlan.delete({ where: { id } });
  }

  return { list, getById, create, rename, remove };
}
