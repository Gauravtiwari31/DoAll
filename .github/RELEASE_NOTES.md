**DoAll** is an Android to-do app with accounts, a smart sort that tells you what to do next, and a paper & ink design.

### Install

1. Download **DoAll.apk** below. Open it on an Android phone (allow *Install unknown apps* when asked), or drag it onto a running emulator.
2. Start the backend from the repository: `docker compose up -d --build` (see the README).
3. In the app, tap the **server pill** at the top of the welcome screen and point it at the backend:
   - **Emulator:** keep the default `10.0.2.2:3000`
   - **Phone:** your computer's Wi-Fi IP, e.g. `192.168.1.20:3000` (same network, port 3000 open)

   Tap **Test** to check the connection, then **Save**.

### What's inside

- Email/password accounts with short-lived access tokens and rotating refresh tokens
- Tasks with date-time, deadline, priority, category and tags
- Smart sort (priority × deadline pressure × schedule) with an "Up next" pick and a per-task score breakdown
- Today / Upcoming / Overdue / Done views, filters and search
- Swipe right to complete, swipe left to delete, both with undo
- Progress ring, profile stats, light and dark themes

Requires Android 7.0 (API 24) or newer.
