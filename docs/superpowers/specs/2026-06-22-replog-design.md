# RepLog — Design Spec (v1, web)

**Date:** 2026-06-22
**Status:** Approved (brainstorming → spec)
**Owner:** Benas Barciauskas (`benasbarciauskas`)

## 1. Problem & goal

Benas has years of workout notes in his phone's Notes app — free-text, inconsistent format,
spanning 2023–2024+. Each note holds a title, one or more dates (sometimes a date *range* covering
a whole training block), bodyweight, a split label (`Monday - Chest and Back`, `Day 1: Push`, `PPL`),
and exercise lines like `Benchpress 5x5: 105x 5,5,5,5,4` or `OHP: 70kgx5, 60kgx 8`.

He wants an app that:
1. Lets him **upload those notes** (screenshots or pasted text) and have them parsed/categorised
   automatically by workout type, date, and split.
2. Shows his **all-time bests** per lift and *when* they happened, plus which split he ran in each block.
3. **Coaches** him: from the numbers, flags what's lacking — e.g. "you bench 140 but only overhead
   press 60, so your front delts are underdeveloped vs your chest" — and gives a prioritised focus list.

## 2. Hard constraints

- **No API key / no LLM in the product.** Everything runs on-device. (A seam is left for an optional
  in-browser model — WebLLM — as a future opt-in, not built in v1.)
- **No backend, no login, no cost.** Data lives in the browser (IndexedDB). A `Repository` interface
  abstracts storage so a Supabase sync layer can be added later without a rewrite.
- **Web first.** iOS (with Share Sheet import) is a separate codebase/repo, later.
- Mobile-first, fully responsive, subtle animations throughout, `prefers-reduced-motion` respected,
  dark-first theme.

## 3. Stack

| Concern | Choice |
|---|---|
| Framework | React + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Animation | framer-motion |
| OCR (screenshots → text) | Tesseract.js (lazy-loaded, in-browser) |
| Storage | Dexie (IndexedDB) behind a `Repository` interface |
| Date parsing | chrono-node |
| Fuzzy exercise matching | Fuse.js |
| Charts | Recharts (via shadcn chart components) |
| Routing | React Router |
| Packaging | Installable PWA (manifest + service worker) |
| Deploy | Vercel (static) |

## 4. Data model

All persistence goes through `Repository` (impl: `LocalRepository` = Dexie; future `CloudRepository`).

- **`RawNote`** — `{ id, sourceType: 'screenshot'|'paste'|'share', rawText, imageBlob?, importedAt, status: 'parsed'|'needs-review'|'confirmed' }`
- **`Workout`** — `{ id, date, bodyweightKg?, splitCanonical, splitRaw, blockId?, sourceNoteId, exercises: WorkoutExercise[] }`
- **`WorkoutExercise`** — `{ canonicalExerciseId, rawName, unit: 'kg'|'lb', sets: Set[] }`
- **`Set`** — `{ weightKg?, reps, isWarmup?, isFailure?, raw }`
- **`Exercise` (catalog)** — `{ id, canonicalName, aliases[], primaryMuscles[], secondaryMuscles[], category: 'push'|'pull'|'legs'|'core', pattern: 'horizontal-press'|'vertical-press'|'horizontal-pull'|'vertical-pull'|'squat'|'hinge'|'isolation' }`
- **`Block`** — inferred contiguous period running a given split (e.g. *19 Jun – 13 Sep 2023, PPL*).

Units stored canonically in kg; display toggle kg/lb.

## 5. Pipeline

`Ingest → Parse → Review/Confirm → Store → Analyze`

1. **Ingest** — dropzone for screenshot(s) or a paste box. Screenshots → Tesseract OCR → text.
2. **Parse** (deterministic, `src/parser/`):
   - Segment a note into per-workout chunks (a note can contain multiple dated sessions).
   - Extract date(s) (chrono-node), bodyweight (regex), split (keyword/synonym map), and exercise
     lines via a small grammar (`Name [sep] weight[unit] x reps[, reps...]`).
   - Normalise exercise names → canonical via alias dictionary + Fuse.js fuzzy fallback.
   - Emit `Workout` candidates with a per-field confidence; low-confidence fields flagged for review.
3. **Review/Confirm** — editable cards show extracted workouts; user fixes anything wrong; unknown
   exercises offer "add to catalog" with muscle tagging. Nothing is stored until confirmed.
4. **Store** — confirmed workouts → IndexedDB.
5. **Analyze** — derived views recomputed on data change (below).

## 6. Analytics (pure math)

- Per canonical exercise: max weight, best **estimated 1RM** (Epley: `w · (1 + reps/30)`), rep-PRs,
  and the date each landed.
- **PR timeline** and **bodyweight trend** over time.
- **Blocks**: contiguous date ranges + split → "which split you ran when" history.

## 7. Coach engine — "What's lacking" (the differentiator)

A `src/coach/ratios.ts` table of canonical strength relationships, each mapped to muscles and a
recommendation template. Initial set (exact bands verified by a research pass during build):

| Relationship | Healthy band | Deficit flag → muscle |
|---|---|---|
| Overhead Press / Bench | ~0.60–0.66 | low → front delts vs chest |
| Barbell Row / Bench | ~0.9–1.0 | low → upper back / push:pull imbalance |
| Squat / Bench | ~1.3–1.5 | low → quads/posterior chain |
| Deadlift / Squat | ~1.1–1.3 | low → posterior chain / hinge |
| Weighted Pull-up vs Press volume | heuristic | low → lats/biceps |

Plus a **coverage check**: muscle groups rarely/never trained across the dataset → "undertrained".

Output: per-finding card — the antagonist comparison spelled out, the affected muscle(s), and a
prioritised "focus on X" list. Deterministic and explainable (shows the ratio and the standard).

## 8. Views

1. **Import** — ingest + OCR/parse progress.
2. **Review & Confirm** — editable parsed cards.
3. **Dashboard ("My Times")** — all-time bests grid, PR timeline, bodyweight trend, split history.
4. **Exercise detail** — progression chart, PR history.
5. **Coach ("What's Lacking")** — imbalance findings + focus list.

## 9. Design quality

Built via the design skills (emil-design-eng, design-taste-frontend, impeccable, ui-ux-pro-max),
shadcn MCP + 21st-dev Magic MCP for components, Chrome DevTools MCP to verify the running UI.
Mobile-first; count-ups on PRs, staggered card reveals, route transitions; `prefers-reduced-motion`.

## 10. Out of scope v1 (seams left)

- iOS app (separate repo) + Share Sheet import.
- Cloud sync / login (Repository seam).
- WebLLM in-browser smart parsing (opt-in upgrade).
- Sharing / social.

## 11. Risks & mitigations

- **OCR/parse accuracy on messy notes** → the mandatory review step makes final accuracy 100%;
  per-field confidence highlights what to check.
- **Exercise-name sprawl** → alias dictionary + fuzzy match + "add to catalog" keeps the canonical set clean.
- **Coach ratio validity** → bands sourced from established strength standards, verified during build,
  and always shown alongside the recommendation so the user can judge.
