import { FastifyInstance } from "fastify";
import { hashPassword, hashToken, verifyPassword, verifyTokenHash } from "../../utils/hash";
import { signRefreshToken, verifyRefreshToken } from "../../utils/tokens";
import { ConflictError, UnauthorizedError } from "../../utils/errors";
import { LoginBody, RefreshBody, RegisterBody, toPublicUser } from "./auth.schema";

export function buildAuthService(fastify: FastifyInstance) {
  const { prisma } = fastify;

  async function issueTokenPair(userId: string, email: string) {
    const accessToken = fastify.jwt.sign({ sub: userId, email });
    const refreshToken = signRefreshToken({ sub: userId });

    await prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hashToken(refreshToken) },
    });

    return { accessToken, refreshToken };
  }

  async function register(body: RegisterBody) {
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw new ConflictError("A user with this email already exists");
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        name: body.name,
        phoneNumber: body.phoneNumber ?? null,
      },
    });

    const tokens = await issueTokenPair(user.id, user.email);
    return { user: toPublicUser(user), ...tokens };
  }

  async function login(body: LoginBody) {
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const tokens = await issueTokenPair(user.id, user.email);
    return { user: toPublicUser(user), ...tokens };
  }

  async function refresh(body: RefreshBody) {
    let payload;
    try {
      payload = verifyRefreshToken(body.refreshToken);
    } catch {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    if (!verifyTokenHash(body.refreshToken, user.refreshTokenHash)) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    // Rotate: issue a brand new access + refresh token pair and replace the
    // stored refresh token hash so the old refresh token can't be reused.
    const tokens = await issueTokenPair(user.id, user.email);
    return tokens;
  }

  async function me(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedError("User no longer exists");
    }
    return toPublicUser(user);
  }

  return { register, login, refresh, me };
}
