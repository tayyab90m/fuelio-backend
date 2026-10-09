import { FastifyInstance } from "fastify";
import { BadRequestError, ConflictError, NotFoundError } from "../../utils/errors";
import { hashPassword } from "../../utils/hash";
import { paginationArgs } from "../../utils/pagination";
import { toPublicUser } from "../auth/auth.schema";
import { CreateUserInput, ListUsersQuery, UpdateUserInput } from "./users.schema";

export function buildUsersService(fastify: FastifyInstance) {
  const { prisma } = fastify;

  async function getRecord(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError("User not found");
    return user;
  }

  // Never leave the system without an admin who can manage users.
  async function assertNotLastAdmin(user: { id: string; role: string }) {
    if (user.role !== "admin") return;
    const otherAdmins = await prisma.user.count({ where: { role: "admin", id: { not: user.id } } });
    if (otherAdmins === 0) throw new BadRequestError("There must always be at least one admin");
  }

  async function list(query: ListUsersQuery) {
    const where = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { email: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { createdAt: "asc" }, ...paginationArgs(query) }),
      prisma.user.count({ where }),
    ]);
    return { items: items.map(toPublicUser), total };
  }

  async function getById(id: string) {
    return toPublicUser(await getRecord(id));
  }

  async function create(data: CreateUserInput) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictError("A user with this email already exists");
    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        phoneNumber: data.phoneNumber ?? null,
        role: data.role,
        passwordHash: await hashPassword(data.password),
      },
    });
    return toPublicUser(user);
  }

  async function update(id: string, data: UpdateUserInput) {
    const user = await getRecord(id);
    const roleChanged = data.role !== undefined && data.role !== user.role;
    if (roleChanged && user.role === "admin") await assertNotLastAdmin(user);

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...data,
        // A role change must not linger in already-issued sessions: dropping
        // the stored refresh token forces a fresh login (and a token that
        // carries the new role) once the current 15-minute access token ends.
        ...(roleChanged ? { refreshTokenHash: null } : {}),
      },
    });
    return toPublicUser(updated);
  }

  async function remove(id: string, actingUserId: string) {
    if (id === actingUserId) throw new BadRequestError("You cannot delete your own account");
    const user = await getRecord(id);
    await assertNotLastAdmin(user);
    await prisma.user.delete({ where: { id } });
  }

  return { list, getById, create, update, remove };
}
