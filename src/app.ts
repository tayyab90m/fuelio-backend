import Fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { env } from "./config/env";
import prismaPlugin from "./plugins/prisma";
import authPlugin from "./plugins/auth";
import errorHandlerPlugin from "./plugins/errorHandler";

import authRoutes from "./modules/auth/auth.route";
import activityLevelsRoutes from "./modules/activityLevels/activityLevels.route";
import goalsRoutes from "./modules/goals/goals.route";
import categoriesRoutes from "./modules/categories/categories.route";
import cuisinesRoutes from "./modules/cuisines/cuisines.route";

const API_PREFIX = "/api/v1";

export function buildApp(options: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? {
      level: env.NODE_ENV === "test" ? "silent" : "info",
    },
    ...options,
  });

  // Core plugins
  app.register(cors, { origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",") });
  app.register(sensible);
  app.register(errorHandlerPlugin);
  app.register(prismaPlugin);
  app.register(authPlugin);

  // Health check (unauthenticated, outside the versioned API prefix)
  app.get("/health", async () => ({ status: "ok" }));

  // Versioned module routes
  app.register(authRoutes, { prefix: `${API_PREFIX}/auth` });
  app.register(activityLevelsRoutes, { prefix: `${API_PREFIX}/activity-levels` });
  app.register(goalsRoutes, { prefix: `${API_PREFIX}/goals` });
  app.register(categoriesRoutes, { prefix: `${API_PREFIX}/categories` });
  app.register(cuisinesRoutes, { prefix: `${API_PREFIX}/cuisines` });

  return app;
}
