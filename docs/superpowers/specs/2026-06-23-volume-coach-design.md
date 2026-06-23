# Volume Coach — design spec (2026-06-23)

## What

A weekly working-sets-per-muscle coach, **additive** to the existing strength-ratio
coach. It answers a different question from the ratio engine: not "are my lifts
balanced against each other?" but "am I putting enough weekly volume into each
muscle to drive growth?" The output drives a new "Weekly volume" section on the
Coach page that replaces the older all-time "Muscle coverage" view.

Like everything else in RepLog this is 100% client-side, deterministic, and pure
— no `Date.now()` inside the engine, no LLM, no network. All data stays on-device.

## Engine — `src/coach/volume.ts`

Pure, deterministic functions. Public contract:

```ts
export type VolumeStatus = 'never' | 'under' | 'optimal' | 'high';

export interface MuscleVolume {
  muscle: MuscleGroup;
  setsPerWeek: number;   // window total / weeks, fractional
  totalSets: number;     // fractional working sets in window
  status: VolumeStatus;
}

export interface VolumeReport {
  weeks: number;             // window actually used (>=1)
  anchorDate: string | null; // most-recent in-range workout date, or null
  muscles: MuscleVolume[];   // ALL 16 MuscleGroups, sorted DESC by setsPerWeek
}

export function buildMuscleLookup(
  defs: ExerciseDef[],
): Map<string, { primary: MuscleGroup[]; secondary: MuscleGroup[] }>;

export function weeklyMuscleVolume(
  workouts: Workout[],
  lookup: Map<string, { primary: MuscleGroup[]; secondary: MuscleGroup[] }>,
  opts?: { weeks?: number; anchor?: string },
): VolumeReport;
```

### Counting rules

- **Window** = the last `weeks` calendar weeks (default `4`). Dates in the inclusive
  range `[anchor - (weeks * 7 - 1) days, anchor]` count. `anchor` defaults to the
  MAX workout `date` (ISO `yyyy-mm-dd`) across all workouts. If there are no
  workouts, `anchorDate` is `null` and every muscle is `never`. `weeks` is clamped
  to `>= 1`. Date comparisons are deterministic (ISO-string / `Date` math, never
  `Date.now()`).
- A **working set** is a logged set whose `isWarmup` is not truthy.
- For each in-window workout, for each exercise: `workingSets` = count of
  non-warmup sets. Look up the exercise's muscles by `exercise.exerciseId` in
  `lookup`. Each **primary** muscle gains `workingSets * 1.0`; each **secondary**
  muscle gains `workingSets * 0.5`. Exercises NOT in the lookup contribute nothing
  (never fabricate muscle attributions).
- `setsPerWeek = totalSets / weeks`.

### Classification — by `setsPerWeek`

| setsPerWeek          | status    |
| -------------------- | --------- |
| `0`                  | `never`   |
| `> 0` and `< 8`      | `under`   |
| `>= 8` and `<= 20`   | `optimal` |
| `> 20`               | `high`    |

### `buildMuscleLookup`

Maps each `def.id` → `{ primary: def.primaryMuscles, secondary: def.secondaryMuscles }`.
This is what lets custom (user-defined) exercises contribute volume: pass the full
catalog (`createCatalog(custom).all()`) through it.

### Landmarks

The 8 / 20 sets-per-week landmarks are fixed (evidence-based: Schoenfeld 2017
dose-response review + Israetel MEV/MAV/MRV volume-landmark framework). They are
not per-muscle or user-configurable in v1; a `// ponytail:` comment in the source
notes this could be made configurable later.

## Hook — `src/data/hooks.ts`

`useWeeklyVolume(weeks = 4): VolumeReport`, mirroring `useCoachFindings`. Uses
`useLiveQuery` over BOTH `db.workouts` and `db.customExercises` (via `Promise.all`),
builds the lookup from `createCatalog(custom).all()` → `buildMuscleLookup`, then
`weeklyMuscleVolume`. Seeded with an empty report `{ weeks, anchorDate: null,
muscles: [] }`.

## UI — `src/features/coach/CoachPage.tsx`

Replaces the old "Muscle coverage" section (driven by the now-removed
`muscleCoverage` engine) with a "Weekly volume" section driven by
`useWeeklyVolume()`. All other sections (Balance Score ring, By area, Do this to
improve, Unlock more) stay exactly as-is.

- Caption: "Average working sets per muscle over the last 4 weeks. Compound lifts
  credit primary muscles fully and secondary muscles at half."
- **Undertrained** (`under` + `never`): the headline actionable group, warn/
  destructive tone, reusing the `CoverageCard` look. Each chip reads
  `Human Muscle · N/wk` (1 decimal, e.g. `4.5/wk`; `never` reads `0/wk`).
- **Optimal** (`optimal`): highlight/lime tone, compact chips, "In the sweet spot
  (8–20 sets/wk)".
- **High volume** (`high`): only rendered when any exist; an info/warn note "Above
  ~20 sets/wk — watch recovery."
- If there are zero in-window working sets while the user DOES have workouts
  overall, show a gentle note: "No working sets in the last 4 weeks — log a session
  to see your volume balance." (The page already early-returns when
  `workouts.length === 0`.)
- `setsPerWeek` is formatted to 1dp with trailing `.0` dropped (so `6`, not `6.0`;
  `4.5` stays `4.5`). Existing motion / `prefers-reduced-motion` and className
  patterns are followed.

## Cleanup — `src/coach/analyze.ts`

The all-time `muscleCoverage` function and its only-used-by-it constants
(`EXERCISE_MUSCLES`, `ALL_MUSCLES`, `UNDERTRAINED_THRESHOLD`) are removed; the new
weekly engine supersedes them. Everything used by `analyzeImbalances` stays. The
matching `muscleCoverage` tests in `analyze.test.ts` are removed; all
`analyzeImbalances` tests keep passing.
