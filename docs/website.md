# The DoAll website

`web/` is DoAll for the browser: the same accounts and tasks as the Android app, kept in step through the server's `POST /sync`. It is a static site (Vite + React), so any static host can serve it; these steps use Cloudflare Pages.

| | |
|---|---|
| **Accounts** | The app's: email and password, or Google. Same email = same tasks. |
| **Sync** | The app's protocol. Tasks are kept in the browser (localStorage) and synced on open, a moment after each change, every minute while the tab is visible, and when the connection comes back. Last change wins. |
| **Shared code** | Repeat rules, time zones, smart order and validation are imported from `mobile/src` (alias `@app`), so the site and the app can't disagree about them. |
| **Ads** | Google AdSense, only when configured, with "Don't want to see ads? Get the app" under each ad. |
| **Secret** | Focus mode (see [below](#the-secret-feature)). |

## Run it locally

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm test           # sync and task rules
npm run build      # type-checks, then builds into web/dist
```

By default the site talks to the hosted API. That only works from an address the server allows (step 2 below); for a backend on your computer, create `web/.env.local` with `VITE_API_URL=http://localhost:3000/api` and start the backend with `CORS_ORIGINS=http://localhost:5173`.

## 1. Deploy on Cloudflare Pages

1. [Cloudflare dashboard](https://dash.cloudflare.com) → **Workers & Pages → Create → Pages → Connect to Git** → pick the DoAll repository.
2. Build settings:

   | Setting | Value |
   |---|---|
   | Framework preset | None |
   | Root directory | `web` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

3. **Environment variables** (Settings → Variables and Secrets; all of them end up in the page, none is secret):

   | Variable | Value |
   |---|---|
   | `NODE_VERSION` | `22` |
   | `VITE_GOOGLE_CLIENT_ID` | The server's Web OAuth client ID (Render's `GOOGLE_CLIENT_ID`). Leave out to hide "Continue with Google". |
   | `VITE_ADSENSE_CLIENT` | Later, from AdSense (step 4), e.g. `ca-pub-1234567890123456` |
   | `VITE_ADSENSE_SLOT` | Later, from AdSense (step 4) |
   | `VITE_PLAY_STORE_URL` | Once the app is public (step 5) |
   | `VITE_API_URL` | Only if the API moves; defaults to `https://doall-api-m1yy.onrender.com/api` |

4. **Save and Deploy.** The site is at `https://<project>.pages.dev`. Every push to the repository deploys again. Under **Settings → Build → Build watch paths**, include `web/*` and `mobile/src/*` (the site uses code from both) so unrelated pushes don't rebuild it.

Changing a variable only takes effect in the next build: **Deployments → … → Retry deployment**.

## 2. Let the site talk to the server

Browsers only let a page call another address when that address allows it. In Render, **doall-api → Environment**, add:

| Key | Value |
|---|---|
| `CORS_ORIGINS` | The site's addresses, comma-separated, no trailing slash: `https://<project>.pages.dev,https://yourdomain.com,https://www.yourdomain.com` |

Save; Render redeploys. Without it, sign-in on the site fails with "Can't reach the DoAll server".

## 3. Continue with Google on the site

Google Cloud Console → **APIs & Services → Credentials** → the **Web application** client (the one whose ID is `GOOGLE_CLIENT_ID` on Render) → **Authorized JavaScript origins → Add URI**: each address the site is served from (`https://<project>.pages.dev`, `https://yourdomain.com`, and `http://localhost:5173` for local testing). Save. It can take a few minutes to apply.

The Android clients don't change: the site signs in with the Web client, like the server.

## 4. Ads with Google AdSense

**Cloudflare Pages works with AdSense**: AdSense only cares about the page, not the host. What it does need is **a domain of your own**. AdSense approves whole sites by their domain, and you can't prove ownership of `pages.dev` (the same goes for `github.io`, `netlify.app` and so on), so a `*.pages.dev` address alone will not be approved.

1. **Get a domain** and add it to the Pages project: **Custom domains → Set up a domain**. [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) sells domains at cost, which also makes the DNS step automatic. Add the new address to `CORS_ORIGINS` (step 2) and the Google origins (step 3).
2. **Apply**: sign up at [AdSense](https://adsense.google.com) with your Google account → **Sites → Add site** → your domain (without `www`).
3. **Connect the site**: copy your publisher ID (`ca-pub-…`, under **Account → Account information**), set it as `VITE_ADSENSE_CLIENT` on Cloudflare and redeploy. The build then puts the AdSense script and the `google-adsense-account` tag in every page and creates `ads.txt`, which covers all three verification methods AdSense offers. Back in AdSense, tick the verification and **Request review**.
4. **Consent for Europe**: AdSense → **Privacy & messaging → European regulations → Create** a message (Google's own consent banner; no code needed). Without it, visitors in the EEA, UK and Switzerland only get limited ads.
5. **Wait for approval.** It usually takes a few days, sometimes a few weeks. Google reviews the public pages, which is why the landing page explains the product in full; the site also has its own [privacy page](../web/privacy.html), which AdSense requires.
6. **Create an ad unit** once approved: **Ads → By ad unit → Display ads** → name it `DoAll web`, **Responsive** → **Create** → copy the `data-ad-slot` number into `VITE_ADSENSE_SLOT`, and redeploy.

Ads then show on the landing page and beside the task list, each with "Don't want to see ads? Get the app" under it. Until both `VITE_ADSENSE_*` values are set, no ad code is loaded at all.

Don't click your own ads, or ask others to: AdSense closes accounts for it. Use **AdSense → Ads → Preview** to see them instead.

## 5. Link to the app on Google Play

Until `VITE_PLAY_STORE_URL` is set, the button under each ad says "Coming soon to Google Play". Once the app is public on Play, set:

```
VITE_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=io.github.gauravtiwari31.doallapp
```

and **Retry deployment**. (That address only works once the app is in production; during closed testing it shows "not found" to everyone outside the test.)

## The secret feature

**Focus mode** is hidden until someone finds it:

- type the Konami code anywhere on the site: **↑ ↑ ↓ ↓ ← → ← → B A**, or
- tap the **DoAll logo 7 times** quickly (for phones).

A **Focus** button then appears at the top (remembered in that browser). It shows one task at a time, the one DoAll's smart order puts first (another can be picked), with a 25-minute focus timer, 5-minute breaks, a chime when time is up, and the countdown in the tab's title. **Done** ticks the task off like the checkbox does.

## What the site doesn't do

- **Reminders ring only on the phone.** Reminders set on the site are saved with the task, and the Android app rings for them.
- **The first request after a quiet spell can take up to a minute** while the free Render server wakes up; the sign-in form says so. A keep-alive monitor fixes it ([operations.md](operations.md#1-keep-the-server-awake)).
- Signing out removes the account's tasks from that browser. Changes not yet synced are lost, and the site asks first.
