/**
 * Change an existing user's role from the command line - used to create the
 * first admin on a fresh database (the seed is blocked in production):
 *
 *   npm run user:promote -- you@example.com admin
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { isRole, ROLES } from "../utils/roles";

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !isRole(role)) {
    console.error(`Usage: npm run user:promote -- <email> <${ROLES.join("|")}>`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`No user with email ${email}. Register the account first.`);
      process.exit(1);
    }
    await prisma.user.update({ where: { id: user.id }, data: { role, refreshTokenHash: null } });
    console.log(`${email} is now ${role}. They must sign in again.`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
