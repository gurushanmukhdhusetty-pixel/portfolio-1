# Life OS

A personal life manager for one person: boards for each part of life, with notes, checklists, to-dos and files on each one, plus Today, Week, Inbox, Search and a Focus timer. It works on a phone first and installs to the home screen.

**Highlights:** the life ring on Today (each board's arc fills as you finish its to-dos), Face ID unlock and app lock, a morning briefing notification, a study timer that logs focus time per course, a ⌘K command palette, swipe-to-dismiss sheets, undo on every delete, and light, dark or system themes.

**Live:** https://life-os-blond-one-20.vercel.app (password only, no username)

## What's already set up (nothing for you to do)

| Piece | Where | Notes |
|---|---|---|
| App + API | Vercel project `life-os` (Singapore) | Static React app plus one serverless function at `/api` |
| Database | Neon Postgres `life-os-db` (free plan, Singapore) | Linked through the Neon integration on your Vercel account |
| Files | Vercel Blob `life-os-private` (private store) | Files are only served after you log in |
| Password | `APP_PASSWORD` env var (sensitive) | Never in the code or git |
| Session signing | `SESSION_SECRET` env var (sensitive) | Random 32 bytes |
| Morning briefing | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (sensitive) | Web Push keys |
| Daily cron | `CRON_SECRET` (sensitive) + `crons` in `vercel.json` | `/api/cron/morning` at 02:00 UTC (07:30–08:29 IST) |

The database schema creates itself on first use. There are no migrations to run.

## Install on your phone

- **iPhone (Safari):** open the link → Share → *Add to Home Screen*.
- **Android (Chrome):** open the link → ⋮ menu → *Install app*.

Login lasts 180 days per device.

## Face ID, app lock, morning briefing

- **Face ID / Touch ID:** Settings → Security → *Set up*. After that the login screen shows *Unlock with Face ID*. Passkeys are tied to this exact web address, so they need setting up again if the app ever moves to a custom domain.
- **App lock:** Settings → Security → *App lock* asks for Face ID when you open the app, or come back after a minute away.
- **Morning briefing:** Settings → Notifications. On iPhone it only works from the Home Screen app (iOS 16.4+). It arrives between 7:30 and 8:30 IST with what's due, your Top 3, exams and birthdays. Use *Send a test now* to check it.

## Why it won't hit rate limits

- **One request loads everything.** On open, the app fetches all your data in a single query and caches it on the device (IndexedDB).
- **Reads are free.** Switching boards, searching and the Today/Week views run entirely on the device.
- **Writes are batched.** Edits apply instantly on screen and are sent together in one request a moment later. Typing in a note does not send a request per keystroke.
- **Refresh is throttled.** The app re-syncs when it comes back into focus, at most every 2 minutes.
- **It works offline.** Changes queue on the device and send when you're back online.

## Changing the password

Vercel → `life-os` project → Settings → Environment Variables → edit `APP_PASSWORD` → redeploy. Changing it signs out every device. After 10 wrong attempts in 15 minutes, login locks for 15 minutes.

## Local development

```bash
npm install
cp .env.example .env.local   # set APP_PASSWORD and a local DATABASE_URL
npm run dev                  # http://localhost:5173 (the /api routes run inside Vite)
```

Without `BLOB_READ_WRITE_TOKEN`, uploads are saved to `./.local-files`.

## Deploying changes

Automatic. The `life-os` Vercel project is connected to this repo:

- Push to `ccr-854260a8-axjmuj` (the current production branch) → the live site updates in about a minute.
- Push any other branch → you get a preview deployment with its own URL.

To make `main` the production branch later: Vercel → `life-os` → Settings → Git → Production Branch.

## Stack

Vite, React 19, TypeScript, Tailwind v4, Zustand (local-first store), TipTap (rich text), dnd-kit (kanban), Neon serverless Postgres, Vercel Blob, Vercel Functions, vite-plugin-pwa.

## Code map

- `server/schema.ts`: the data model (single source of truth; the DDL is generated from it)
- `server/api.ts`: every API route (login, snapshot, batched mutate, files, passkeys, push, cron)
- `server/passkeys.ts`, `server/push.ts`, `server/briefing.ts`: Face ID, notifications, the morning briefing
- `src/lib/focus.ts`: study timer (timestamp-based, survives reloads)
- `src/lib/store.ts`: local-first store, write queue, undo
- `src/lib/grades.ts`: grade calculator (best-of-N, what you need on the remaining components)
- `src/pages/*`: Today, Week, Inbox, Search, Boards
- `src/tabs/*`: board tabs (to-dos, notes, checklists, files, goals, grades, assessments, pipeline, people, habits)
