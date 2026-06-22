# RepLog

Turn messy workout notes into a coach.

Upload screenshots or paste text from your phone's notes → RepLog reads them, tracks every
all-time best (and *when* it happened), maps your training splits over time, and tells you
**what's lacking** — which muscles are underdeveloped relative to their antagonists, so you
know what to prioritise.

## What it does

- **Import** — drop screenshots of your notes (in-browser OCR, no upload to any server) or paste raw text.
- **Parse + review** — a deterministic parser extracts dates, bodyweight, the split, and every
  `exercise: weight × reps` line, then normalises names (*Benchpress / Bench / Flat bench → Barbell Bench Press*).
  You confirm/fix the result in a quick review step, so accuracy ends at 100%.
- **My Times** — all-time bests, estimated 1RMs, PR timeline, bodyweight trend, split-by-block history.
- **Coach ("What's Lacking")** — real strength-ratio standards (e.g. overhead press vs bench →
  front-delt deficit) flag imbalances and give you a prioritised focus list.

## Principles

- **100% on-device.** No backend, no API key, no cost. Your data lives in your browser (IndexedDB)
  and never leaves it. The data layer is behind a `Repository` interface so cloud sync can be added later.
- **Installable PWA** — works offline, adds to your home screen.

## Stack

React + Vite + TypeScript · Tailwind + shadcn/ui · framer-motion · Tesseract.js (OCR) ·
Dexie/IndexedDB · chrono-node · Fuse.js · Recharts.

## Status

v1 (web) in progress. iOS app (Share Sheet import) and optional in-browser AI parsing (WebLLM)
are out of scope for v1 — seams left for both.

See the design spec: [`docs/superpowers/specs/2026-06-22-replog-design.md`](docs/superpowers/specs/2026-06-22-replog-design.md).
