# Fitness Dashboard Backend

A REST API for the Fitness Dashboard app, built with Fastify, TypeScript, Prisma and PostgreSQL.

> **Status: Day 2 of a 3-day build.** This day covers project scaffolding, the
> full database schema (all models needed through Day 4), JWT auth, and full
> CRUD for four reference-data modules. Later days add the remaining
> route modules (ingredients, meals, recipes, units, general meal types,
> questions) on top of the schema that already exists here.

## Stack

- Node.js + [Fastify](https://fastify.dev/) (TypeScript)
- [Prisma ORM](https://www.prisma.io/) + PostgreSQL
- [zod](https://zod.dev/) for request validation
- `@fastify/jwt` for access tokens, `jsonwebtoken` for refresh tokens
- `bcrypt` for password hashing
- Node's built-in test runner (`node --test`) for smoke tests

## Project layout

```
src/
  app.ts                 Builds and configures the Fastify instance (exported for tests)
  server.ts               Imports app.ts and calls .listen()
  config/env.ts            Loads and validates environment variables (zod)
  plugins/
    prisma.ts              Decorates fastify.prisma with a PrismaClient
    auth.ts                 Registers @fastify/jwt and the `authenticate` preHandler
    errorHandler.ts          Global error handler -> {error:{message,statusCode}}
  modules/
    auth/                    register / login / refresh / me
    activityLevels/          CRUD
    goals/                   CRUD + toggle-state
    categories/              CRUD
    cuisines/                CRUD + toggle-state
  utils/
    hash.ts                  bcrypt password hashing + refresh-token hashing
    tokens.ts                 refresh token sign/verify (separate secret from access tokens)
    errors.ts                  AppError / NotFoundError / ConflictError / UnauthorizedError
prisma/
  schema.prisma              Full schema (see "Database schema" below)
  seed.ts                     Seeds a handful of rows per model
tests/
  auth.test.ts                Smoke test: register -> login -> refresh -> /me
```

## Getting started

### 1. Prerequisites

- Node.js 20+ (developed against Node 22)
- npm (or pnpm — both work, this project was set up with npm)
- A PostgreSQL database. Two ways to get one locally:
  - **Docker** (recommended): `docker compose up -d` starts a `postgres:16-alpine`
    container using the included `docker-compose.yml` (db `fitness_dashboard`,
    user/password `postgres`/`postgres`, port `5432`).
  - **Local Postgres install**: create a database yourself and point
    `DATABASE_URL` at it.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
# edit .env — at minimum set DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
```

| Variable              | Required | Default       | Notes                                             |
|------------------------|----------|---------------|----------------------------------------------------|
| `DATABASE_URL`         | yes      | —              | Postgres connection string, e.g. `postgresql://postgres:postgres@localhost:5432/fitness_dashboard?schema=public` |
| `JWT_SECRET`           | yes      | —              | Signs access tokens                                |
| `JWT_REFRESH_SECRET`   | yes      | —              | Signs refresh tokens (must differ from `JWT_SECRET`) |
| `PORT`                 | no       | `3000`         |                                                     |
| `HOST`                 | no       | `0.0.0.0`      |                                                     |
| `NODE_ENV`             | no       | `development`  | `development` \| `test` \| `production`            |
| `ACCESS_TOKEN_TTL`     | no       | `15m`          | Access token lifetime                              |
| `REFRESH_TOKEN_TTL`    | no       | `7d`           | Refresh token lifetime                             |
| `CORS_ORIGIN`          | no       | `*`            | Comma-separated list of allowed origins, or `*`    |

### 4. Run migrations and seed the database

```bash
npm run prisma:generate   # generate the Prisma client
npm run prisma:migrate    # applies prisma/migrations (creates one on first run: --name init)
npm run prisma:seed       # seeds a test user + reference data
```

The seed script is idempotent-ish (upserts the user, skips rows that already
exist by name), so it's safe to re-run.

Seeded test user:

- email: `test@fitnessdashboard.dev`
- password: `Password123!`

### 5. Run the app

```bash
npm run dev     # tsx watch mode, http://localhost:3000
# or
npm run build && npm start   # compiled build
```

`GET /health` returns `{"status":"ok"}` once the server is up.

### 6. Run tests

```bash
npm test
```

`tests/auth.test.ts` boots the real Fastify app (via `buildApp()` + Fastify's
`.inject()`) against whatever `DATABASE_URL` is configured and runs the full
register → duplicate-register(409) → login → bad-password(401) → `/me` →
refresh → unauthenticated `/me`(401) flow. It needs a live, migrated
database — point `.env` at one before running it.

## Auth flow

- `POST /api/v1/auth/register` `{ email, password, name, phoneNumber? }` →
  `201 { user, accessToken, refreshToken }`
- `POST /api/v1/auth/login` `{ email, password }` →
  `200 { user, accessToken, refreshToken }`
- `POST /api/v1/auth/refresh` `{ refreshToken }` →
  `200 { accessToken, refreshToken }` (rotates the refresh token)
- `GET /api/v1/auth/me` with `Authorization: Bearer <accessToken>` →
  `200 { user }`

Access tokens are short-lived JWTs (`ACCESS_TOKEN_TTL`, default 15m) signed
with `JWT_SECRET` via `@fastify/jwt`; the `authenticate` preHandler
(`src/plugins/auth.ts`) verifies them on every protected route and returns a
standard **401** (not a custom status code) on a missing/invalid/expired
token.

Refresh tokens are longer-lived JWTs (`REFRESH_TOKEN_TTL`, default 7d) signed
with a *separate* secret (`JWT_REFRESH_SECRET`) via `jsonwebtoken`. Only a
SHA-256 hash of the current refresh token is ever persisted
(`User.refreshTokenHash`) — the raw token is never stored. Every successful
register/login/refresh rotates and re-persists a new hash, so a leaked
refresh token can only be replayed until the next refresh.

## Entity CRUD modules

All routes below live under `/api/v1` and require `Authorization: Bearer
<accessToken>` (every route in these four modules is protected, including
`GET`/list, for consistency).

- **Activity levels** — `/activity-levels`: `GET /`, `GET /:id`, `POST /`,
  `PUT /:id`, `DELETE /:id`
- **Goals** — `/goals`: same CRUD shape, plus
  `PATCH /goals/:id/toggle-state`. Goals have a many-to-many relation to
  Categories (pass `categoryIds: string[]` on create/update).
- **Categories** — `/categories`: same CRUD shape.
- **Cuisines** — `/cuisines`: same CRUD shape, plus
  `PATCH /cuisines/:id/toggle-state`.

**State convention**: every toggleable entity uses the string values
`"active"` / `"inactive"` for its `state` field. `toggle-state` simply flips
between the two. This convention is used consistently across `ActivityLevel`,
`Goal`, `Category`(implicitly `mealSwapEnabled` is separate), `Cuisine`,
`Ingredient`, `GeneralMealType`, and `Question` in the schema.

### Response / error shape

Successful list/get/create/update responses are wrapped as `{ "data": ... }`.
Errors are always `{ "error": { "message": string, "statusCode": number, "details"?: unknown } }`:

- `400` — validation failure (zod), `details` carries the field errors
- `401` — missing/invalid/expired access token, or bad login credentials
- `404` — resource not found
- `409` — unique constraint conflict (e.g. duplicate email on register)
- `500` — unexpected server error (logged, message not leaked to the client)

## Database schema

`prisma/schema.prisma` is written in full up front so migrations don't
fragment across Days 2-4. Today's modules (auth, activity levels, goals,
categories, cuisines) are fully wired up with routes. The following models
exist in the schema and are seeded/migrated, but do not yet have route
modules — those land in later days:

- `Unit` — canonical unit model (`name`, `short`, `equivalentTo`, `unitType`,
  `system`). **Note:** the frontend currently has its own, separate
  `MealUnitProps` concept for units. This backend's `Unit` model already
  includes the fields needed to represent that (`short`, `equivalentTo`,
  `unitType`, `system`) so that the frontend's unit concept can be
  consolidated into this single canonical model in a later phase. No further
  action is needed here now — this is purely a heads-up for that future
  consolidation work.
- `Ingredient` — has nullable FKs to `Category` and `Unit` already in place.
- `GeneralMealType`, `Meal`, `Recipe` (Recipe is intentionally minimal today —
  just `id`/`name` — Day 3 adds `prepTime`, `cookTime`, `difficulty`,
  `servings`, macros, `instructions` and a `RecipeIngredient` join model).
- `Question` — generic survey/onboarding question model.

## Scripts

| Script                          | Purpose                                      |
|-----------------------------------|-----------------------------------------------|
| `npm run dev`                     | Start the dev server with hot reload (`tsx`)   |
| `npm run build`                   | Compile TypeScript to `dist/`                  |
| `npm start`                       | Run the compiled server (`dist/server.js`)     |
| `npm run prisma:generate`         | Generate the Prisma client                     |
| `npm run prisma:migrate`          | Run `prisma migrate dev` (creates + applies)   |
| `npm run prisma:migrate:deploy`   | Apply existing migrations (CI/production)      |
| `npm run prisma:seed`             | Run `prisma/seed.ts`                           |
| `npm test`                        | Run smoke tests (`node --test`)                |
| `npm run typecheck`               | `tsc --noEmit` across `src`, `tests`, `prisma`  |

## Verification performed during this build

- `npm run typecheck` and `npm run build` both pass cleanly.
- A real PostgreSQL 16 instance was used (no Docker available in the build
  sandbox, so a user-owned local `postgres` cluster was initialized instead
  of the Docker route documented above for normal use) to run
  `prisma migrate dev --name init`, `prisma/seed.ts`, boot the compiled
  server, and run `npm test` — all passed.
- The compiled server was manually exercised end-to-end with `curl`:
  register/login/refresh/me, full CRUD + `toggle-state` on cuisines, a 404 on
  a deleted resource, a 400 on an invalid activity-level payload, and a 409
  on a duplicate email registration all returned the expected status codes
  and bodies.
- In an environment with Docker available, `docker compose up -d` followed by
  the steps in "Getting started" is the intended normal workflow.
