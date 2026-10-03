# DoAll API

NestJS 11 + MongoDB backend for the DoAll app: account registration and login with rotating JWT refresh tokens, plus per-user task storage with filtering, search, stats and the smart sort.

See the [root README](../README.md) for the full feature list, auth flow diagram and API reference. Interactive docs are at `/api/docs` while the server is running.

## Run

```bash
cp .env.example .env        # set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (32+ chars, different)
npm install
npm run start:dev           # http://localhost:3000/api
```

You need a MongoDB instance; `docker compose up -d mongo` from the repo root starts one.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `MONGODB_URI` | `mongodb://localhost:27017/doall` | Database connection string |
| `JWT_ACCESS_SECRET` | — (required) | Signs access tokens |
| `JWT_REFRESH_SECRET` | — (required) | Signs refresh tokens; must differ from the access secret |
| `JWT_ACCESS_TTL` | `15m` | Access token lifetime |
| `JWT_REFRESH_TTL` | `30d` | Refresh token lifetime |
| `TRUST_PROXY` | `0` | Reverse proxies in front of the API (`1` on Render). Lets rate limiting see each client's real IP |

The app refuses to start if a secret is missing, shorter than 32 characters, or reused for both token types.

## Scripts

| Script | |
|---|---|
| `npm run start:dev` | Watch mode |
| `npm run build` / `npm run start:prod` | Compile to `dist/` and run it |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end tests against a real MongoDB (`E2E_MONGODB_URI`, defaults to a local `doall_e2e` database that is dropped afterwards) |
| `npm run lint` / `npm run typecheck` | Static checks |

## Structure

```
src/
├── auth/        controller, service (tokens, rotation, reuse detection), DTOs
├── users/       schema (sessions stored as token hashes) + data access
├── tasks/       controller, service, DTOs, schema, smart ordering
├── common/      global JwtAuthGuard + @Public(), @CurrentUser(), ObjectId pipe, helpers
├── config/      typed configuration and environment validation
├── health/      GET /api/health
├── app.setup.ts global prefix, Helmet, CORS, ValidationPipe (shared with e2e tests)
└── main.ts      bootstrap + Swagger
```

Global guards run in this order: rate limiting (`@nestjs/throttler`), then JWT authentication. Every route is protected unless marked `@Public()`.
