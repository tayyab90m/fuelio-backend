import { FastifyInstance } from "fastify";
import { NotFoundError } from "../../utils/errors";
import { paginationArgs } from "../../utils/pagination";
import { CreateCuisineInput, ListCuisinesQuery, UpdateCuisineInput } from "./cuisines.schema";

export function buildCuisinesService(fastify: FastifyInstance) {
  const { prisma } = fastify;

  async function list(query: ListCuisinesQuery) {
    const [items, total] = await Promise.all([
      prisma.cuisine.findMany({ orderBy: { createdAt: "asc" }, ...paginationArgs(query) }),
      prisma.cuisine.count(),
    ]);
    return { items, total };
  }

  async function getById(id: string) {
    const record = await prisma.cuisine.findUnique({ where: { id } });
    if (!record) throw new NotFoundError("Cuisine not found");
    return record;
  }

  async function create(data: CreateCuisineInput) {
    return prisma.cuisine.create({ data });
  }

  async function update(id: string, data: UpdateCuisineInput) {
    await getById(id);
    return prisma.cuisine.update({ where: { id }, data });
  }

  async function remove(id: string) {
    await getById(id);
    await prisma.cuisine.delete({ where: { id } });
  }

  async function toggleState(id: string) {
    const existing = await getById(id);
    const nextState = existing.state === "active" ? "inactive" : "active";
    return prisma.cuisine.update({ where: { id }, data: { state: nextState } });
  }

  return { list, getById, create, update, remove, toggleState };
}
