import { FastifyInstance } from "fastify";
import { Role } from "../src/utils/roles";

/**
 * Public registration always creates a "client". Tests that exercise
 * staff-only endpoints promote the freshly registered user directly in the
 * database and sign a token that carries the new role.
 */
export async function withRole(
  app: FastifyInstance,
  registered: { user: { id: string; email: string } },
  role: Role,
): Promise<string> {
  const { id, email } = registered.user;
  await app.prisma.user.update({ where: { id }, data: { role } });
  return app.jwt.sign({ sub: id, email, role });
}
