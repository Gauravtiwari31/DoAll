# DoAll API

NestJS 11 + MongoDB backend for the DoAll app: accounts with email and password or Sign in with Google, rotating JWT refresh tokens, plus per-user task storage with filtering, search, stats and the smart sort.

See the [root README](../README.md) for the full feature list, auth flow diagram and API reference. Interactive docs are at `/api/docs` while the server is running.

It also serves two public web pages that the Google Play listing links to, outside the `/api` prefix:

| Page | |
|---|---|
| `GET /privacy` | Privacy policy |
| `GET /account/delete` | Account deletion: explains what is deleted and has a form (email, password, confirmation) that posts to `POST /account/delete`. With `GOOGLE_CLIENT_SECRET` set, a second form, **Signed up with Google?**, posts to `POST /account/delete/google`, which sends the browser to Google; Google returns it to `GET /account/delete/google/callback`, which deletes the account Google confirms |

Signed-in users can also delete their account from the app with `DELETE /api/auth/me` and their password, or a fresh Google ID token for an account without a password (`403` if it doesn't match). Either way the user's tasks are deleted first, then the user document with every session. The pages are plain server-rendered HTML (no JavaScript), errors on them are shown as HTML too, and the forms have the same rate limit as login. The Google form only works from the page itself (`Sec-Fetch-Site`/`Origin` check), and a short-lived cookie carries the OAuth `state` and `nonce` to the callback.

## Sign in with Google

`POST /api/auth/google` takes an ID token that the app got from Google, checks it with Google's keys ([`google-identity.service.ts`](src/auth/google-identity.service.ts), using `google-auth-library`) and signs the user in, creating the account the first time. If an email/password account already has that address, it answers `409` with `code: "GOOGLE_LINK_PASSWORD_REQUIRED"` until the request includes that account's `password`, then connects the two. It's off (`501`) until `GOOGLE_CLIENT_ID` is set; setting up the OAuth clients is described in [docs/google-sign-in.md](../docs/google-sign-in.md).

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
| `TRUST_PROXY` | `0` | Reverse proxies in front of the API (`1` on Render). Lets rate limiting see each client's real IP, and the Google callback see `https` |
| `GOOGLE_CLIENT_ID` | — (off) | Client ID of the Google OAuth client of type *Web application*. Turns on Sign in with Google |
| `GOOGLE_CLIENT_SECRET` | — (off) | That client's secret. Only the web page's **Signed up with Google?** deletion needs it |

The app refuses to start if a secret is missing, shorter than 32 characters, or reused for both token types, or if `GOOGLE_CLIENT_ID` isn't an OAuth client ID.

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
├── auth/        controller, service (tokens, rotation, reuse detection, Google sign-in), Google token checks, DTOs
├── users/       schema (sessions stored as token hashes) + data access
├── tasks/       controller, service, DTOs, schema, smart ordering
├── common/      global JwtAuthGuard + @Public(), @CurrentUser(), ObjectId pipe, helpers
├── config/      typed configuration and environment validation
├── health/      GET /api/health
├── legal/       public HTML pages: privacy policy, account deletion incl. "delete with Google" (text in legal.constants.ts / legal.views.ts)
├── app.setup.ts global prefix, Helmet, CORS, ValidationPipe (shared with e2e tests)
└── main.ts      bootstrap + Swagger
```

Global guards run in this order: rate limiting (`@nestjs/throttler`), then JWT authentication, which also checks that the token's account still exists (so a deleted account's unexpired token is refused). Every route is protected unless marked `@Public()`.
