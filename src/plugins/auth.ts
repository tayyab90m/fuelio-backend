import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env";
import { isStaff, Role } from "../utils/roles";

export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
  role: Role;
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** preHandler factory: 403 unless the signed-in user has one of `roles`. */
    requireRole: (...roles: Role[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /**
     * preHandler for content modules: reads (GET/HEAD) are open to any signed-in
     * user, everything else needs a staff role (admin/coach) unless the route is
     * marked `config: { allowClients: true }`.
     */
    requireStaffForWrites: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "fastify" {
  interface FastifyContextConfig {
    allowClients?: boolean;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

export default fp(async function authPlugin(fastify: FastifyInstance) {
  fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.ACCESS_TOKEN_TTL },
  });

  fastify.decorate("authenticate", async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.code(401).send({
        error: {
          message: "Missing or invalid access token",
          statusCode: 401,
        },
      });
    }
  });

  const forbidden = (reply: FastifyReply) =>
    reply.code(403).send({
      error: { message: "You do not have permission to perform this action", statusCode: 403 },
    });

  fastify.decorate("requireRole", function requireRole(...roles: Role[]) {
    return async function roleGuard(request: FastifyRequest, reply: FastifyReply) {
      if (!roles.includes(request.user?.role)) return forbidden(reply);
    };
  });

  fastify.decorate("requireStaffForWrites", async function guard(request: FastifyRequest, reply: FastifyReply) {
    if (request.method === "GET" || request.method === "HEAD") return;
    if (request.routeOptions.config?.allowClients) return;
    if (!isStaff(request.user?.role)) return forbidden(reply);
  });
});
