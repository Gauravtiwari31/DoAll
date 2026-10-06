# Publishing DoAll on Google Play

The owner's guide to getting DoAll onto Google Play and keeping it there. Work through the sections in order the first time; after that, a new version only needs [step 6](#6-later-releases).

| | |
|---|---|
| **Package name** | `io.github.gauravtiwari31.doallapp`. It can never change once a bundle is uploaded. The Kotlin namespace stays `com.doall`. |
| **App name / store title** | DoAll / `DoAll: Smart To-Do List` |
| **Developer** | Gaurav Tiwari (personal account) |
| **Contact email** | gauravt9431@gmail.com |
| **Website** | https://github.com/Gauravtiwari31/DoAll |
| **Privacy policy** | https://doall-api-m1yy.onrender.com/privacy |
| **Account deletion** | https://doall-api-m1yy.onrender.com/account/delete |
| **Sign in with Google** | Optional, set up with [docs/google-sign-in.md](../google-sign-in.md). The Play version needs the app signing key's fingerprint, which exists after the first upload. |
| **First Play version** | `1.2.1`, version code `10201` |
| **Listing, once live** | https://play.google.com/store/apps/details?id=io.github.gauravtiwari31.doallapp |

Play Console menus move around from time to time. The paths below match Google's help pages as of October 2026, and every rule links to the official page it comes from.

---

## Contents

- [Before you start](#before-you-start)
- [1. Create the upload key](#1-create-the-upload-key)
- [2. Build the app bundle](#2-build-the-app-bundle)
- [3. Create the app and complete App content](#3-create-the-app-and-complete-app-content)
- [4. Store listing](#4-store-listing)
- [5. Internal testing, closed testing, production](#5-internal-testing-closed-testing-production)
- [6. Later releases](#6-later-releases)
- [Requirements checklist](#requirements-checklist)
- [Troubleshooting](#troubleshooting)

---

## Before you start

### A Play Console developer account

- Sign up at [play.google.com/console/signup](https://play.google.com/console/signup) as a **personal** account. There is a **US$25 one-time registration fee**, and you must be at least 18 ([Get started with Play Console](https://support.google.com/googleplay/android-developer/answer/6112435)).
- **Identity verification:** your legal name and address come from the Google payments profile, and Google may ask for a government ID and a card in your legal name. The contact and developer email addresses are confirmed with one-time codes ([required information](https://support.google.com/googleplay/android-developer/answer/13628312)). New personal accounts also have to prove they have an Android device, using the **Play Console** mobile app.
- The **developer name** is public and may differ from your legal name. The **developer email** appears on your developer profile.

### The testing rule for new personal accounts

Personal accounts created after 13 November 2023 must run a **closed test with at least 12 testers who stay opted in for at least 14 days in a row** before they can apply for production. Testers who leave before 14 days don't count, and someone who leaves and rejoins starts their 14 days again. Google reviews the production application, usually within 7 days ([app testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)).

So plan for roughly three weeks from the first upload to the public listing, and line up **at least 12 people with Google accounts** before you start (15 or more leaves room for drop-outs).

### The hosted server

Reviewers and testers use the hosted server, and the listing links to two of its pages. Before submitting anything, open:

- https://doall-api-m1yy.onrender.com/api/health, which should return `{"status":"ok","db":"up",…}`
- https://doall-api-m1yy.onrender.com/privacy and https://doall-api-m1yy.onrender.com/account/delete

Render redeploys the API whenever the branch it tracks changes, so a missing page means the latest backend hasn't been deployed yet. Keep an uptime monitor requesting `/api/health` every 10 minutes ([root README](../../README.md#sleep-on-the-free-plan)) so a reviewer never waits for a cold start.

### Sign in with Google

If DoAll should offer **Continue with Google** from its first Play release, do steps 1–5 of [docs/google-sign-in.md](../google-sign-in.md) before building the bundle, so the build includes the client ID. Step 3 there needs the app signing key's fingerprint, which only exists after the first upload: add it before any tester tries Google sign-in from Google Play (see [step 5](#internal-testing-the-first-upload-and-play-app-signing)).

### Tools

- **Node.js 22** and **JDK 17+** (for `keytool`), to create the upload key
- **GitHub CLI**, signed in with `gh auth login`, if the key script should store the GitHub secrets for you
- The Android SDK only if you build locally instead of on GitHub Actions

---

## 1. Create the upload key

Google Play uses two keys. You sign every upload with your private **upload key**; Google re-signs the app it delivers to phones with an **app signing key** it generates and keeps ([Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)). A lost upload key can be replaced, but only through Google support, so treat it with care.

From the `mobile` folder:

```bash
cd mobile
npm run play:upload-key -- --github
```

The script ([`mobile/scripts/create-upload-key.mjs`](../../mobile/scripts/create-upload-key.mjs)):

- creates the keystore `~/.android-keys/doall-upload.jks` with the alias `doall-upload` (`--out <path>` picks another location; it never writes inside the repository and refuses to overwrite an existing keystore unless you pass `--force`);
- writes `~/.android-keys/doall-upload.properties` next to it with the four Gradle values `DOALL_UPLOAD_STORE_FILE`, `DOALL_UPLOAD_STORE_PASSWORD`, `DOALL_UPLOAD_KEY_ALIAS` and `DOALL_UPLOAD_KEY_PASSWORD`;
- with `--github`, stores the repository secrets `ANDROID_UPLOAD_KEYSTORE_BASE64`, `ANDROID_UPLOAD_STORE_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS` and `ANDROID_UPLOAD_KEY_PASSWORD` with `gh secret set` (the values go through stdin, never the command line).

Check that the secrets arrived with `gh secret list`, or under **Settings → Secrets and variables → Actions** on GitHub.

**Back it up now.** Copy both files, the `.jks` and the `.properties`, to two safe places outside the repository, such as a password manager and an encrypted USB drive. Every future update has to be signed with this key. Never commit either file.

To see the key's fingerprints (useful for the checks in step 5):

```bash
keytool -list -v -keystore ~/.android-keys/doall-upload.jks -alias doall-upload
```

---

## 2. Build the app bundle

Google Play only accepts new apps as an **Android App Bundle** (`.aab`) ([About Android App Bundles](https://developer.android.com/guide/app-bundle)). There are two ways to build DoAll's.

### On GitHub Actions (recommended)

1. On GitHub, open **Settings → Secrets and variables → Actions** and check:
   - **Variables:** `DOALL_API_URL` = `https://doall-api-m1yy.onrender.com`, so the app talks to the hosted server and links to its privacy and deletion pages, and for Google sign-in `DOALL_GOOGLE_WEB_CLIENT_ID` = the Web client ID;
   - **Secrets:** the four `ANDROID_UPLOAD_*` secrets from step 1.
2. Check that `"version"` in [`mobile/package.json`](../../mobile/package.json) is `1.2.1`.
3. **Actions → Android build → Run workflow**, enter `v1.2.1` in **release**, leave **play_track** at `none`, and run it.
4. When the run finishes, the [v1.2.1 release](https://github.com/Gauravtiwari31/DoAll/releases/tag/v1.2.1) has **DoAll.aab** (for Google Play) and **DoAll.apk** (for sideloading). Download `DoAll.aab`.

A release run fails on purpose when the upload key secrets are missing, because a release has to be accepted by Google Play.

### On your own computer

1. Set up the Android SDK as in the [root README](../../README.md#prerequisites).
2. Copy the four lines from `~/.android-keys/doall-upload.properties` into `~/.gradle/gradle.properties` (on Windows, `%USERPROFILE%\.gradle\gradle.properties`). Use forward slashes in the keystore path on Windows, for example `DOALL_UPLOAD_STORE_FILE=C:/Users/you/.android-keys/doall-upload.jks`. Environment variables with the same names work too.
3. Point the build at the hosted server, as CI does: in `mobile/`, run `DOALL_API_URL=https://doall-api-m1yy.onrender.com DOALL_GOOGLE_WEB_CLIENT_ID=<Web client ID> node scripts/write-build-env.mjs` (leave out the Google variable to build without Google sign-in). It rewrites [`mobile/src/env.ts`](../../mobile/src/env.ts); without it the app defaults to the emulator's local backend and links to a privacy policy on `10.0.2.2`. Undo it after building with `git checkout src/env.ts`; don't commit it.
4. Build:

   ```bash
   cd mobile/android
   ./gradlew bundleRelease          # Windows: .\gradlew bundleRelease
   # → mobile/android/app/build/outputs/bundle/release/app-release.aab
   ```

5. Confirm it is signed with the upload key, not the debug key:

   ```bash
   keytool -printcert -jarfile app/build/outputs/bundle/release/app-release.aab
   ```

   The SHA-256 fingerprint must match the one from step 1. `CN=Android Debug` means Gradle didn't find the four properties; it also prints a warning saying the output can't be uploaded to Google Play.

---

## 3. Create the app and complete App content

### Create the app

In Play Console, **Home → Create app** ([Create and set up your app](https://support.google.com/googleplay/android-developer/answer/9859152)):

| Field | Value |
|---|---|
| App name | `DoAll: Smart To-Do List` (the store title, from [`title.txt`](../../mobile/fastlane/metadata/android/en-US/title.txt)) |
| Default language | English (United States) – en-US |
| App or game | App |
| Free or paid | Free. An app published as free can never become paid ([pricing](https://support.google.com/googleplay/android-developer/answer/6334373)). |
| Declarations | Accept the Developer Program Policies, US export laws and the Play App Signing terms |

### App content

Open **Policy and programs → App content** and complete every declaration it lists ([Prepare your app for review](https://support.google.com/googleplay/android-developer/answer/9859455)):

| Declaration | DoAll's answer |
|---|---|
| **Privacy policy** | `https://doall-api-m1yy.onrender.com/privacy`. It must be public, not a PDF, and also linked inside the app, which it is ([User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311)). |
| **Ads** | **No**, the app doesn't contain ads. |
| **Sign-in details** (formerly *App access*) | Some functionality is restricted: everything is behind sign-in. Give the demo account and instructions [below](#sign-in-details). |
| **Content rating** | The questionnaire [below](#content-rating). |
| **Target audience and content** | Ages **13–15, 16–17 and 18 and over**; see [below](#target-audience). |
| **Data safety** | The exact answers are in [data-safety.md](data-safety.md). The account deletion link goes there too: `https://doall-api-m1yy.onrender.com/account/delete`. |
| **Government apps** | **No**, not developed by or for a government ([requirements](https://support.google.com/googleplay/android-developer/answer/9514050)). |
| **Financial features** | **My app doesn't provide any financial features** ([declaration](https://support.google.com/googleplay/android-developer/answer/13849271)). |
| **Health apps** | **My app doesn't provide any health features**. "Health" is only a task category label ([declaration](https://support.google.com/googleplay/android-developer/answer/14738291)). |
| **News apps** | **No**, it isn't a news or magazine app. |
| **Advertising ID** | **No**. DoAll doesn't use the advertising ID or declare the `AD_ID` permission ([Advertising ID](https://support.google.com/googleplay/android-developer/answer/6048248)). |
| Anything else listed | See the permissions below. None of them needs a declaration form: DoAll doesn't use `USE_EXACT_ALARM` (which Google restricts to alarm-clock and calendar apps), foreground services, or photo and video access. |

**Permissions in 1.2.x**, for the store review and the **Exact alarms** question if Play Console asks:

| Permission | Why |
|---|---|
| `INTERNET` | Sync with the DoAll server |
| `VIBRATE` | The haptic tick when a task is completed |
| `POST_NOTIFICATIONS` | Task reminders. Asked for (Android 13+) only when someone first turns a reminder on. |
| `RECEIVE_BOOT_COMPLETED` | Puts reminders back after the phone restarts |
| `SCHEDULE_EXACT_ALARM` | Reminders on the minute. Users grant it under **Alarms & reminders** (from DoAll's **Reminders not arriving?** screen); without it, reminders still arrive, up to ~10 minutes late. It's the user-granted permission, not the restricted `USE_EXACT_ALARM`. |

#### Sign-in details

Every DoAll screen past the welcome screen needs an account. Reviewers could register their own, but Google wants credentials that are "accessible at all times, reusable, and valid regardless of user location", in English ([sign-in details requirements](https://support.google.com/googleplay/android-developer/answer/15748846)). A ready-made account with tasks in it also shows smart sort without any setup.

1. In the release app, create a demo account, for example **Play Review** with an address you control (a `+review` alias of your Gmail works; DoAll sends no emails) and a strong password.
2. Add six or so tasks that show the features: one overdue with high priority, one due in a few hours, one scheduled for tonight, one for next week with a tag such as `#admin`, one low-priority study task and one completed. Refresh them before each review so they don't all drift into *Overdue*.
3. In **App content → Sign-in details → Start → + Add new instructions**, enter the email and password, and paste this into **Any other instructions**:

   > DoAll needs an account. Sign in with the details above; the account already contains sample tasks. You can also create a new account from the welcome screen with any email address and a password of 8+ characters including a letter and a number (there is no email verification), or with Continue with Google and any Google account. The app uses DoAll's hosted server: if it has been idle, the first request can take up to a minute while the server wakes up. To try account deletion (Profile → Delete account), please create a new account first and keep the demo account.

Keep the demo account and its password unchanged for as long as the app is on Google Play, because every update is reviewed with it.

#### Content rating

**Start** the questionnaire, enter the contact email (the rating certificates go there) and pick the category **Utility, Productivity, Communication, or Other**, which Google's examples describe as covering note taking and productivity apps ([category](https://support.google.com/googleplay/android-developer/answer/6159978), [content ratings](https://support.google.com/googleplay/android-developer/answer/9859655)). Then answer:

- **No** to every content question: violence, fear or horror, sexuality or nudity, profanity or crude humour, drugs, alcohol or tobacco, gambling or simulated gambling, hate or discriminatory content.
- **No**, users can't interact or exchange content with each other: tasks are private to their owner and nothing is shared between accounts.
- **No** to sharing the user's location with other users, to buying digital goods, and to unrestricted web access (DoAll isn't a browser or search engine).

That should give the lowest rating in every region, such as *Everyone* in the US and *PEGI 3* in Europe.

#### Target audience

Select **13–15, 16–17 and 18 and over**. DoAll is a general productivity app, students are a natural audience (it even has a *Study* category), and the privacy policy says it isn't directed at children under 13.

- **Don't include any group under 13.** That would put DoAll under the [Families policies](https://support.google.com/googleplay/android-developer/answer/9893335): personal data from children would have to be disclosed and collected with parental consent where the law requires it, and ads could only come from Families self-certified SDKs. DoAll asks for a name and an email address and isn't built for children.
- **18 and over only** is the stricter alternative. Selecting it as the only age group lets you turn on **Restrict Minor Access**, which stops people Google determines are under 18 from finding or installing the app ([target audience](https://support.google.com/googleplay/android-developer/answer/9867159)). Nothing in DoAll requires that, and it would shut out teenagers.
- If Play Console asks whether the store listing could unintentionally appeal to children, answer **No**: there are no cartoon characters or child-oriented themes.

---

## 4. Store listing

The listing's text and graphics live in [`mobile/fastlane/metadata/android/en-US`](../../mobile/fastlane/metadata/android/en-US), in the layout the fastlane *supply* tool (and F-Droid) reads.

### Main store listing

**Grow users → Store presence → Main store listing**:

| Field | Source | Google's limit |
|---|---|---|
| App name | [`title.txt`](../../mobile/fastlane/metadata/android/en-US/title.txt) | 30 characters |
| Short description | [`short_description.txt`](../../mobile/fastlane/metadata/android/en-US/short_description.txt) | 80 characters |
| Full description | [`full_description.txt`](../../mobile/fastlane/metadata/android/en-US/full_description.txt) | 4,000 characters |
| App icon | `images/icon.png` | 512 × 512 px, 32-bit PNG with alpha, up to 1 MB |
| Feature graphic | `images/featureGraphic.png` | 1024 × 500 px, JPEG or 24-bit PNG without alpha |
| Phone screenshots | `images/phoneScreenshots/*.png`, in file-name order | 2–8 per device type; JPEG or 24-bit PNG without alpha; sides 320–3840 px, the long side at most twice the short one. At least four at 1080 px or more make the app eligible for promotion. |

Sources: [text limits](https://support.google.com/googleplay/android-developer/answer/9859152) and [preview assets](https://support.google.com/googleplay/android-developer/answer/9866151). Tablet screenshots and a video are optional.

Paste the text as it is. The [Metadata policy](https://support.google.com/googleplay/android-developer/answer/9898842) rules out emoji, ALL CAPS and performance or price claims ("best", "#1", "free") in the title, and anonymous testimonials, repeated keywords and misleading claims anywhere. Graphics shouldn't carry rankings, calls to action such as "download now", or price text either. The current files follow these rules; keep it that way when editing them.

### Store settings

**Grow users → Store presence → Store settings** ([category and tags](https://support.google.com/googleplay/android-developer/answer/9859673)):

| Field | Value |
|---|---|
| App or game | App |
| Category | **Productivity** (Google's examples include to-do lists) |
| Tags | Up to five from Google's list that describe a to-do or task-planning app |
| Email address | gauravt9431@gmail.com (required, shown on the listing) |
| Website | https://github.com/Gauravtiwari31/DoAll |
| Phone number | Leave empty (optional) |

---

## 5. Internal testing, closed testing, production

Each new release goes **internal testing → closed testing → production** the first time. Menus: [set up a test](https://support.google.com/googleplay/android-developer/answer/9845334), [prepare and roll out a release](https://support.google.com/googleplay/android-developer/answer/9859348).

### Internal testing: the first upload and Play App Signing

1. **Test and release → Testing → Internal testing → Create new release.**
2. Play App Signing is switched on for a new app automatically, with an app signing key that Google generates and keeps. Keep that default: Google holds the key that every future update needs, and your upload key stays replaceable.
3. Upload `DoAll.aab`. The release name defaults to `10201 (1.2.1)`.
4. Release notes: paste [`changelogs/10201.txt`](../../mobile/fastlane/metadata/android/en-US/changelogs/10201.txt) between the language tags (500 characters at most per language):

   ```
   <en-US>
   …contents of 10201.txt…
   </en-US>
   ```

5. **Next**, check the summary for errors, then **Save** and roll it out (**Start rollout to Internal testing**, or **Publishing overview → Send changes for review** if Play Console asks).
6. On the **Testers** tab, create an email list (up to 100 internal testers), copy the join link and send it to yourself and a few others. Install DoAll from Google Play through that link and try everything once: register, add, complete and delete tasks, open the privacy policy, and delete a throwaway account.

After this first upload:

- **Test and release → App bundle explorer:** version code `10201`, target SDK 36, and no warnings. Play Console checks [16 KB page size](https://developer.android.com/guide/practices/page-sizes) compatibility here; DoAll's native code comes from React Native 0.87, which supports 16 KB pages ([React Native 0.77 notes](https://reactnative.dev/blog/2025/01/21/version-0.77)).
- **Sign in with Google:** open **Test and release → App integrity → Play app signing**, copy the *App signing key certificate* SHA-1 and add it as an Android client in Google Cloud ([step 3 of the Google sign-in guide](../google-sign-in.md#3-create-the-android-clients-app)). Until then, Continue with Google fails in every copy installed from Google Play. Then try it from the internal testing install.
- **Android developer verification** page, **Package names** tab: `io.github.gauravtiwari31.doallapp` should show as registered. Google registers Play apps automatically, and every Play package must be registered since 30 September 2026 ([registering Play package names](https://support.google.com/googleplay/android-developer/answer/16984799)). Register it there yourself if it isn't.
- **The GitHub APK** is signed with the upload key, not with Google's app signing key. Android devices start requiring apps from verified developers outside Google Play in Brazil, Indonesia, Singapore and Thailand from 30 September 2026, and worldwide from 2027 ([developer verification](https://developer.android.com/developer-verification)). To keep the GitHub APK installable there, add the upload key's SHA-256 fingerprint (step 1) as an **additional key** on the same page. Play Console may ask for proof: a snippet it gives you goes into `android/app/src/main/assets/adi-registration.properties` in a release APK signed with that key ([adding additional keys](https://support.google.com/googleplay/android-developer/answer/16762301)).

### Closed testing: 12 testers for 14 days

1. **Test and release → Testing → Closed testing.** Open the default track (**Alpha**) with **Manage track**.
2. **Create new release → Add from library**, pick the `10201` bundle, paste the same release notes, then **Next → Save** and send it for review. Closed tests are reviewed by Google, and the first review of a new app can take a few days.
3. Under **Countries / regions**, add the countries your testers live in.
4. On the **Testers** tab, add an email list with at least 12 Google accounts and copy the opt-in link. Each tester opens it, accepts, and installs DoAll from Google Play. **Nobody should leave the test for 14 days.**
5. Ask testers to use the app for real during those two weeks and to send feedback (a form, an email address or a chat group). The production application asks what they did and what you changed because of it.

### Apply for production

When the 12-testers-for-14-days condition is met, **Dashboard → Apply for production** unlocks. It asks about your closed test (recruiting testers, how they used it, feedback), about the app (audience, what makes it useful, expected installs in the first year) and about production readiness (what you changed, how you decided it was ready). Google usually answers within 7 days.

### Production

1. **Test and release → Production → Countries / regions**: add every country where DoAll should be available.
2. **Create new release → Add from library** (the same `10201` bundle) or promote the tested release, paste the release notes, **Next**.
3. Choose a rollout percentage (a staged rollout, such as 20%, limits the damage of a bad release) and **Save**, then **Publishing overview → Send changes for review**.
4. Once approved, the listing goes live at https://play.google.com/store/apps/details?id=io.github.gauravtiwari31.doallapp. Add the link to the root README and the release notes.

---

## 6. Later releases

1. Bump `"version"` in [`mobile/package.json`](../../mobile/package.json), for example to `1.2.1`. Gradle derives `versionName` and `versionCode = major × 10000 + minor × 100 + patch`, so `1.2.1` → `10201`; keep minor and patch at 99 or below. The version code must go up with every upload.
2. Write the Play "what's new" text into `mobile/fastlane/metadata/android/en-US/changelogs/<versionCode>.txt` (500 characters at most) and update [`.github/RELEASE_NOTES.md`](../../.github/RELEASE_NOTES.md), the text of the GitHub release.
3. Push a tag such as `v1.2.1`, or run **Actions → Android build → Run workflow** with **release** = `v1.2.1`. The release gets `DoAll.aab` and `DoAll.apk`.
4. Then either upload `DoAll.aab` by hand (**Create new release** on a track, as in step 5) or let the workflow upload it, below.

### Automatic uploads (optional)

With the `PLAY_SERVICE_ACCOUNT_JSON` secret set, choose a **play_track** when running the workflow: `internal` (internal testing), `alpha` (the default closed testing track), `beta` (open testing) or `production`. The workflow uploads the bundle and the matching `changelogs/<versionCode>.txt`, and always creates a **draft** release, so nothing reaches users until you open Play Console, review the draft and roll it out. Google's API can only update an app that already has an upload made through Play Console ([Edits](https://developers.google.com/android-publisher/edits)), so the first release is always the manual one from step 5.

To create the service account with the least access it needs ([Play Developer API setup](https://developers.google.com/android-publisher/getting_started)):

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project (for example `doall-play`) and **enable the Google Play Android Developer API** for it. Linking the project to Play Console is no longer needed.
2. **IAM & Admin → Service accounts → Create service account**, named for example `doall-ci`. Skip the optional step that grants it roles on the project: it needs none.
3. Open the service account, then **Keys → Add key → Create new key → JSON**. The file downloads once; anyone holding it can act as the account ([service account keys](https://docs.cloud.google.com/iam/docs/keys-create-delete)).
4. In Play Console, **Users and permissions → Invite new users**, enter the service account's email address, and on the **App permissions** tab add **only DoAll** with ([permissions](https://support.google.com/googleplay/android-developer/answer/9844686)):
   - **View app information (read-only)**
   - **Release apps to testing tracks**
   - **Release to production, exclude devices, and use Play App Signing**, only if the workflow should create production drafts

   Leave every account-level permission off.
5. Store the key as a secret and delete the downloaded file:

   ```bash
   gh secret set PLAY_SERVICE_ACCOUNT_JSON < doall-ci-key.json
   rm doall-ci-key.json
   ```

If the key ever leaks, delete it under **Keys** in the Cloud console and create a new one.

---

## Requirements checklist

| Requirement | How DoAll meets it | Where |
|---|---|---|
| New apps are published as an Android App Bundle ([source](https://developer.android.com/guide/app-bundle)) | CI builds `DoAll.aab` with `bundleRelease` and attaches it to every release | [`.github/workflows/android-apk.yml`](../../.github/workflows/android-apk.yml) |
| Signed with a private upload key, not the debug key | `DOALL_UPLOAD_*` Gradle properties or environment variables; Gradle warns when it falls back to the debug key | [`mobile/android/app/build.gradle`](../../mobile/android/app/build.gradle), [`mobile/scripts/create-upload-key.mjs`](../../mobile/scripts/create-upload-key.mjs) |
| Play App Signing ([source](https://support.google.com/googleplay/android-developer/answer/9842756)) | Google-generated app signing key, set up at the first upload | Play Console ([step 5](#internal-testing-the-first-upload-and-play-app-signing)) |
| Unique, permanent package name | `io.github.gauravtiwari31.doallapp` | `applicationId` in [`mobile/android/app/build.gradle`](../../mobile/android/app/build.gradle) |
| A higher version code for every upload | `versionCode` is derived from the version (`1.2.0` → `10200`) | `"version"` in [`mobile/package.json`](../../mobile/package.json) |
| New apps and updates target Android 16 (API 36) since 31 August 2026 ([source](https://developer.android.com/google/play/requirements/target-sdk)) | `targetSdkVersion = 36` | [`mobile/android/build.gradle`](../../mobile/android/build.gradle) |
| Native code supports 16 KB memory pages ([source](https://developer.android.com/guide/practices/page-sizes)) | React Native 0.87's native libraries support 16 KB pages; App bundle explorer confirms it per upload | [`mobile/package.json`](../../mobile/package.json) |
| Privacy policy in Play Console and inside the app ([source](https://support.google.com/googleplay/android-developer/answer/10144311)) | Served by the API at `/privacy` and linked from the app | [`backend/src`](../../backend/src), [`mobile/src/config.ts`](../../mobile/src/config.ts) |
| Account deletion in the app and on the web ([source](https://support.google.com/googleplay/android-developer/answer/13327111)) | **Profile → Delete account** (`DELETE /api/auth/me`) and the `/account/delete` page, confirmed with the password or, for accounts created with Google, with Google; both remove the account, every task and every session at once | [`backend/src/auth`](../../backend/src/auth), [`backend/src/legal`](../../backend/src/legal), [`mobile/src/components/DeleteAccountSheet.tsx`](../../mobile/src/components/DeleteAccountSheet.tsx) |
| Accurate Data safety answers ([source](https://support.google.com/googleplay/android-developer/answer/10787469)) | Answers derived from what the server and app actually store | [`data-safety.md`](data-safety.md) |
| Data encrypted in transit | The hosted API is HTTPS | `DOALL_API_URL` repository variable, [`mobile/src/env.ts`](../../mobile/src/env.ts) |
| On-device data stays on the device | App-private storage, excluded from cloud backup and device-to-device transfer | [`AndroidManifest.xml`](../../mobile/android/app/src/main/AndroidManifest.xml) |
| Sign-in details for reviewers ([source](https://support.google.com/googleplay/android-developer/answer/15748846)) | Demo account with sample tasks | Play Console ([step 3](#sign-in-details)) |
| Content rating, target audience, ads and other declarations | Answers in this guide | Play Console ([step 3](#app-content)) |
| Listing text within limits, without banned metadata ([source](https://support.google.com/googleplay/android-developer/answer/9898842)) | Title 23, short description 74, full description about 2,750, release notes about 285 characters | [`mobile/fastlane/metadata/android/en-US`](../../mobile/fastlane/metadata/android/en-US) |
| Icon, feature graphic and 2–8 phone screenshots ([source](https://support.google.com/googleplay/android-developer/answer/9866151)) | Rendered at the required sizes | `mobile/fastlane/metadata/android/en-US/images`, sources in [`docs/play-store/assets-src`](assets-src) |
| Closed test with 12 testers for 14 days (new personal accounts, [source](https://support.google.com/googleplay/android-developer/answer/14151465)) | Run before applying for production | Play Console ([step 5](#closed-testing-12-testers-for-14-days)) |
| Package registered for Android developer verification ([source](https://support.google.com/googleplay/android-developer/answer/16984799)) | Checked after the first upload | Play Console ([step 5](#internal-testing-the-first-upload-and-play-app-signing)) |

---

## Troubleshooting

**"You need to use a different package name because … already exists in Google Play."**
Package names are unique across Google Play and are never released, not even when an app is deleted; that is why DoAll moved from `com.doall` to `io.github.gauravtiwari31.doallapp` (`io.github.gauravtiwari31.doall` was used by the 1.2.0 and 1.2.1 GitHub builds only). If this ever happens before the first upload, choose another reverse-domain name you control, change `applicationId` in `mobile/android/app/build.gradle` and every mention in these docs. After the first upload the package name can't change.

**"You uploaded an APK or Android App Bundle that was signed in debug mode."**
The build didn't find the upload key and fell back to the debug key (Gradle printed a warning). On CI, check the four `ANDROID_UPLOAD_*` secrets; locally, the four `DOALL_UPLOAD_*` properties. Verify with `keytool -printcert -jarfile …` as in [step 2](#on-your-own-computer).

**"Your Android App Bundle is signed with the wrong key."**
It was signed with a different upload key than the first upload, for example after re-running the key script with `--force`. Restore the original `.jks` from the backup. If it is really lost, create a new key and ask for an upload key reset under Play App Signing in Play Console (**Request upload key reset**, [instructions](https://support.google.com/googleplay/android-developer/answer/9842756)); Google support has to approve it.

**"Version code 10200 has already been used. Try another version code."**
Every upload needs a higher version code than any earlier one, even a rejected or never-released one. Bump `"version"` in `mobile/package.json` (1.2.0 → 1.2.1 gives 10201), add the matching `changelogs/<versionCode>.txt`, and build again.

**"There is no deobfuscation file associated with this App Bundle"** (or the similar note about native debug symbols)
Release builds are shrunk and obfuscated with R8, and Gradle packs the R8 mapping file and the native debug symbols (`ndk.debugSymbolLevel`) into the bundle, so Play Console normally has both. These notes are recommendations, not errors, and don't block a release; they only make crash reports readable. If one appears anyway, upload `mapping.txt` from the run's `DoAll-mapping` artifact under **App bundle explorer → Downloads → Assets** ([deobfuscation](https://support.google.com/googleplay/android-developer/answer/9848633)).

**The app says it can't reach the DoAll server, or that the server is taking a while, during review.**
Either the free Render instance was asleep (it sleeps after 15 minutes without traffic and needs 30–60 seconds to wake) or the build doesn't point at the hosted server. Keep the uptime monitor running, open `/api/health` before submitting, and mention the wake-up delay in the sign-in instructions (the suggested text already does). If the server pill on the welcome screen shows `10.0.2.2:3000`, the build was made without `DOALL_API_URL` or without the local `env.ts` change from [step 2](#2-build-the-app-bundle): rebuild with a higher version.

**People who installed the APK from GitHub.**
- **1.0 and 1.1** use the old package `com.doall` and the debug signature. The Play version is a different app to Android, so both end up installed side by side. Ask people to uninstall the old DoAll first; their tasks are on the server, so they just log in again.
- **1.2.0 and later** from GitHub are signed with the upload key, while Google Play delivers the app signed with Google's key. The two can't update each other: Google Play won't install over the GitHub copy and Android refuses the APK over the Play copy. Uninstall one before installing the other. To give GitHub users the same signature as Play, download the Google-signed universal APK from **App bundle explorer → Downloads** and attach it to the GitHub release instead.

**Continue with Google works in the GitHub APK or your own build, but not in the app from Google Play.**
Google Play re-signs the app with its app signing key, and Google only accepts sign-ins from fingerprints registered as Android clients. Add the *App signing key certificate* SHA-1 from **App integrity** as described in [docs/google-sign-in.md](../google-sign-in.md#3-create-the-android-clients-app); the Troubleshooting section there covers the other Google errors.

**The workflow fails before building a release.**
A tag push or a run with **release** set needs all four `ANDROID_UPLOAD_*` secrets, because a release has to be uploadable to Google Play. Run `npm run play:upload-key -- --github` (step 1), or leave **release** empty for a test build.

**App bundle explorer warns about 16 KB page sizes or the target API level.**
New apps and updates must target API 36 since 31 August 2026 (extensions to 1 November 2026 can be requested in Play Console), and native libraries must be aligned for 16 KB pages. Check `targetSdkVersion` in `mobile/android/build.gradle`. For alignment, run `zipalign -c -P 16 -v 4 DoAll.apk` from the Android build tools; a native library that isn't aligned usually means a dependency needs updating.
