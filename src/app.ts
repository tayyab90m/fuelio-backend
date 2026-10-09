import Fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
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
import unitsRoutes from "./modules/units/units.route";
import ingredientsRoutes from "./modules/ingredients/ingredients.route";
import generalMealTypesRoutes from "./modules/generalMealTypes/generalMealTypes.route";
import recipesRoutes from "./modules/recipes/recipes.route";
import mealsRoutes from "./modules/meals/meals.route";
import questionsRoutes from "./modules/questions/questions.route";
import usersRoutes from "./modules/users/users.route";
import dietPlansRoutes from "./modules/dietPlans/dietPlans.route";

const API_PREFIX = "/api/v1";

// Per-app overrides of env-driven settings, mainly so tests can exercise the
// rate limit / registration switch without touching process.env.
export interface AppOverrides {
  authRateLimitMax?: number;
  registrationEnabled?: boolean;
}

export function buildApp(options: FastifyServerOptions = {}, overrides: AppOverrides = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? {
      level: env.NODE_ENV === "test" ? "silent" : "info",
    },
    trustProxy: env.TRUST_PROXY,
    ...options,
  });

  // Core plugins
  app.register(cors, {
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(","),
    // @fastify/cors defaults `methods` to "GET,HEAD,POST" only, which silently
    // fails CORS preflight (and therefore every browser-originated PUT/PATCH/
    // DELETE request - curl/Postman are unaffected since they don't preflight)
    // for the many REST routes in this API that use those verbs.
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
  });
  app.register(helmet);
  app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: "1 minute",
    errorResponseBuilder: (_request, context) =>
      Object.assign(new Error(`Too many requests, please try again in ${context.after}`), { statusCode: context.statusCode }),
  });
  app.register(sensible);
  app.register(errorHandlerPlugin);
  app.register(prismaPlugin);
  app.register(authPlugin);

  // Health check (unauthenticated, outside the versioned API prefix)
  app.get("/health", async () => ({ status: "ok" }));

  // Versioned module routes
  app.register(authRoutes, {
    prefix: `${API_PREFIX}/auth`,
    authRateLimitMax: overrides.authRateLimitMax ?? env.RATE_LIMIT_AUTH_MAX,
    registrationEnabled: overrides.registrationEnabled ?? env.REGISTRATION_ENABLED,
  });
  app.register(activityLevelsRoutes, { prefix: `${API_PREFIX}/activity-levels` });
  app.register(goalsRoutes, { prefix: `${API_PREFIX}/goals` });
  app.register(categoriesRoutes, { prefix: `${API_PREFIX}/categories` });
  app.register(cuisinesRoutes, { prefix: `${API_PREFIX}/cuisines` });
  app.register(unitsRoutes, { prefix: `${API_PREFIX}/units` });
  app.register(ingredientsRoutes, { prefix: `${API_PREFIX}/ingredients` });
  app.register(generalMealTypesRoutes, { prefix: `${API_PREFIX}/general-meal-types` });
  app.register(recipesRoutes, { prefix: `${API_PREFIX}/recipes` });
  app.register(mealsRoutes, { prefix: `${API_PREFIX}/meals` });
  app.register(questionsRoutes, { prefix: `${API_PREFIX}/questions` });
  app.register(usersRoutes, { prefix: `${API_PREFIX}/users` });
  app.register(dietPlansRoutes, { prefix: `${API_PREFIX}/diet-plans` });

  return app;
}
