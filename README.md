# DoAll

**A to-do app with opinions about what you should do next.**

[![CI](https://github.com/Gauravtiwari31/DoAll/actions/workflows/ci.yml/badge.svg)](https://github.com/Gauravtiwari31/DoAll/actions/workflows/ci.yml)
[![Android build](https://github.com/Gauravtiwari31/DoAll/actions/workflows/android-apk.yml/badge.svg)](https://github.com/Gauravtiwari31/DoAll/actions/workflows/android-apk.yml)

DoAll is an Android app built with the React Native CLI and TypeScript, backed by a NestJS + MongoDB REST API. You sign up, add tasks with a schedule, deadline and priority, and DoAll's *smart sort* weighs all three to put the right task on top — then tells you why.

![DoAll screens](docs/preview.png)

<p align="center"><sub>Welcome · Today · Task detail · New task · Dark mode</sub></p>

<details>
<summary><b>More screens</b></summary>

![More DoAll screens](docs/more-screens.png)

<p align="center"><sub>Log in (with server error) · Sign up · Sort &amp; filter · Profile &amp; stats · Dark detail</sub></p>
</details>

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
  - [Install the APK](#install-the-apk)
- [Deploy the backend (free)](#deploy-the-backend-free)
- [Publishing on Google Play](#publishing-on-google-play)
- [How it works](#how-it-works)
  - [Smart sort](#smart-sort)
  - [Authentication flow](#authentication-flow)
  - [State management](#state-management)
  - [Design language](#design-language)
- [API reference](#api-reference)
- [Testing](#testing)
- [Notes & trade-offs](#notes--trade-offs)

---

## Features

### Core (from the brief)

| | |
|---|---|
| **Register / log in** | Email + password accounts, or **Continue with Google**. Inline validation that mirrors the server rules, password strength meter, friendly server errors. |
| **Add tasks** | Title, description, **date-time** (when you'll do it), **deadline**, **priority** — plus category and tags. One-tap presets (*Tonight*, *Tomorrow*, *In 3 days*…) or the native Android date & time pickers. |
| **Complete tasks** | Tick the checkbox, **swipe right**, or use the detail screen. Every completion can be undone. |
| **Delete tasks** | **Swipe left** (with an *Undo* toast) or delete from the detail screen (with confirmation). |
| **See status at a glance** | Open / overdue / done, live "Due in 3h" / "2d late" countdowns, a red shadow on overdue cards, and today's progress ring. |
| **Backend** | NestJS REST API with MongoDB (Mongoose) for users and tasks. |

### Bonus

- **Works offline** — tasks live in an on-device SQLite database and sync with the server in the background: last write wins per task, deletions spread to every device, and nothing typed offline is lost ([how sync works](#offline-first-sync)).
- **Reminders** — local notifications at the task's time or up to a day before, scheduled by the phone itself, so they work offline and survive a restart. **Profile → Reminders not arriving?** checks the settings that silence them (notifications, exact alarms, battery savers, with tips for Xiaomi, Oppo, Vivo, Samsung and others).
- **Repeating tasks** — hourly, daily, weekdays, weekly on chosen days, monthly, yearly, every N of them, at the same local time across daylight saving changes. Ticking one off moves it to its next time.
- **Email confirmation & password reset** — by email links, when the server has an email service ([setup](docs/operations.md#2-email-confirmation-and-password-reset)).
- **Export my data** — saves every task as a JSON file wherever the user chooses.
- **Crash reports** — Sentry in the app and the server, off unless given a DSN ([setup](docs/operations.md#4-crash-reports-with-sentry)).
- **Smart sort** — blends priority, deadline pressure and schedule into one score ([formula below](#smart-sort)). The top task gets an **Up next** badge, and each task's detail screen shows a **"Why it's ranked here"** bar that breaks its score down.
- **Four more sort orders** — deadline, scheduled time, priority, newest.
- **Filtering & search** — quick views (*All, Today, Upcoming, Overdue, Done*) with live counts, priority and category filters, and search across titles, notes and `#tags`.
- **Categories & tags** — six colour-coded categories plus up to five free-form tags per task.
- **Dashboard** — today's progress ring, overdue count and the recommended next task on the home screen; totals, completion rate and an open-tasks-by-category chart on the profile screen.
- **Light, dark & system themes**, persisted on the device.
- **Feels fast** — every change is saved on the phone first, so the list updates instantly; pull-to-refresh syncs, cards animate and finishing something gives a haptic tick.
- **Hardened auth** — short-lived access tokens, rotating refresh tokens with reuse detection, rate limiting on credential endpoints, and a session that survives app restarts.
- **Sign in with Google** — through Android's Credential Manager, verified on the server against Google's keys; an existing email account is connected only after its password is given once ([setup](docs/google-sign-in.md)).
- **Housekeeping** — bulk "clear completed", discard-changes guard on the editor, Swagger docs for the API.
- **Privacy controls** — delete your account and every task from **Profile → Delete account** or on the [web](https://doall-api-m1yy.onrender.com/account/delete), confirming with the password or with Google; the [privacy policy](https://doall-api-m1yy.onrender.com/privacy) is linked from sign-up and the profile screen.

---

## Tech stack

| Layer | Choice |
|---|---|
| Mobile | React Native **0.87** (CLI, New Architecture) · TypeScript · React 19 |
| Navigation | React Navigation 7 (native stack) |
| State | **Redux Toolkit** (slices, entity adapter, memoised selectors, listener middleware) + React Redux |
| Networking | Axios with auth / refresh interceptors |
| UI | Hand-built design system on `react-native-svg`; Bricolage Grotesque, IBM Plex Mono and Instrument Serif fonts |
| Storage | AsyncStorage (session + preferences) |
| Backend | **NestJS 11** · Mongoose 8 / **MongoDB 7** · JWT · bcrypt · class-validator · Helmet · Throttler · Swagger |
| Tests | Jest (+ ts-jest, Supertest, react-test-renderer) |
| Tooling | ESLint, Prettier, Docker Compose |

---

## Repository layout

```
.
├── backend/                     NestJS API
│   ├── src/
│   │   ├── auth/                register · login · refresh · logout · me
│   │   ├── users/               user schema + data access
│   │   ├── tasks/               CRUD, filters, stats, smart ordering
│   │   ├── common/              global JWT guard, decorators, pipes, utils
│   │   ├── config/              typed config + env validation
│   │   ├── health/              liveness endpoint
│   │   ├── legal/               public pages: privacy policy, account deletion
│   │   ├── app.module.ts        wiring (Mongo, guards, throttling)
│   │   └── main.ts              bootstrap + Swagger
│   ├── test/                    end-to-end tests (real MongoDB)
│   └── Dockerfile
├── mobile/                      React Native app (Android)
│   ├── android/                 native project (fonts, icon, splash, theme, release signing)
│   ├── fastlane/metadata/       Google Play listing: text, icon, feature graphic, screenshots
│   ├── scripts/                 create-upload-key.mjs (Play upload key + CI secrets)
│   └── src/
│       ├── api/                 axios client, endpoints, error mapping
│       ├── features/
│       │   ├── auth/            auth slice + form validation
│       │   ├── tasks/           tasks slice, selectors, smart ordering, types
│       │   └── preferences/     theme + sort preferences
│       ├── components/
│       │   ├── ui/              design system (BrutalBox, Button, TextField, Sheet, Toast…)
│       │   └── tasks/           TaskCard, SwipeableRow, StatsHero, FilterSheet…
│       ├── screens/             Welcome, Login, Register, Home, TaskDetail, TaskEditor, Profile
│       ├── navigation/          auth-gated stacks
│       ├── services/            session, server address, storage
│       ├── theme/               palette, typography, light/dark themes
│       └── store/               store setup + typed hooks
├── .github/workflows/           CI (tests) + Android build (APK, app bundle, releases)
├── docs/                        screenshots, Google Play publishing guide
├── docker-compose.yml           MongoDB + API in one command
└── render.yaml                  one-click Render deployment of the API
```

---

## Getting started

### Prerequisites

- **Node.js 22.11+** and npm
- **Android development setup** for React Native — Android Studio with SDK Platform 36, an emulator or a USB-debugging device, and JDK 17+ ([official guide](https://reactnative.dev/docs/set-up-your-environment))
- **Docker** (easiest way to run MongoDB) *or* a local MongoDB 6+. On Windows and macOS, start **Docker Desktop** and wait for "Engine running" before using `docker compose`.

### 1. Start the backend

**Option A — Docker (MongoDB + API):**

```bash
docker compose up -d --build
curl http://localhost:3000/api/health      # {"status":"ok","db":"up",...}
```

**Option B — Node directly:**

```bash
docker compose up -d mongo                 # or use your own MongoDB
cd backend
cp .env.example .env                       # then set two long random JWT secrets
npm install
npm run start:dev
```

Swagger docs are served at **http://localhost:3000/api/docs**.

### 2. Run the app

All app commands run from the **`mobile`** folder. Running them from the repo root fails with `Could not read package.json`.

```bash
cd mobile
npm install
npm start                                  # terminal 1: Metro bundler (leave it running)
npm run android                            # terminal 2, also inside mobile/
```

By default the app talks to `http://10.0.2.2:3000/api`, which is how the **Android emulator** sees your computer's `localhost`. On a **physical phone**, tap the **server pill** in the top-right of the welcome screen and enter your computer's Wi-Fi IP, e.g. `192.168.1.20:3000`. *Test* checks the connection before you save. To find the IP, run `ipconfig` on Windows or `ipconfig getifaddr en0` on macOS. The phone and computer must be on the same network, and the firewall must allow port 3000.

### Install the APK

Every push that changes the app builds a release APK on GitHub Actions:

- **Tagged versions:** download `DoAll.apk` from the [latest release](https://github.com/Gauravtiwari31/DoAll/releases/latest).
- **Any build:** open the [Android build workflow](https://github.com/Gauravtiwari31/DoAll/actions/workflows/android-apk.yml), pick a run, and download the `DoAll-apk` artifact (a zip containing the APK).

Install it on a phone (allow "install unknown apps") or drag it onto a running emulator. If the APK was built with a hosted server ([below](#deploy-the-backend-free)), it works straight away. Otherwise, start the backend as above and set the server address from the welcome screen.

> The download links only work for people who aren't logged in to GitHub when the repository is **public**.

**Upgrading from 1.0 or 1.1:** from 1.2.0 the app has a new package ID (`io.github.gauravtiwari31.doallapp` since 1.2.2, the one Google Play uses) and is signed with a private release key, so it installs next to the old version instead of updating it. Uninstall the old DoAll; your tasks are on the server, so just log in again.

To build it yourself instead:

```bash
cd mobile/android
./gradlew assembleRelease        # Windows: .\gradlew assembleRelease
# → mobile/android/app/build/outputs/apk/release/app-release.apk
```

Without the [upload key](#publishing-on-google-play), Gradle signs this build with the debug key and prints a warning: it installs on any device, but Google Play won't accept it.

---

## Deploy the backend (free)

Hosting the API means the APK works for anyone, anywhere, with no setup. You need two free accounts.

### 1. Database: MongoDB Atlas

1. Sign up at [mongodb.com/atlas](https://www.mongodb.com/atlas) and create a free **M0** cluster. AWS **Singapore** is closest to the Render region below; Mumbai also works.
2. **Database Access → Add New Database User:** choose a username and a strong password, with the role *Read and write to any database*.
3. **Network Access → Add IP Address → Allow access from anywhere** (`0.0.0.0/0`). Render's free plan has no fixed IP address, so Atlas can't allow-list it.
4. **Connect → Drivers:** copy the connection string and add the database name `doall` after the host:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/doall?retryWrites=true&w=majority
   ```
   If the password contains special characters, URL-encode them (`@` → `%40`, `#` → `%23`).

### 2. API: Render

1. Sign up at [render.com](https://render.com) with GitHub and give it access to this repository.
2. **New → Blueprint** → choose this repo. Render reads [`render.yaml`](render.yaml), asks for `MONGODB_URI` (paste the Atlas string) and generates the JWT secrets itself. Click **Apply**.
3. When the deploy finishes, open `https://<your-service>.onrender.com/api/health`. It should return `{"status":"ok","db":"up"}`.
4. Optional, for **Continue with Google**: create the OAuth clients and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the service, as described in [docs/google-sign-in.md](docs/google-sign-in.md).

### 3. Build an APK that uses it

1. On GitHub, go to **Settings → Secrets and variables → Actions → Variables → New repository variable**: `DOALL_API_URL` = `https://<your-service>.onrender.com`. For Google sign-in, also add `DOALL_GOOGLE_WEB_CLIENT_ID` ([details](docs/google-sign-in.md#5-configure-the-app-build)).
2. Create the release signing key once, from `mobile/`: `npm run play:upload-key -- --github` ([details](docs/play-store/README.md#1-create-the-upload-key)).
3. **Actions → Android build → Run workflow** and enter the version from `mobile/package.json` in *release*, e.g. `v1.2.0`.
4. About 15 minutes later the release has a `DoAll.apk` and a Google Play-ready `DoAll.aab` that talk to your hosted API by default. The server button still lets you switch to a local backend.

For a quick test build, leave *release* empty: the run's `DoAll-apk` artifact works without the signing key.

### Sleep on the free plan

Render's free instances spin down after **15 minutes** without traffic, and waking one takes up to a minute ([Render's free plan](https://render.com/docs/free)). The app softens this: it pings the server as soon as it opens and waits up to 30 seconds per request.

- **Never sleeps:** a paid instance (Render's *Starter*), or a server of your own such as Google Cloud's always-free `e2-micro` VM.
- **Stopgap:** a free monitor such as [cron-job.org](https://cron-job.org) requesting `https://<your-service>.onrender.com/api/health` every 10 minutes keeps it awake, and one service running all month fits within the free 750 instance-hours. Render's staff discourage this on the free plan, and Render may change the rules, so don't build a launch on it. Ping `/api/health`, not `/robots.txt`: Render answers that one itself without waking the service.

### Running it

[docs/operations.md](docs/operations.md) is the owner's checklist for the hosted service: the keep-alive monitor, the email service for confirmation and password reset, nightly encrypted backups (and testing a restore), crash reports with Sentry, least-privilege database users, a custom domain, and testing reminders on real phones.

---

## Publishing on Google Play

DoAll is set up for Google Play as `io.github.gauravtiwari31.doallapp`. The step-by-step guide, from the developer account to the production release, is in **[docs/play-store/README.md](docs/play-store/README.md)**. What's already in place:

| Requirement | Where |
|---|---|
| Android App Bundle signed with a private upload key, Play App Signing | [`app/build.gradle`](mobile/android/app/build.gradle), [`create-upload-key.mjs`](mobile/scripts/create-upload-key.mjs), the [Android build workflow](.github/workflows/android-apk.yml) |
| Version code derived from `mobile/package.json` (`1.2.0` → `10200`) | [`app/build.gradle`](mobile/android/app/build.gradle) |
| Target API 36, 16 KB page-size compatible native code, R8 shrinking | [`android/build.gradle`](mobile/android/build.gradle), [`app/build.gradle`](mobile/android/app/build.gradle) |
| Privacy policy, linked in the app | [`/privacy`](https://doall-api-m1yy.onrender.com/privacy) ([source](backend/src/legal)) |
| Account deletion in the app and on the web, also for Google accounts | **Profile → Delete account**, [`/account/delete`](https://doall-api-m1yy.onrender.com/account/delete) |
| Sign in with Google (optional; OAuth clients in Google Cloud) | [docs/google-sign-in.md](docs/google-sign-in.md) |
| Data safety answers | [docs/play-store/data-safety.md](docs/play-store/data-safety.md) |
| Store listing text, icon, feature graphic and screenshots | [`mobile/fastlane/metadata/android/en-US`](mobile/fastlane/metadata/android/en-US) |
| Optional automatic draft uploads to a Play track | `play_track` input of the Android build workflow |

---

## How it works

### Smart sort

Every open task gets a score from three signals, each normalised to 0–1, and the list is ordered by it:

```
score = 0.40 · Priority  +  0.45 · DeadlinePressure  +  0.15 · Schedule
```

| Signal | Value |
|---|---|
| **Priority** | low `0.2` · medium `0.55` · high `1.0` |
| **Deadline pressure** | `e^(−hoursLeft / 36)` — ≈1.0 when due now, 0.51 a day out, 0.14 three days out, 0 with no deadline. **Overdue** tasks score `1 + up to 0.5`, growing over 48 h, so late work rises and keeps rising. |
| **Schedule** | Before the planned start: `e^(−hoursUntil / 12)` (a task planned for the next hour is "on deck"). After it: `0.6 + 0.4 · e^(−hoursSince / 24)`, so started-but-unfinished work stays visible. |

Deadline pressure carries the most weight because missing a deadline is the costliest outcome. Priority is strong but not absolute: a *low* priority task due in two hours outranks a *high* priority task due next week. Ties are broken by earliest deadline, then earliest schedule, then newest. Completed tasks always sink to the bottom, most recently finished first.

The algorithm lives in [`backend/src/tasks/task-ordering.ts`](backend/src/tasks/task-ordering.ts) (used by `GET /tasks?sort=smart`) and is mirrored on the device in [`mobile/src/features/tasks/ordering.ts`](mobile/src/features/tasks/ordering.ts), so the list re-sorts instantly without a network round-trip. Both copies are covered by the same test scenarios.

### Authentication flow

```mermaid
sequenceDiagram
  participant App
  participant API
  participant DB as MongoDB
  App->>API: POST /auth/login (email, password)
  API->>DB: find user, bcrypt.compare
  API->>DB: store SHA-256(refresh token) as a session
  API-->>App: user + accessToken (15 min) + refreshToken (30 days)
  App->>API: GET /tasks (Bearer accessToken)
  Note over App: access token expired or about to
  App->>API: POST /auth/refresh (refreshToken)
  API->>DB: old session found → replace with new one
  API-->>App: new accessToken + new refreshToken
  Note over API: a rotated token used again = theft → revoke all sessions
```

- **Passwords** are hashed with bcrypt. **Refresh tokens** are stored only as SHA-256 hashes (bcrypt silently truncates at 72 bytes, which JWTs exceed).
- **Rotation + reuse detection:** every refresh invalidates the old token. If an already-used token shows up again, every session for that user is revoked.
- **Up to 5 devices** stay signed in at once; logout revokes just that device's session.
- **Sign in with Google** ends in the same token pair. The app gets an ID token from Google's account chooser and sends it to `POST /auth/google`; the API checks Google's signature, the expiry and that the token was issued to its own client ID, then signs in, creating the account the first time. If an email/password account already has that address, the password is needed once to connect the two, so a Google account alone can't take over an account someone registered with that email.
- **On the device**, an Axios interceptor adds the access token, refreshes it ~30 s before it expires, and on a `401` refreshes **once** (concurrent requests share the same in-flight refresh) and replays the request. If the refresh token is rejected, the user is returned to the login screen with a "session expired" notice.
- Credential endpoints are **rate limited** (10 requests/min/IP); every task query is scoped to the caller, and another user's task id returns `404`, not `403`, so ids can't be probed.

### State management

Redux Toolkit holds the app state in four slices:

| Slice | Holds | Notes |
|---|---|---|
| `auth` | status (`restoring` / `signedOut` / `signedIn`), user, submit state, notices | Navigation is derived from `status`, so logged-out users can't navigate back into the app. |
| `tasks` | tasks normalised with `createEntityAdapter`, load status, active filters | A mirror of the on-device database: every change is written there first. Cleared on logout or session expiry. |
| `sync` | sync status (`idle` / `syncing` / `offline` / `unverified` / `error`), last sync, last error, failures, changes waiting | Shown on **Profile → Backup & sync**. |
| `preferences` | theme mode, sort order | Saved to storage by listener middleware. |

Listener middleware ([`store/listeners.ts`](mobile/src/store/listeners.ts)) does the side effects: after a change it schedules a sync (debounced, retried with back-off when offline) and plans reminders again.

The list itself comes from **memoised selectors** (`selectVisibleTasks`, `selectViewCounts`, `selectDashboard`) that combine filters, sort order and the current minute. Tokens deliberately live **outside** Redux in a small `session` service: they're secrets rather than UI state, and nothing should re-render when they rotate. Short-lived UI state, like form fields and open sheets, stays in component state.

### Design language

"Paper & ink" with a neo-brutalist edge: warm paper backgrounds, near-black ink outlines, **hard un-blurred offset shadows**, and highlighter-coloured stickers for priorities and categories.

- **Type:** *Bricolage Grotesque* for UI and headings, *IBM Plex Mono* for metadata and labels, and an *Instrument Serif Italic* accent word in headlines ("Do it ***all.***").
- **Colour:** paper `#F2EDE4`, ink `#121212`, signal orange `#FF5A1F` as the accent, lime `#D7F75B` for progress and completion, plus butter, sky, lilac, mint and blush for categories.
- **Touch:** buttons and cards physically "press into" their shadow, checkboxes pop when ticked, cards slide in, and swipe actions grow as you drag.
- **Dark mode** flips to ink paper with cream outlines and orange shadows.
- Custom SVG icon set, adaptive launcher icon, and an Android 12+ splash screen that matches.

All colours and type sizes come from [`mobile/src/theme`](mobile/src/theme); components never hard-code theme colours.

---

### Offline-first sync

The phone's SQLite database ([`db/taskStore.ts`](mobile/src/db/taskStore.ts), op-sqlite, versioned migrations) is the source of truth; the server is the backup and the meeting point between devices.

- Tasks get their ID on the phone (a UUID), so they can be created offline.
- A local change marks the row **dirty** and stamps `updatedAt` (never earlier than the task's previous change, even if the clock went backwards). Deletions leave a **tombstone** until the server has it.
- `POST /sync` pushes dirty rows (200 per request) and pulls what changed on the server since the phone's **cursor**. The cursor follows the server's own clock (`serverUpdatedAt`), never device clocks, so devices whose clocks disagree still see every change. Changes from the last 5 seconds are handed out on the next sync, so a slow write can't slip behind a cursor.
- Conflicts: **last write wins per task** by `updatedAt`. A refused change comes back with the winning version, and a pulled task never overwrites a newer local change that's still waiting to be sent.
- Server tombstones keep only the task's ID and dates, and expire after 60 days (TTL index). A phone that hasn't synced for longer gets `reset` and starts over, keeping its unsent changes.
- Syncs run when the app opens or comes to the foreground, 2 s after a change, on pull-to-refresh, and on retry (5 s doubling up to 5 min).

**Reminders** ([`planner.ts`](mobile/src/features/reminders/planner.ts), [`reminders/`](mobile/android/app/src/main/java/com/doall/reminders)): the app plans every reminder for the next two months (up to 64 per repeating task, 500 in all) and hands the list to a small native module. Android only ever holds **one** alarm, for the next reminder; when it fires, the module shows what's due and sets the alarm for the next one. So the queue isn't limited by the phone's alarm cap, edits never need individual cancellations, and a receiver re-arms it after a reboot, an app update or a clock change. Alarms are exact when the user allows *Alarms & reminders*, otherwise within 10 minutes.

**Repeats** ([`recurrence.ts`](mobile/src/features/tasks/recurrence.ts)) are computed in the task's IANA time zone with `Intl`, so 9:00 stays 9:00 across daylight saving changes and when the phone travels. "Monthly on the 31st" uses the last day of shorter months; 29 February repeats on 28 February in other years.

## API reference

Base URL: `http://localhost:3000/api`. Every route except `auth/register`, `auth/login`, `auth/google`, `auth/refresh`, `auth/logout` and `health` requires `Authorization: Bearer <accessToken>`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | `{ name, email, password }` → `{ user, tokens }` |
| `POST` | `/auth/login` | `{ email, password }` → `{ user, tokens }` |
| `POST` | `/auth/google` | `{ idToken, password? }` → `{ user, tokens }`. `409` with `code: GOOGLE_LINK_PASSWORD_REQUIRED` when an email/password account already uses the address (send its `password` too); `501` when the server has no `GOOGLE_CLIENT_ID` |
| `POST` | `/auth/refresh` | `{ refreshToken }` → new `{ user, tokens }` (old refresh token is revoked) |
| `POST` | `/auth/logout` | `{ refreshToken }` → `204` |
| `GET` | `/auth/me` | Current user |
| `POST` | `/auth/password/forgot` | `{ email }` → `204` whether or not the address has an account; emails a reset link. `501` when the server can't send email |
| `POST` | `/auth/verify-email/resend` | `204`; emails a new confirmation link to the signed-in user |
| `POST` | `/sync` | `{ cursor?, changes: Task[] }` (at most 200) → `{ changes, cursor, hasMore, reset }`. See [offline-first sync](#offline-first-sync). Uploading changes is `403` with `code: EMAIL_NOT_VERIFIED` until the address is confirmed, when the server sends email |
| `DELETE` | `/auth/me` | `{ password }`, or `{ googleIdToken }` for an account without a password → `204`. Permanently deletes the account, its tasks and every session; a wrong confirmation is `403` |
| `GET` | `/tasks` | List. Query: `status` (`all`/`active`/`completed`/`overdue`), `priority`, `category`, `tag`, `search`, `from`, `to`, `sort` (`smart`/`deadline`/`scheduled`/`priority`/`created`) |
| `GET` | `/tasks/stats` | Counters; `tzOffset` (minutes, from `Date#getTimezoneOffset`) defines "today" |
| `GET` | `/tasks/:id` | One task |
| `POST` | `/tasks` | Create: `{ title, description?, scheduledAt?, deadline?, priority?, category?, tags? }` |
| `PATCH` | `/tasks/:id` | Partial update (any of the above, plus `completed`) |
| `PATCH` | `/tasks/:id/status` | `{ completed: boolean }` |
| `DELETE` | `/tasks/:id` | `204` |
| `DELETE` | `/tasks/completed` | Delete every completed task → `{ deleted }` |
| `GET` | `/health` | Liveness + database status |

`user` is `{ id, name, email, signInMethods, emailVerified, createdAt }`, where `signInMethods` lists `password` and/or `google`. `tokens` is `{ accessToken, refreshToken, expiresIn }`, where `expiresIn` is the access token's lifetime in seconds. Validation errors return `400` with a `message` array; unknown fields are rejected. A deadline earlier than the scheduled time is rejected.

The `/tasks` routes are what app versions before 1.2.0 use; they see the same tasks as `/sync` (deletions there leave tombstones too).

Public web pages live outside `/api`: `GET /verify-email?token=` and `GET`/`POST /reset-password` (the links in emails), `GET /privacy` (privacy policy) and `GET /account/delete`, whose form (`POST /account/delete` with email, password and a confirmation) deletes an account without the app. With `GOOGLE_CLIENT_SECRET` set, the page also offers **Signed up with Google?**: `POST /account/delete/google` sends the browser to Google's account chooser, and `GET /account/delete/google/callback` deletes the account Google confirms.

---

## Testing

```bash
# backend
cd backend
npm test             # unit: smart ordering, auth service (rotation, reuse detection, Google sign-in, account deletion, email links), Google token checks, email service, env validation, HTML escaping
npm run test:e2e     # end-to-end against a real MongoDB (docker compose up -d mongo)
npm run lint

# mobile
cd mobile
npm test             # sync engine (two phones + a fake server, on real SQLite), repeats (month ends, leap years, DST, time zones), reminder planning, task changes, ordering, selectors, slices, Google sign-in, validation, dates, URLs, API client, TaskCard
npm run typecheck
npm run lint
```

| Suite | Tests |
|---|---|
| Backend unit | 65 |
| Backend e2e | 42 — registration, duplicates, validation, login, protected routes, refresh rotation & reuse detection, logout, CRUD, filters, search, smart sort, ownership isolation, stats, account deletion (app and web), privacy and deletion pages, Google sign-in and connecting accounts, deletion with Google (app and web), email confirmation, password reset, sync (push/pull, last write wins, clock skew, tombstones, reset, paging, older app versions) |
| Mobile | 116 |

---

## Notes & trade-offs

- **Token storage.** Tokens are kept in AsyncStorage, which is app-private storage, and `allowBackup` is off. For production I'd switch to Android Keystore-backed storage such as `react-native-keychain`. Only [`services/session.ts`](mobile/src/services/session.ts) would change.
- **Sorting on the device.** A personal task list is small and lives on the phone, so filtering and sorting happen there instantly. The API offers the same filters and sorts for other clients.
- **Own auth instead of Firebase.** The API keeps its own accounts (bcrypt, rotating refresh tokens, Google sign-in verified server-side) rather than Firebase Auth: existing accounts keep working, and builds don't need a Firebase project. Email confirmation and password reset are sent from the owner's Gmail through a small Apps Script (or Resend, with a domain), never SMTP.
- **No push to other devices.** Another phone picks up changes when it opens or comes to the foreground, not instantly; FCM data messages could nudge it later.
- **Last write wins** per task, not per field: if two phones edit different fields of the same task while offline, the later edit replaces the whole task.
- **Backups** run nightly on GitHub Actions, encrypted, because MongoDB Atlas's free tier keeps none ([operations](docs/operations.md#3-nightly-database-backups)).
- **Plain HTTP is allowed for self-hosting.** The hosted API is HTTPS-only, but the server button can point the app at a backend on a laptop or LAN, so the app's [network security config](mobile/android/app/src/main/res/xml/network_security_config.xml) permits HTTP even in release builds. It only applies to an address the user typed in.
- **Signing.** Release builds are signed with a private upload key kept outside the repository (CI reads it from secrets), and Google Play re-signs them with Play App Signing. Without the key, Gradle falls back to the debug keystore and warns that the build can't go to Google Play.
- **Deleted accounts.** Deleting an account removes the user, every task and every session at once, and the API refuses any access token that belongs to a deleted account, so nothing new can be stored for it.
- **Google sign-in without an SDK.** The app calls Android's Credential Manager through a small native module of its own ([`googlesignin/`](mobile/android/app/src/main/java/com/doall/googlesignin)) instead of a React Native library: Google deprecated the old Sign-In SDK that the free libraries wrap. The server uses Google's official `google-auth-library` to check tokens.
- **Undo for delete** brings the task back with the same ID and content.
- **Platform.** The app targets Android, per the brief. The iOS folder is the untouched React Native template.
