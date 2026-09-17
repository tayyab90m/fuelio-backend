# Fitness Dashboard Backend

A REST API for the Fitness Dashboard app, built with Fastify, TypeScript, Prisma and PostgreSQL.

> **Status: Day 4 of a 4-day build (complete).** Day 2 covered project
> scaffolding, the full database schema, JWT auth, and CRUD for four
> reference-data modules. Day 3 fleshed out `Recipe` (was `id`/`name` only),
> added the `RecipeIngredient` / `IngredientSubstitute` join models, and
> added CRUD route modules for `Unit`, `Ingredient`, `GeneralMealType`,
> `Recipe` and `Meal`. Day 4 added CRUD for the last remaining schema-only
> model, `Question`, plus the `POST /api/v1/questions/submit-answer`
> diet-plan calculation endpoint (see the disclaimer under "Diet-plan
> calculation" below — it is placeholder business logic, not a finished
> nutrition algorithm).
>
> **The Day 2 `FST_ERR_PLUGIN_VERSION_MISMATCH` boot issue is fixed.** Commit
> `90cc735` upgraded Fastify core to `^5.12.5` (from `^4.28.1`) to match the
> `@fastify/jwt@^10` requirement introduced in commit `c2b706e`'s CVE patch.
> The compiled server boots normally, `npm test` runs real HTTP-level smoke
> tests via Fastify's `.inject()`, and `npm audit` reports **0
> vulnerabilities**. All verification below (Days 2-4) was re-confirmed
> against this fixed, HTTP-level-testable state.

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
    units/                   CRUD
    ingredients/             CRUD + list filters (categoryId, search)
    generalMealTypes/        CRUD (routes at /general-meal-types)
    recipes/                 CRUD + nested recipeIngredients (replace-all)
    meals/                   CRUD + M2M wiring (replace-all)
    questions/               CRUD + POST /submit-answer (placeholder diet-plan calculation)
  utils/
    hash.ts                  bcrypt password hashing + refresh-token hashing
    tokens.ts                 refresh token sign/verify (separate secret from access tokens)
    errors.ts                  AppError / NotFoundError / ConflictError / UnauthorizedError
prisma/
  schema.prisma              Full schema (see "Database schema" below)
  seed.ts                     Seeds a handful of rows per model
tests/
  auth.test.ts                Smoke test: register -> login -> refresh -> /me
  activityLevels.test.ts       HTTP-level CRUD smoke test for activityLevels
  questions.test.ts            Question CRUD + submit-answer smoke tests (valid input,
                                extra-field echo, unknown-id 404s, malformed-body 400, 401)
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
- **Units** — `/units`: same CRUD shape (`GET /`, `GET /:id`, `POST /`,
  `PUT /:id`, `DELETE /:id`). No `state` field.
- **Ingredients** — `/ingredients`: same CRUD shape. `GET /` accepts optional
  query params `categoryId` (exact match) and `search` (case-insensitive
  `contains` on `name`), e.g. `GET /ingredients?categoryId=<uuid>&search=chicken`.
  Responses include the related `category` and `unit`.
- **General meal types** — `/general-meal-types`: same CRUD shape. **Design
  decision:** the model is `GeneralMealType` but the route path uses the
  shorter, REST-conventional `/general-meal-types` rather than
  `/generalMealTypes` or `/meal-types`, for consistency with the kebab-case
  used by every other route prefix in this API (`/activity-levels`, etc.).
- **Recipes** — `/recipes`: same CRUD shape. `POST`/`PUT` accept a nested
  `recipeIngredients: [{ ingredientId, unitId, minAmount, baseAmount,
  maxAmount, roundAmount, substitutes?: [{ substituteIngredientId, unitId,
  minAmount, baseAmount, maxAmount, roundAmount }] }]` array — each
  substitute carries its **own** amounts/unit (added after the initial Day 3
  build, which gave `IngredientSubstitute` no amount fields at all and left
  the frontend approximating with the parent recipeIngredient's values; a
  substitute is rarely a 1:1 gram swap in practice, e.g. turkey breast vs.
  chicken breast at equivalent protein). `GET /recipes/:id` expands each
  `recipeIngredient` with its `ingredient`, `unit`, and `substitutes` (each
  with its own `substituteIngredient` and `unit`). **Design decision —
  replace-all semantics:** on `PUT`, if `recipeIngredients` is
  present in the body (including `[]`), every existing `RecipeIngredient` row
  for that recipe is deleted (cascading to its `IngredientSubstitute` rows)
  and recreated from the payload inside one `prisma.$transaction`, rather
  than diffing old vs. new rows. If `recipeIngredients` is omitted from the
  body entirely, existing rows are left untouched. The same convention
  applies to `Meal`'s M2M arrays below.
- **Meals** — `/meals`: same CRUD shape. `POST`/`PUT` accept
  `categoryIds: string[]`, `generalMealTypeIds: string[]`,
  `recipeIds: string[]`; `POST` uses `connect`, `PUT` uses `set` (Prisma's
  many-to-many replace-all) when the corresponding field is present in the
  body, and leaves that relation untouched when the field is omitted.
  `GET /meals/:id` expands `categories`, `generalMealTypes`, and `recipes`.
- **Questions** — `/questions`: same CRUD shape (`GET /`, `GET /:id`,
  `POST /`, `PUT /:id`, `DELETE /:id`). `text` and `questionType` are plain
  strings; `options` is a free-form JSON value whose shape depends on
  `questionType` (e.g. `[{ label, value }]` for a multiple-choice question) —
  it is required on create (validated at runtime, since zod's `any`/`unknown`
  schemas don't mark a field required by default) and left as-is on partial
  updates. Also exposes `POST /questions/submit-answer` — see "Diet-plan
  calculation" below.

**State convention**: every toggleable entity uses the string values
`"active"` / `"inactive"` for its `state` field. `toggle-state` simply flips
between the two. This convention is used consistently across `ActivityLevel`,
`Goal`, `Category`(implicitly `mealSwapEnabled` is separate), `Cuisine`,
`Ingredient`, `GeneralMealType`, and `Question` in the schema. `Unit`, `Recipe`,
`RecipeIngredient` and `IngredientSubstitute` have no `state` field.

### Response / error shape

Successful list/get/create/update responses are wrapped as `{ "data": ... }`.
Errors are always `{ "error": { "message": string, "statusCode": number, "details"?: unknown } }`:

- `400` — validation failure (zod), `details` carries the field errors
- `401` — missing/invalid/expired access token, or bad login credentials
- `404` — resource not found
- `409` — unique constraint conflict (e.g. duplicate email on register)
- `500` — unexpected server error (logged, message not leaked to the client)

### Diet-plan calculation — `POST /api/v1/questions/submit-answer`

> **Placeholder business logic — not a finished nutrition algorithm.** There
> is no real product/nutrition specification for this calculation yet. This
> endpoint exists so the frontend has a working, correctly-shaped response
> while the real formula is designed. Specifically **provisional** and
> subject to change before this ships to real users:
> - The BMR/TDEE formula (Mifflin-St Jeor + `ActivityLevel.multiplier`,
>   adjusted by `Goal.calorieAdjustment`) is a reasonable, well-known
>   baseline, but has not been reviewed by anyone with nutrition/product
>   expertise for this product's specific goals.
> - The `macrosDistribution` meal-timing split (Breakfast/Lunch/Dinner/Snack
>   at 25/30/30/15%, see `MEAL_TIMING_TEMPLATE` in
>   `src/modules/questions/dietPlan.service.ts`) is an arbitrary,
>   roughly-even illustrative split — it is **not** derived from each
>   `GeneralMealType`'s own protein/carbs/fats percentages or any nutrition
>   research.
> - `mealFramework`'s shape (currently a plain descriptive string) is a
>   placeholder; a real implementation may want a structured object instead.
> - `errors` is always `[]` on a successful (`200`) response today —
>   invalid input instead throws (`400` for a zod validation failure, `404`
>   for an unknown `activityLevelId`/`goalId`). The field is reserved for
>   future soft-validation / partial-failure cases the real spec may need.
>
> See the comment block at the top of `calculateDietPlan` in
> `src/modules/questions/dietPlan.service.ts` for the same disclaimer in
> context with the code.

**Request** — `POST /api/v1/questions/submit-answer` (requires
`Authorization: Bearer <accessToken>` like every other route):

```jsonc
{
  "age": 28,
  "sex": "male",           // "male" | "female"
  "heightCm": 180,
  "weightKg": 82,
  "activityLevelId": "<uuid of a real ActivityLevel row>",
  "goalId": "<uuid of a real Goal row>"
  // any additional fields (e.g. answers to other onboarding questions) are
  // accepted and echoed back verbatim in `userAnswers` — the schema uses
  // zod's `.passthrough()`.
}
```

`activityLevelId`/`goalId` that aren't valid UUIDs → `400`; valid UUIDs that
don't match an existing row → `404`.

**Response** — `200`:

```jsonc
{
  "userAnswers": { /* echo of the full request body, including passthrough fields */ },
  "macros": { "calories": 3226, "protein": 282, "fat": 72, "carbs": 363 },
  "macrosDistribution": [
    {
      "name": "Breakfast",
      "timing": "07:00-09:00",
      "description": "First meal of the day",
      "macros": { "calories": 807, "protein": 71, "fat": 18, "carbs": 91 }
    }
    // ...Lunch, Dinner, Snack
  ],
  "mealFramework": "A 4-meal framework (Breakfast, Lunch, Dinner, Snack) targeting roughly 3226 kcal/day ...",
  "errors": []
}
```

Calculation, in order: Mifflin-St Jeor BMR (male:
`10*weightKg + 6.25*heightCm - 5*age + 5`; female: `... - 5*age - 161`) →
TDEE (`BMR * ActivityLevel.multiplier`) → adjusted calories
(`Goal.calorieAdjustment` applied: `increase`/`decrease` scale TDEE by
`± percentage%`, `maintain` leaves it unchanged) → macros in grams from
`Goal.macroRatios` percentages (`protein_g = adjustedCalories * protein% / 4`,
`carbs_g = adjustedCalories * carbs% / 4`, `fat_g = adjustedCalories * fats% / 9`).

## Full endpoint reference

Every route below lives under `/api/v1` (e.g. `/api/v1/auth/register`) except
`GET /health`, and every route except the four `auth` routes requires
`Authorization: Bearer <accessToken>`.

| Module | Method & path | Notes |
|---|---|---|
| — | `GET /health` | Unauthenticated health check → `{"status":"ok"}` |
| Auth | `POST /auth/register` | `{ email, password, name, phoneNumber? }` → `201` |
| Auth | `POST /auth/login` | `{ email, password }` → `200` |
| Auth | `POST /auth/refresh` | `{ refreshToken }` → `200`, rotates the refresh token |
| Auth | `GET /auth/me` | → `200 { user }` |
| Activity levels | `GET /activity-levels` | list |
| Activity levels | `GET /activity-levels/:id` | |
| Activity levels | `POST /activity-levels` | |
| Activity levels | `PUT /activity-levels/:id` | |
| Activity levels | `DELETE /activity-levels/:id` | |
| Goals | `GET /goals` | list, includes `categories` |
| Goals | `GET /goals/:id` | |
| Goals | `POST /goals` | `categoryIds?: string[]` |
| Goals | `PUT /goals/:id` | |
| Goals | `DELETE /goals/:id` | |
| Goals | `PATCH /goals/:id/toggle-state` | flips `active`/`inactive` |
| Categories | `GET /categories` | list |
| Categories | `GET /categories/:id` | |
| Categories | `POST /categories` | |
| Categories | `PUT /categories/:id` | |
| Categories | `DELETE /categories/:id` | |
| Cuisines | `GET /cuisines` | list |
| Cuisines | `GET /cuisines/:id` | |
| Cuisines | `POST /cuisines` | |
| Cuisines | `PUT /cuisines/:id` | |
| Cuisines | `DELETE /cuisines/:id` | |
| Cuisines | `PATCH /cuisines/:id/toggle-state` | flips `active`/`inactive` |
| Units | `GET /units` | list |
| Units | `GET /units/:id` | |
| Units | `POST /units` | |
| Units | `PUT /units/:id` | |
| Units | `DELETE /units/:id` | |
| Ingredients | `GET /ingredients` | optional `?categoryId=&search=` |
| Ingredients | `GET /ingredients/:id` | includes `category`, `unit` |
| Ingredients | `POST /ingredients` | |
| Ingredients | `PUT /ingredients/:id` | |
| Ingredients | `DELETE /ingredients/:id` | |
| General meal types | `GET /general-meal-types` | list |
| General meal types | `GET /general-meal-types/:id` | |
| General meal types | `POST /general-meal-types` | |
| General meal types | `PUT /general-meal-types/:id` | |
| General meal types | `DELETE /general-meal-types/:id` | |
| Recipes | `GET /recipes` | list |
| Recipes | `GET /recipes/:id` | expands `recipeIngredients` -> `ingredient`/`unit`/`substitutes` |
| Recipes | `POST /recipes` | optional nested `recipeIngredients[]` |
| Recipes | `PUT /recipes/:id` | replace-all `recipeIngredients` semantics if present |
| Recipes | `DELETE /recipes/:id` | |
| Meals | `GET /meals` | list, includes `categories`/`generalMealTypes`/`recipes` |
| Meals | `GET /meals/:id` | |
| Meals | `POST /meals` | `categoryIds?`/`generalMealTypeIds?`/`recipeIds?` (connect) |
| Meals | `PUT /meals/:id` | same M2M fields (replace-all `set` semantics if present) |
| Meals | `DELETE /meals/:id` | |
| Questions | `GET /questions` | list |
| Questions | `GET /questions/:id` | |
| Questions | `POST /questions` | `{ text, questionType, options, state? }` |
| Questions | `PUT /questions/:id` | |
| Questions | `DELETE /questions/:id` | |
| Questions | `POST /questions/submit-answer` | **Day 4 placeholder diet-plan calculation** — see below |

## Database schema

`prisma/schema.prisma` is written in full up front so migrations don't
fragment across Days 2-4. As of Day 4, every model in the schema has a route
module wired up.

- `Unit` — canonical unit model (`name`, `short`, `equivalentTo`, `unitType`,
  `system`). **Note:** the frontend currently has its own, separate
  `MealUnitProps` concept for units. This backend's `Unit` model already
  includes the fields needed to represent that (`short`, `equivalentTo`,
  `unitType`, `system`) so that the frontend's unit concept can be
  consolidated into this single canonical model in a later phase. No further
  action is needed here now — this is purely a heads-up for that future
  consolidation work.
- `Ingredient` — has nullable FKs to `Category` and `Unit`, plus (Day 3) a
  `recipeIngredients` back-relation and a `substituteFor` back-relation (used
  when this ingredient is listed as a substitute on someone else's recipe
  line).
- `GeneralMealType` — fully fielded, M2M with `Meal`.
- `Meal` — fully fielded, M2M with `Category`, `GeneralMealType`, and
  `Recipe`.
- `Recipe` (Day 3) — fleshed out from the Day 2 `id`/`name` stub to add
  `description`, `prepTime`, `cookTime`, `difficulty`, `servings`, `calories`,
  `protein`, `carbs`, `fat`, `instructions` (JSON array of step strings), and
  a `recipeIngredients` relation.
- `RecipeIngredient` (Day 3, new) — join between `Recipe` and `Ingredient`
  with per-recipe amounts (`minAmount`, `baseAmount`, `maxAmount`,
  `roundAmount`) and a `unitId` FK. `onDelete: Cascade` from `Recipe`, so
  deleting a recipe deletes its recipe-ingredient lines.
- `IngredientSubstitute` (Day 3, new; amounts added in a later migration) —
  says "ingredient X can substitute for the ingredient on this specific
  `RecipeIngredient` line," with its own `minAmount`/`baseAmount`/
  `maxAmount`/`roundAmount`/`unitId` independent of the parent
  `RecipeIngredient`'s amounts. `onDelete: Cascade` from `RecipeIngredient`.
- `Question` (Day 4) — generic survey/onboarding question model (`text`,
  `questionType`, `options` JSON, `state`). Full CRUD at `/questions`, plus
  the placeholder `POST /questions/submit-answer` diet-plan calculation
  (uses `ActivityLevel.multiplier` and `Goal.calorieAdjustment`/
  `Goal.macroRatios`, not `Question` rows themselves — see "Diet-plan
  calculation" above).

Migration `20260916075732_day3_relations` (see `prisma/migrations/`) applies
the above; it was a pure additive migration (new columns on `recipes`, two
new tables) since `recipes` was still empty at the time. `Question` needed
**no new Day 4 migration** — the `questions` table was already created by
the very first `20260916075029_init` migration back on Day 2 (the model was
written into `schema.prisma` up front, per the note at the top of that
file); Day 4 only added the route/service/schema code on top of it.

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

### Day 2

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

### Day 3

- `npm run typecheck` and `npm run build` both pass cleanly with the new
  `units`, `ingredients`, `generalMealTypes`, `recipes`, and `meals` modules
  registered in `src/app.ts`.
- Docker was still unavailable in this build sandbox; a reachable local
  PostgreSQL 16 instance was found already running on the standard port
  (`127.0.0.1:5432`, `postgres`/`postgres`), so a `fitness_dashboard`
  database was created on it, `.env`'s `DATABASE_URL` was pointed at it, and
  `prisma migrate dev --name day3_relations` was run for real against it —
  it applied cleanly (see `prisma/migrations/20260916075732_day3_relations/`).
  `prisma/seed.ts` was then re-run and seeded the new Day 3 rows (4 units, 5
  ingredients linked to categories/units, 3 general meal types, 1 recipe with
  3 recipe-ingredient lines including one substitute, 1 meal wiring
  categories + a general meal type + the recipe) on top of the existing Day
  2 seed data.
- **HTTP-level `curl` verification was not possible**: the compiled server
  (and `npm test`) currently fail to boot at all — this reproduces
  identically on a clean `main` checkout before any Day 3 change, so it is a
  pre-existing Day 2 regression, not something Day 3 introduced (see the
  "Known issue" callout near the top of this file). Because of that, Day 3
  was instead verified with an ad-hoc script run via `tsx` against the real,
  migrated, seeded database using the actual `PrismaClient`, exercising the
  same query/mutation shapes the new service modules use: `ingredients`
  list filtering by `categoryId` and case-insensitive `search`; creating a
  `Recipe` with two nested `recipeIngredients` (one with a
  `substituteIngredient`) and confirming `GET`-style fetch-back expands
  `ingredient`/`unit`/`substitutes.substituteIngredient`; the replace-all
  update path (`recipeIngredient.deleteMany` + recreate in one
  `$transaction`), confirming the old rows are gone, the old
  `IngredientSubstitute` row cascaded away, and only the new row remains;
  creating a `Meal` wired to two categories, a general meal type, and the
  recipe, confirming the expanded response; and the M2M replace-all `set`
  path on `Meal.categories`. All checks passed. This validates the Day 3
  schema, migration, and query/mutation shapes end-to-end against Postgres,
  but does **not** validate the zod request-validation layer or HTTP status
  codes/error shapes for the new routes — those were reviewed by hand
  against the same pattern used by the already-verified Day 2 modules
  (`goals`, `cuisines`) instead.

### Day 4

- `npm run typecheck` and `npm run build` both pass cleanly with the new
  `questions` module (CRUD + `submit-answer`) registered in `src/app.ts`.
- The same local PostgreSQL 16 instance from Day 3 (`127.0.0.1:5432`,
  `postgres`/`postgres`, database `fitness_dashboard`) was reachable and
  already migrated — `Question` needed no new migration (see "Database
  schema" above), so no `prisma migrate dev` run was required this time.
  `npx prisma migrate status` confirmed "Database schema is up to date!"
  and `npx prisma db execute` against `questions` confirmed the table was
  live. `prisma/seed.ts` was re-run (idempotent) and confirmed the existing
  Day 2 activity-level/goal seed data (4 activity levels, 3 goals with
  realistic `calorieAdjustment`/`macroRatios`) was already sufficient for
  `submit-answer` — no seed changes were needed.
- `npm test` passes **26/26** (up from 6/6): the existing 6 auth tests, plus
  7 new HTTP-level CRUD smoke tests for `activityLevels` (a Day 2 module
  that previously had no HTTP-level test coverage), plus 13 new tests in
  `tests/questions.test.ts` covering full `Question` CRUD (create, get,
  list, update, 400-on-invalid-payload, delete, 401-without-token) and
  `submit-answer` (valid-input sane-macro-numbers, extra-field echo via
  `userAnswers`, 404 on an unknown `activityLevelId`, 404 on an unknown
  `goalId`, 400 on a malformed body, 401 without a token).
- `npm audit` reports **0 vulnerabilities**.
- The compiled server (`npm run build && node dist/server.js`) was booted
  for real and exercised end-to-end with `curl` against the seeded
  database: login as the seeded test user, fetch a real `activityLevelId`
  (`Moderately Active`, multiplier `1.55`) and `goalId` (`Muscle Gain`,
  `{type: "increase", percentage: 15}` / `{fats: 20, carbs: 45, protein: 35}`)
  from their real list endpoints, then `POST /api/v1/questions/submit-answer`
  with `{age: 28, sex: "male", heightCm: 180, weightKg: 82, activityLevelId,
  goalId}`. Response: `macros: {calories: 3226, protein: 282, fat: 72,
  carbs: 363}` plus a 4-entry `macrosDistribution` and a `mealFramework`
  string — hand-verified against the formula (BMR `1810` → TDEE
  `1810 * 1.55 = 2805.5` → `+15%` = `3226.325` → rounds to `3226`; macros
  split 35/45/20 protein/carbs/fats of that calorie figure). Also curled the
  404 case (unknown `activityLevelId`), the 400 case (invalid `sex` enum +
  non-UUID `activityLevelId`), the 401 case (no `Authorization` header), and
  a full `Question` create → delete round trip — all returned the expected
  status codes and bodies. The server was then stopped.
