**DoAll** is an Android to-do app with accounts, a smart sort that tells you what to do next, and a paper & ink design.

### What's new in 1.2.1

- **Reminders arrive while the phone sleeps, offline too.** Android could hold reminders back while the phone was asleep without a connection; now they go off. When you turn on your first reminder, DoAll also asks once to allow on-time reminders (Android 14 and newer).
- Confirmation and password reset emails now come from DoAll's Gmail address.

### What's new in 1.2.0

- **Works offline.** Your tasks live on your phone and sync with the server in the background: add, edit and tick off tasks with no connection, and changes catch up once you're back online. Edits on two phones are merged, keeping the latest change of each task.
- **Reminders**: get a notification at the task's time, or 10 minutes to a day before. They come from your phone itself, so they work offline and after a restart. **Profile → Reminders not arriving?** checks the phone settings that can silence them.
- **Repeating tasks**: daily, on weekdays, weekly on chosen days, monthly, yearly or hourly, every N of them. Ticking one off moves it to its next time. "Monthly on the 31st" uses the last day of shorter months, and 29 February repeats on the 28th in other years.
- **Forgot your password?** Get a reset link by email from the log in screen.
- **Confirm your email** to back up and sync your tasks. Google accounts are already confirmed.
- **Export my data** (Profile) saves all your tasks as a JSON file wherever you choose.
- **Continue with Google**: sign up or log in with your Google account. If you already have a DoAll account with the same email address, enter its password once to connect the two.
- **Delete your account** whenever you like: **Profile → Delete account** in the app, or [on the web](https://doall-api-m1yy.onrender.com/account/delete), confirming with your password or with Google. Your account, all of your tasks and every sign-in session are removed immediately and permanently.
- **Privacy policy**, linked from the sign-up and profile screens ([read it here](https://doall-api-m1yy.onrender.com/privacy)).
- **Ready for Google Play:** a new package ID (`io.github.gauravtiwari31.doall`), signed with a private release key, and a smaller, optimized build. The profile screen shows the app version.
- Sheets with a text field (server address, delete account) now stay above the keyboard.

### Upgrading from 1.0 or 1.1

Because of the new package ID and signature, Android treats 1.2.0 as a different app: it installs next to the old version instead of updating it. Uninstall the old DoAll first. Your tasks are stored on the server, so just log in again.

### Install

1. Download **DoAll.apk** below. Open it on an Android phone (allow *Install unknown apps* when asked), or drag it onto a running emulator. **DoAll.aab** is the app bundle for Google Play; phones can't install it directly.
2. Create an account and start adding tasks. The app uses the hosted DoAll server, so there is nothing else to set up.

The server runs on a free plan and sleeps when nobody has used it for a while. If the first screen takes up to a minute to respond, it is waking up; after that it is quick.

**Using your own backend instead:** start it from the repository with `docker compose up -d --build` (see the README). In the app, tap the **server pill** at the top of the welcome screen and enter `10.0.2.2:3000` on the emulator, or your computer's Wi-Fi IP such as `192.168.1.20:3000` on a phone. Tap **Test**, then **Save**. **Reset to default** switches back to the hosted server.

### What's inside

- Email/password or Google accounts, with short-lived access tokens and rotating refresh tokens
- Tasks with date-time, deadline, priority, category, tags, reminders and repeats
- Offline-first: tasks are stored on the phone and synced in the background
- Smart sort (priority × deadline pressure × schedule) with an "Up next" pick and a per-task score breakdown
- Today / Upcoming / Overdue / Done views, filters and search
- Swipe right to complete, swipe left to delete, both with undo
- Progress ring, profile stats, light and dark themes
- No ads, no analytics, no tracking; delete your account at any time

Requires Android 7.0 (API 24) or newer.
