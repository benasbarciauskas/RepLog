# RepLog

Turn messy workout notes into a coach.

Upload screenshots, paste text, or record your screen from your phone's notes →
RepLog reads them, tracks every all-time best (and *when* it happened), maps your
training splits over time, and tells you **what's lacking** — which muscles are
underdeveloped relative to their antagonists, so you know what to prioritise.

**Live app: `<LIVE_URL>`** *(replace once deployed)* — installable to your home
screen, works offline.

## Features

- **Import three ways** — screenshots (in-browser OCR), pasted text, or a screen
  recording. Nothing is uploaded; everything is read on-device.
- **Auto-filter** — paste whole notes; RepLog drops anything that isn't a workout.
- **Parse + review** — a deterministic parser extracts dates, bodyweight, the
  split, and every `exercise: weight × reps` line, normalises names
  (*Benchpress / Bench / Flat bench → Barbell Bench Press*), and lets you
  confirm/fix before saving, so accuracy ends at 100%.
- **Dashboard** — all-time bests, estimated 1RMs, PR timeline, bodyweight trend,
  and split-by-block history.
- **Coach ("What's Lacking")** — real strength-ratio standards (e.g. overhead
  press vs bench → front-delt deficit) flag imbalances and give a prioritised
  focus list.
- **Try with sample data** — load a few demo workouts to explore, then clear them.
- **Installable PWA** — add to your home screen; works offline.

## Principles

- **100% on-device.** No backend, no API key, no LLM, no cost. Your data lives in
  your browser (IndexedDB) and never leaves it. The data layer sits behind a
  `Repository` interface so cloud sync can be added later without a rewrite.

## Stack

React + Vite + TypeScript · Tailwind v4 + shadcn/ui · motion · Tesseract.js (OCR) ·
Dexie/IndexedDB · chrono-node · Fuse.js · Recharts. Deploy: Vercel (static).

## Docs

- [**TUTORIAL.md**](TUTORIAL.md) — use it, import your notes, run from source, and
  the planned Expo mobile app.
- [**DESIGN.md**](DESIGN.md) — the visual design system.
- [Product spec](docs/superpowers/specs/2026-06-22-replog-design.md).

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # static build → dist/ (PWA manifest + service worker emitted)
npm test         # tests
npm run lint     # eslint
```

Requires Node 20+. See [TUTORIAL.md § C](TUTORIAL.md#c-run-from-source-developers)
for deploy notes (Vercel SPA rewrite).

## Status

v1 (web). The native iOS/Android app (Expo, reusing this app's parser/analytics/
coach) is a separate repo, planned — see [TUTORIAL.md § D](TUTORIAL.md#d-mobile-app-via-expo-coming-separate-repo).
Cloud sync / login and optional in-browser AI parsing (WebLLM) are out of scope
for v1; seams are left for both.
