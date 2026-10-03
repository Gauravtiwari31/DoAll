# DoAll — Android app

React Native 0.87 (CLI) + TypeScript client for DoAll. See the [root README](../README.md) for features, architecture and screenshots.

## Run

```bash
npm install
npm start              # Metro
npm run android        # build & install on an emulator / device
```

The backend must be running (`docker compose up -d --build` from the repo root).

### Pointing the app at the API

Edit [`src/config.ts`](src/config.ts):

| Where the app runs | `DEV_HOST` |
|---|---|
| Android emulator | `10.0.2.2` (default) |
| USB device | `localhost`, after `npm run adb:reverse` |
| Device on the same Wi-Fi | your computer's LAN IP |

## Scripts

| Script | |
|---|---|
| `npm run android` | Build and launch on Android |
| `npm start` | Metro bundler |
| `npm test` | Jest unit and component tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (React Native config) |
| `npm run format` | Prettier |

## Structure

```
src/
├── App.tsx              providers + startup (preferences → session restore)
├── config.ts            API URL and timeouts
├── api/                 axios client (auth header, proactive + single-flight refresh), endpoints
├── services/            session (tokens) and JSON storage helpers
├── store/               configureStore, listener middleware, typed hooks
├── features/
│   ├── auth/            authSlice (restore, login, register, logout), validation
│   ├── tasks/           tasksSlice (entity adapter, optimistic updates), selectors,
│   │                    ordering (smart sort), metadata, validation, types
│   └── preferences/     theme + sort preferences
├── navigation/          auth-gated native stacks
├── screens/             Welcome, Login, Register, Home, TaskDetail, TaskEditor, Profile, Splash
├── components/
│   ├── ui/              design system: AppText, BrutalBox/BrutalPressable, Button, TextField,
│   │                    Chip, Checkbox, Segmented, Sheet, Toast, ConfirmDialog, Icon…
│   └── tasks/           TaskCard, SwipeableRow, StatsHero, FilterSheet, DateTimeField,
│                        TagInput, ScoreBreakdown, EmptyState, TaskSkeleton
├── theme/               palette, typography, light/dark themes, ThemeProvider
├── hooks/               useNow (minute ticker for live countdowns)
└── utils/               date formatting & presets, haptics
```

Fonts live in `android/app/src/main/assets/fonts` (SIL Open Font License, licence files alongside).
