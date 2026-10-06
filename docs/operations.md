# Running DoAll: the owner's checklist

Everything below is set up in someone's own accounts (Render, MongoDB Atlas, GitHub, an email service, Sentry), so it can't be done from the code. Each part is optional unless it says otherwise; the app and server work without it and simply skip that feature.

| Part | What it gives | Where it's configured |
|---|---|---|
| [Keep-alive monitor](#1-keep-the-server-awake) | No 30-60 s wake-up delay on the free Render plan | An uptime monitor service |
| [Email](#2-email-confirmation-and-password-reset) | "Forgot password?" and email confirmation | Your Gmail (Apps Script), Render env vars |
| [Backups](#3-nightly-database-backups) | A way back if the database is lost (Atlas M0 has no backups) | MongoDB Atlas, GitHub secrets |
| [Crash reports](#4-crash-reports-with-sentry) | Knowing when the app or server crashes | Sentry, Render env var, GitHub variables |
| [Database access](#5-mongodb-atlas-access) | Least-privilege database users | MongoDB Atlas |
| [Your own domain](#6-your-own-domain-optional) | Moving hosts later without an app update | A domain, Render |
| [Device testing](#7-test-reminders-on-real-phones) | Reminders that really arrive | Real phones |

---

## 1. Keep the server awake

Render's free web services sleep after 15 minutes without requests, and the first request after that waits 30-60 seconds. Since 1.2.0 the app keeps tasks on the phone and syncs in the background, so users no longer wait on it, but sign-in and the first sync after a sleep are still slow.

A free uptime monitor fixes it by requesting the health endpoint every few minutes:

1. Sign up at [UptimeRobot](https://uptimerobot.com) (free: 50 monitors, 5-minute checks). [cron-job.org](https://cron-job.org) or Pulsetic work the same way.
2. **New monitor → HTTP(s)**:
   - URL: `https://doall-api-m1yy.onrender.com/api/health`
   - Interval: **5 minutes** (anything under 15)
   - Optionally, **Keyword** monitoring for `"db":"up"`, so you're also told when the database is unreachable.
3. Add your email as an alert contact: you now hear about outages too.

One always-on service uses about 744 of the free plan's 750 instance-hours a month, so this fits, but only for **one** free service. Render discourages keep-alive pings on the free plan and could change its rules, so for real users plan on a paid instance ([Render Starter](https://render.com/pricing)) or a small VPS; see [6](#6-your-own-domain-optional) for making that move painless. Ping `/api/health`, not `/robots.txt` (Render answers that itself without waking the app).

---

## 2. Email: confirmation and password reset

The server sends two emails: a link to confirm the address after sign-up (sync waits for it) and, when asked, a password reset link. They go through an email API over HTTPS, because Render's free plan blocks outgoing SMTP.

**While email isn't set up**, nothing changes for users: no emails, no confirmation needed, and "Forgot password?" says the server can't send emails.

### Your Gmail (no domain needed)

DoAll's emails are sent by a small Google Apps Script in your Google account, so they come from your own Gmail address. Free, about 100 emails a day.

1. **Create the script.** Go to [script.google.com](https://script.google.com) (signed in to the Gmail you want to send from) → **New project**. Name it `DoAll mailer`. Replace everything in `Code.gs` with the contents of [`backend/scripts/gmail-mailer.gs`](../backend/scripts/gmail-mailer.gs), and **Save**.
2. **Make a secret.** Generate a random value (or any 40+ random letters and digits):

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   In the script: **Project Settings** (gear icon) → **Script Properties** → **Add script property**: property `SECRET`, value = that secret → **Save script properties**.
3. **Deploy it.** **Deploy → New deployment** → gear icon → **Web app**:
   - Description: `DoAll mailer`
   - Execute as: **Me**
   - Who has access: **Anyone** (anyone can call the URL, but nothing is sent without the secret)

   **Deploy**, then **Authorize access**: choose your Google account. Google warns that the app isn't verified, because it's your own script: **Advanced → Go to DoAll mailer (unsafe) → Allow**. Copy the **Web app URL** (`https://script.google.com/macros/s/…/exec`).
4. **Tell the server.** In Render, **doall-api → Environment**, set these and remove any others starting with `MAIL_` left from before:

   | Key | Value |
   |---|---|
   | `MAIL_PROVIDER` | `gmail` |
   | `MAIL_API_KEY` | the secret from step 2 |
   | `MAIL_FROM` | `DoAll <your gmail address>` (only the name `DoAll` is used) |
   | `MAIL_SCRIPT_URL` | the Web app URL from step 3 |

   `PUBLIC_URL` isn't needed on Render: the links use `RENDER_EXTERNAL_URL`, which Render sets. Set `PUBLIC_URL` if you move to a custom domain or another host.
5. **Save and redeploy**, then test: register a new email account in the app (or use **Forgot password?**). The email arrives from your Gmail; it also shows in that Gmail's **Sent** folder.

If you edit the script later, publish the change with **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**; the URL stays the same. If an email doesn't arrive, Render's log has a line starting `Couldn't send` with the script's answer: `Wrong secret` means `MAIL_API_KEY` and the script's `SECRET` differ; an HTML answer means the deployment isn't shared with **Anyone**.

### Resend (needs a domain)

Resend only sends to other people from a domain you've verified. Add the domain in [Resend](https://resend.com), create an API key, and set `MAIL_PROVIDER=resend`, `MAIL_API_KEY`, `MAIL_FROM=DoAll <no-reply@yourdomain>`.

### What users see

- Accounts that sign up with email and password get the confirmation email. Until they open it, the app works normally on the phone, but **Profile → Backup & sync** says "Confirm your email to back up", with **Resend email**.
- Google accounts count as confirmed.
- Accounts from before 1.2.0 also need to confirm once email is on. Their existing tasks still download to the phone and everything works there, but uploading changes waits for the confirmation. Tell existing users to expect the email.

The privacy policy names the email service automatically (from `MAIL_PROVIDER`).

---

## 3. Nightly database backups

MongoDB Atlas's free M0 cluster keeps no backups. The **Database backup** workflow (`.github/workflows/backup.yml`) copies the whole database every night at 03:00 India time, encrypts it, and keeps it for 30 days as a GitHub Actions artifact. It skips itself (with a warning) until these two secrets exist.

1. **A read-only database user.** Atlas → **Database Access → Add new database user**: user `doall-backup`, a generated password, **Built-in role: Only read any database** (or a custom role with `read` on `doall`). Copy its connection string from **Connect → Drivers**, with that user and password, and the database name: `mongodb+srv://doall-backup:<password>@<cluster>/doall?retryWrites=true&w=majority`.
2. **A passphrase.** Generate one and keep it in your password manager. Without it the backups can't be opened:

   ```bash
   openssl rand -base64 32
   ```
3. **GitHub → Settings → Secrets and variables → Actions → New repository secret**: `MONGODB_URI` (step 1) and `BACKUP_PASSPHRASE` (step 2). Or with the GitHub CLI: `gh secret set MONGODB_URI` and `gh secret set BACKUP_PASSPHRASE`.
4. **Actions → Database backup → Run workflow** once, and check that the run has a `doall-backup-<date>` artifact.

### Test a restore (do this once)

A backup you've never restored is a hope, not a backup. Restore into a separate database and compare the counts:

```bash
# Download the artifact from the run page, unzip it, then:
gpg --decrypt doall-backup-2026-10-06.tar.gz.gpg > backup.tar.gz   # asks for the passphrase
tar -xzf backup.tar.gz
cd backend
# A scratch database: local Docker, or a new database name on Atlas.
MONGODB_URI=mongodb://localhost:27017/doall_restore_test node scripts/restore.mjs ../doall-backup-2026-10-06 --yes
```

It prints each collection's document count next to the count in the backup, and fails on a mismatch. To restore production for real, point `MONGODB_URI` at the production database (with a user that can write) and stop the Render service first.

The app is offline-first, so after a restore the phones' copies sync back any changes made since the backup.

---

## 4. Crash reports with Sentry

Both the app and the server include Sentry, switched off until they're given a DSN. Reports contain the error and code location, app version, phone model and Android version; no request bodies, headers, query strings, IP addresses, screenshots or task content.

1. Sign up at [Sentry](https://sentry.io) (free Developer plan: 5,000 errors a month).
2. Create two projects: **React Native** (`doall-app`) and **Node.js / NestJS** (`doall-api`). Copy each one's DSN (**Project settings → Client Keys**).
3. **Server:** in Render, add `SENTRY_DSN` = the `doall-api` DSN.
4. **App:** GitHub → **Settings → Secrets and variables → Actions → Variables**: `DOALL_SENTRY_DSN` = the `doall-app` DSN. The next build reports crashes.
5. **Readable stack traces (recommended):** without the app's source maps, reports point into minified code. Create an **Organization auth token** (**Settings → Auth Tokens**), then add the secret `SENTRY_AUTH_TOKEN` and the variables `SENTRY_ORG` (your organization slug) and `SENTRY_PROJECT` (`doall-app`). Release builds then upload their source maps.
6. Before releasing a build with `DOALL_SENTRY_DSN`, update the Play **Data safety** form: select Crash logs and Diagnostics ([data-safety.md](play-store/data-safety.md)). The privacy policy already describes crash reports.

---

## 5. MongoDB Atlas access

- **Network access:** Render's free plan and GitHub's runners have no fixed IP addresses, so the cluster has to allow `0.0.0.0/0`. That makes the users below the real protection.
- **The app's user** should have **readWrite** on the `doall` database only (a custom role, or **Specific privileges**), not *Atlas admin*, with a long generated password. That's the one in Render's `MONGODB_URI`.
- **The backup user** only reads (see [3](#3-nightly-database-backups)).
- Connection strings are `mongodb+srv://`, which always uses TLS.
- If a connection string has ever been pasted somewhere public, change that user's password in Atlas and update Render and GitHub.

---

## 6. Your own domain (optional)

The app talks to the address it was built with. If that is `doall-api-m1yy.onrender.com`, moving to another host means a new app version. Putting the API behind a domain you control keeps that a one-day job: point the domain somewhere else, and nothing in the app changes.

1. Buy a domain and, in Render, **doall-api → Settings → Custom Domains → Add**, e.g. `api.yourdomain.com`; create the DNS record Render shows. Render adds HTTPS itself.
2. Set `PUBLIC_URL=https://api.yourdomain.com` in Render (email links).
3. Set the GitHub variable `DOALL_API_URL=https://api.yourdomain.com` and build a new app version. Keep the old `onrender.com` address working until old versions have updated.
4. In Play Console, change the privacy policy and account deletion URLs to the new domain.

**Moving hosts later:** the backend is a Docker image (`backend/Dockerfile`) configured only by environment variables (`backend/.env.example`). On the new host: run the image, set the same variables, restore the latest backup if the database moves too ([3](#3-nightly-database-backups)), then point the domain at it.

---

## 7. Test reminders on real phones

Emulators don't show what phone makers' battery savers do. Before the closed test, on at least one stock-Android phone and one Xiaomi, Oppo, Realme or Vivo phone (use a release build, not a debug build):

- [ ] Turn on a reminder; the notification permission prompt appears (Android 13+) and a reminder at the time arrives.
- [ ] A repeating task ("daily") reminds two days in a row without opening the app in between.
- [ ] **Restart the phone** with a reminder due in 5 minutes: it still arrives.
- [ ] Leave the phone untouched, screen off, for an hour with a reminder due: it arrives on time (within ~10 minutes if **Alarms & reminders** isn't allowed).
- [ ] Tapping a reminder opens that task.
- [ ] **Profile → Reminders not arriving?** shows the right state, and each button opens the matching settings screen.
- [ ] Airplane mode: add, edit and complete tasks; turn the network back on and they appear on a second phone signed in to the same account.
- [ ] **Export my data** saves a readable JSON file.

If a phone maker's saver still blocks reminders, its settings path probably differs from the ones on the Reminders screen (`mobile/src/screens/RemindersScreen.tsx`); add the right one there.
