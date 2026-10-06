# DoAll — Android app

React Native 0.87 (CLI) + TypeScript client for DoAll. See the [root README](../README.md) for features, architecture and screenshots.

## Run

```bash
npm install
npm start              # Metro
npm run android        # build & install on an emulator / device
```

The backend must be running (`docker compose up -d --build` from the repo root).

Run every command from this `mobile` folder.

### Pointing the app at the API

Tap the server pill on the welcome or login screen. You can test the address before saving it, and it's remembered on the device.

| Where the app runs | Server address |
|---|---|
| Android emulator | `10.0.2.2:3000` (default) |
| Phone on the same Wi-Fi | your computer's LAN IP, e.g. `192.168.1.20:3000` |
| USB phone | `localhost:3000`, after `npm run adb:reverse` |

The default is the local backend, unless the build was given a hosted URL. CI writes the repository variables `DOALL_API_URL` and `DOALL_GOOGLE_WEB_CLIENT_ID` into [`src/env.ts`](src/env.ts) with [`scripts/write-build-env.mjs`](scripts/write-build-env.mjs); see [`src/config.ts`](src/config.ts).

### Sign in with Google

**Continue with Google** appears on the welcome, login and sign-up screens when the build has a Google client ID (`GOOGLE_WEB_CLIENT_ID` in `src/env.ts`). It uses Android's Credential Manager through the app's own Turbo Native Module: the spec is [`src/native/NativeGoogleSignIn.ts`](src/native/NativeGoogleSignIn.ts) (React Native's codegen turns it into a Kotlin interface, per `codegenConfig` in `package.json`) and the implementation is [`android/app/src/main/java/com/doall/googlesignin`](android/app/src/main/java/com/doall/googlesignin). Setting up the Google Cloud side, and the fingerprints each build needs, is in [docs/google-sign-in.md](../docs/google-sign-in.md).

### Release builds

| Command (in `android/`) | Output |
|---|---|
| `./gradlew assembleRelease` | `app/build/outputs/apk/release/app-release.apk`, to install directly |
| `./gradlew bundleRelease` | `app/build/outputs/bundle/release/app-release.aab`, the app bundle Google Play takes |

- **Package ID:** `io.github.gauravtiwari31.doallapp` (the Kotlin code stays in `com.doall`). It can never change once the app is on Google Play.
- **Version:** set it only in `package.json` (`"version": "1.2.0"`). Gradle uses it as `versionName` and derives `versionCode = major × 10000 + minor × 100 + patch`; the Profile screen shows the same value.
- **Signing:** `npm run play:upload-key` creates the private upload key outside the repository ([`scripts/create-upload-key.mjs`](scripts/create-upload-key.mjs); `-- --github` also stores it as CI secrets). Gradle reads `DOALL_UPLOAD_STORE_FILE`, `DOALL_UPLOAD_STORE_PASSWORD`, `DOALL_UPLOAD_KEY_ALIAS` and `DOALL_UPLOAD_KEY_PASSWORD` from `~/.gradle/gradle.properties` or the environment; without them it signs with the debug key and warns that Google Play will reject the build.
- **R8** shrinks and obfuscates release builds; app-specific keep rules are in [`android/app/proguard-rules.pro`](android/app/proguard-rules.pro). The mapping file and native debug symbols are packed into the app bundle.

CI builds the APK on every push and the signed bundle once the key secrets exist ([workflow](../.github/workflows/android-apk.yml)). The whole Google Play process is in [docs/play-store/README.md](../docs/play-store/README.md).

## Scripts

| Script | |
|---|---|
| `npm run android` | Build and launch on Android |
| `npm start` | Metro bundler |
| `npm test` | Jest unit and component tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (React Native config) |
| `npm run format` | Prettier |
| `npm run play:upload-key` | Create the Google Play upload key (`-- --github` also stores it as CI secrets) |

## Structure

```
src/
├── App.tsx              providers + startup (preferences → session restore)
├── config.ts            API URL, timeouts, app version, privacy policy and account deletion links, Google client ID
├── native/              spec of the Google sign-in Turbo Native Module (Kotlin in android/…/googlesignin)
├── api/                 axios client (auth header, proactive + single-flight refresh), endpoints
├── services/            session (tokens), server address, Google's account chooser, JSON storage helpers
├── store/               configureStore, listener middleware, typed hooks
├── features/
│   ├── auth/            authSlice (restore, login, register, Google sign-in, logout, deleteAccount), validation
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
