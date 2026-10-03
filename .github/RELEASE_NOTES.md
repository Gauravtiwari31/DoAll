**DoAll** is an Android to-do app with accounts, a smart sort that tells you what to do next, and a paper & ink design.

### Install

1. Download **DoAll.apk** below. Open it on an Android phone (allow *Install unknown apps* when asked), or drag it onto a running emulator.
2. Create an account and start adding tasks. The app uses the hosted DoAll server, so there is nothing else to set up.

The server runs on a free plan and sleeps when nobody has used it for a while. If the first screen takes up to a minute to respond, it is waking up; after that it is quick.

**Using your own backend instead:** start it from the repository with `docker compose up -d --build` (see the README). In the app, tap the **server pill** at the top of the welcome screen and enter `10.0.2.2:3000` on the emulator, or your computer's Wi-Fi IP such as `192.168.1.20:3000` on a phone. Tap **Test**, then **Save**. **Reset to default** switches back to the hosted server.

### What's inside

- Email/password accounts with short-lived access tokens and rotating refresh tokens
- Tasks with date-time, deadline, priority, category and tags
- Smart sort (priority × deadline pressure × schedule) with an "Up next" pick and a per-task score breakdown
- Today / Upcoming / Overdue / Done views, filters and search
- Swipe right to complete, swipe left to delete, both with undo
- Progress ring, profile stats, light and dark themes

Requires Android 7.0 (API 24) or newer.
