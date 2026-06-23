import { newId } from '@/lib/id';
import type {
  ExerciseDef,
  MovementPattern,
  MuscleGroup,
  Program,
  ProgramConfig,
  ProgramDay,
  ProgramDayExercise,
  ProgramDayIntensity,
  ProgramGoal,
  SplitCanonical,
} from '@/types/models';

// ---------------------------------------------------------------------------
// Landmark numbers — tune volume, intensity, and session-length targets here.
// ---------------------------------------------------------------------------

/** Working sets per muscle per week, by experience level. */
export const WEEKLY_VOLUME_BY_EXPERIENCE = {
  beginner: 10,
  intermediate: 14,
  advanced: 18,
} as const;

/** Rep range + RIR by training goal. */
export const GOAL_PARAMS = {
  hypertrophy: { repRange: [8, 12] as [number, number], rir: 2 },
  strength: { repRange: [4, 6] as [number, number], rir: 1 },
} as const;

/** Isolation exercises bias toward the upper hypertrophy range. */
export const ISOLATION_HYPERTROPHY_REP_RANGE: [number, number] = [10, 15];

/** Estimated minutes per working set (work + rest). */
export const MINUTES_PER_SET = 3.5;

export const COMPOUND_REST_SECONDS = 150;
export const ISOLATION_REST_SECONDS = 90;

/** Minimum working sets for a muscle on a day it is trained. */
export const MIN_SETS_PER_MUSCLE_SESSION = 2;

/** Secondary muscles receive partial credit toward their weekly volume. */
export const SECONDARY_MUSCLE_CREDIT = 0.5;

// ---------------------------------------------------------------------------
// Recovery inputs — sleep + stress nudge weekly volume targets.
// ---------------------------------------------------------------------------

/** Sleep quality score: poor −1, average 0, good +1. */
const SLEEP_SCORE = { poor: -1, average: 0, good: 1 } as const;

/** Stress level score: high −1, moderate 0, low +1. */
const STRESS_SCORE = { high: -1, moderate: 0, low: 1 } as const;

/** recoveryScore (−2..+2) → weekly volume multiplier. */
const RECOVERY_MULTIPLIER_BY_SCORE: Record<number, number> = {
  [-2]: 0.8,
  [-1]: 0.9,
  0: 1.0,
  1: 1.05,
  2: 1.1,
};

/** Floor so poor recovery never prescribes trivial volume. */
export const MIN_WEEKLY_VOLUME_TARGET = 6;

export const MAX_SETS_PER_EXERCISE = 5;
export const MIN_SETS_PER_EXERCISE = 2;

const COMPOUND_PATTERNS: ReadonlySet<MovementPattern> = new Set([
  'horizontal-press',
  'vertical-press',
  'horizontal-pull',
  'vertical-pull',
  'squat',
  'hinge',
  'lunge',
]);

const FULL_BODY_MUSCLES: MuscleGroup[] = [
  'chest',
  'front-delts',
  'side-delts',
  'rear-delts',
  'lats',
  'upper-back',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
];

const UPPER_MUSCLES: MuscleGroup[] = [
  'chest',
  'lats',
  'upper-back',
  'front-delts',
  'side-delts',
  'rear-delts',
  'biceps',
  'triceps',
  'traps',
];

const LOWER_MUSCLES: MuscleGroup[] = [
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
];

const PUSH_MUSCLES: MuscleGroup[] = [
  'chest',
  'front-delts',
  'side-delts',
  'triceps',
];

const PULL_MUSCLES: MuscleGroup[] = [
  'lats',
  'upper-back',
  'rear-delts',
  'biceps',
  'traps',
];

const LEGS_MUSCLES: MuscleGroup[] = [
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
];

type ResolvedSplit = 'full-body' | 'upper-lower' | 'push-pull-legs';

interface DayBlueprint {
  name: string;
  splitCanonical: SplitCanonical;
  muscles: MuscleGroup[];
}

export interface GenerateProgramOptions {
  /** ISO timestamp for createdAt/updatedAt (tests pass a fixed value). */
  now?: string;
  id?: string;
}

function isCompound(def: ExerciseDef): boolean {
  return COMPOUND_PATTERNS.has(def.pattern);
}

function recoveryMultiplier(config: ProgramConfig): number {
  const sleep = config.sleep ?? 'average';
  const stress = config.stress ?? 'moderate';
  const score = SLEEP_SCORE[sleep] + STRESS_SCORE[stress];
  const clamped = Math.max(-2, Math.min(2, score));
  return RECOVERY_MULTIPLIER_BY_SCORE[clamped] ?? 1.0;
}

/** Experience weekly target adjusted for sleep/stress recovery. */
export function weeklyVolumeTarget(config: ProgramConfig): number {
  const base = WEEKLY_VOLUME_BY_EXPERIENCE[config.experience];
  const adjusted = Math.round(base * recoveryMultiplier(config));
  return Math.max(MIN_WEEKLY_VOLUME_TARGET, adjusted);
}

function resolveSplit(config: ProgramConfig): ResolvedSplit {
  if (config.split === 'full-body') return 'full-body';
  if (config.split === 'upper-lower') return 'upper-lower';
  if (config.split === 'push-pull-legs') return 'push-pull-legs';
  if (config.daysPerWeek === 3) return 'full-body';
  if (config.daysPerWeek === 4) return 'upper-lower';
  return 'push-pull-legs';
}

function splitLabel(split: ResolvedSplit): string {
  switch (split) {
    case 'full-body':
      return 'Full Body';
    case 'upper-lower':
      return 'Upper/Lower';
    case 'push-pull-legs':
      return 'Push/Pull/Legs';
  }
}

function buildDayBlueprints(split: ResolvedSplit, daysPerWeek: number): DayBlueprint[] {
  if (split === 'full-body') {
    return Array.from({ length: daysPerWeek }, (_, i) => ({
      name: `Full Body ${i + 1}`,
      splitCanonical: 'full-body',
      muscles: [...FULL_BODY_MUSCLES],
    }));
  }

  if (split === 'upper-lower') {
    return Array.from({ length: daysPerWeek }, (_, i) => {
      const isUpper = i % 2 === 0;
      const cycle = Math.floor(i / 2);
      const letter = cycle === 0 ? 'A' : String.fromCharCode(65 + cycle);
      const suffix = daysPerWeek > 2 ? ` ${letter}` : '';
      return {
        name: isUpper ? `Upper${suffix}` : `Lower${suffix}`,
        splitCanonical: isUpper ? 'upper' : 'lower',
        muscles: isUpper ? [...UPPER_MUSCLES] : [...LOWER_MUSCLES],
      };
    });
  }

  // push-pull-legs
  const pplSlots: DayBlueprint[] = [
    { name: 'Push', splitCanonical: 'push', muscles: [...PUSH_MUSCLES] },
    { name: 'Pull', splitCanonical: 'pull', muscles: [...PULL_MUSCLES] },
    { name: 'Legs', splitCanonical: 'legs', muscles: [...LEGS_MUSCLES] },
  ];

  if (daysPerWeek === 5) {
    return [
      { name: 'Push', splitCanonical: 'push', muscles: [...PUSH_MUSCLES] },
      { name: 'Pull', splitCanonical: 'pull', muscles: [...PULL_MUSCLES] },
      { name: 'Legs', splitCanonical: 'legs', muscles: [...LEGS_MUSCLES] },
      { name: 'Upper', splitCanonical: 'upper', muscles: [...UPPER_MUSCLES] },
      { name: 'Lower', splitCanonical: 'lower', muscles: [...LOWER_MUSCLES] },
    ];
  }

  return Array.from({ length: daysPerWeek }, (_, i) => {
    const slot = pplSlots[i % 3];
    const cycle = Math.floor(i / 3);
    const suffix = daysPerWeek > 3 ? (cycle === 0 ? ' A' : ' B') : '';
    return {
      name: `${slot.name}${suffix}`,
      splitCanonical: slot.splitCanonical,
      muscles: [...slot.muscles],
    };
  });
}

function muscleDayCounts(blueprints: DayBlueprint[]): Map<MuscleGroup, number> {
  const counts = new Map<MuscleGroup, number>();
  for (const bp of blueprints) {
    for (const m of bp.muscles) {
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
  }
  return counts;
}

function dayMuscleTargets(
  blueprint: DayBlueprint,
  weeklyTarget: number,
  dayCounts: Map<MuscleGroup, number>,
): Map<MuscleGroup, number> {
  const targets = new Map<MuscleGroup, number>();
  for (const m of blueprint.muscles) {
    const days = dayCounts.get(m) ?? 1;
    targets.set(
      m,
      Math.max(MIN_SETS_PER_MUSCLE_SESSION, Math.round(weeklyTarget / days)),
    );
  }
  return targets;
}

function repRangeFor(def: ExerciseDef, goal: ProgramGoal): [number, number] {
  if (goal === 'hypertrophy' && def.pattern === 'isolation') {
    return ISOLATION_HYPERTROPHY_REP_RANGE;
  }
  return GOAL_PARAMS[goal].repRange;
}

function restFor(def: ExerciseDef): number {
  return isCompound(def) ? COMPOUND_REST_SECONDS : ISOLATION_REST_SECONDS;
}

function exercisesForMuscle(
  muscle: MuscleGroup,
  catalog: ExerciseDef[],
): { compounds: ExerciseDef[]; isolations: ExerciseDef[] } {
  const matches = catalog.filter(
    (e) => e.category !== 'cardio' && e.primaryMuscles.includes(muscle),
  );
  const compounds = matches.filter(isCompound);
  const isolations = matches.filter((e) => e.pattern === 'isolation');
  return { compounds, isolations };
}

function snapSmallRemainders(remaining: Map<MuscleGroup, number>): void {
  for (const [m, need] of remaining) {
    if (need > 0 && need < 1) {
      remaining.set(m, 0);
    }
  }
}

function creditMusclesFromExercise(
  exercise: ExerciseDef,
  sets: number,
  remaining: Map<MuscleGroup, number>,
): void {
  for (const m of exercise.primaryMuscles) {
    if (!remaining.has(m)) continue;
    const need = remaining.get(m) ?? 0;
    if (need <= 0) continue;
    remaining.set(m, need - sets);
  }
  for (const m of exercise.secondaryMuscles) {
    if (!remaining.has(m)) continue;
    const need = remaining.get(m) ?? 0;
    if (need <= 0) continue;
    remaining.set(m, need - sets * SECONDARY_MUSCLE_CREDIT);
  }
  snapSmallRemainders(remaining);
}

function hasWastedPrimary(
  exercise: ExerciseDef,
  remaining: Map<MuscleGroup, number>,
): boolean {
  return exercise.primaryMuscles.some((m) => {
    if (!remaining.has(m)) return false;
    return (remaining.get(m) ?? 0) <= 0;
  });
}

function pickExerciseForMuscle(
  muscle: MuscleGroup,
  catalog: ExerciseDef[],
  usedIds: Set<string>,
  remaining: Map<MuscleGroup, number>,
): ExerciseDef | undefined {
  const { compounds, isolations } = exercisesForMuscle(muscle, catalog);
  const candidates = [...compounds, ...isolations].filter(
    (e) => !usedIds.has(e.id) && !hasWastedPrimary(e, remaining),
  );
  if (candidates.length === 0) return undefined;

  const activePrimaryCount = (exercise: ExerciseDef): number =>
    exercise.primaryMuscles.filter((m) => {
      if (!remaining.has(m)) return false;
      return (remaining.get(m) ?? 0) > 0;
    }).length;

  candidates.sort((a, b) => {
    const prim = activePrimaryCount(a) - activePrimaryCount(b);
    if (prim !== 0) return prim;
    const aIso = a.pattern === 'isolation' ? 1 : 0;
    const bIso = b.pattern === 'isolation' ? 1 : 0;
    return aIso - bIso;
  });

  return candidates[0];
}

function selectExercisesForDay(
  muscleTargets: Map<MuscleGroup, number>,
  catalog: ExerciseDef[],
  goal: ProgramGoal,
): ProgramDayExercise[] {
  const remaining = new Map(muscleTargets);
  const usedIds = new Set<string>();
  const exercises: ProgramDayExercise[] = [];

  const catalogById = new Map(catalog.map((e) => [e.id, e]));

  let progress = true;
  while (progress) {
    progress = false;

    const muscleOrder = [...remaining.entries()]
      .filter(([, need]) => need >= MIN_SETS_PER_EXERCISE)
      .sort((a, b) => b[1] - a[1])
      .map(([m]) => m);

    if (muscleOrder.length === 0) break;

    for (const muscle of muscleOrder) {
      const need = remaining.get(muscle) ?? 0;
      if (need < MIN_SETS_PER_EXERCISE) continue;

      const pick = pickExerciseForMuscle(muscle, catalog, usedIds, remaining);
      if (!pick) continue;

      const targetSets = Math.min(
        MAX_SETS_PER_EXERCISE,
        Math.max(MIN_SETS_PER_EXERCISE, Math.round(need)),
      );

      usedIds.add(pick.id);
      exercises.push({
        exerciseId: pick.id,
        rawName: pick.canonicalName,
        targetSets,
        repRange: repRangeFor(pick, goal),
        rir: GOAL_PARAMS[goal].rir,
        restSeconds: restFor(pick),
      });

      creditMusclesFromExercise(pick, targetSets, remaining);
      progress = true;
      break;
    }
  }

  // Close gaps when the catalog has only one viable exercise for a muscle.
  for (const [muscle, need] of remaining) {
    if (need < MIN_SETS_PER_EXERCISE) continue;

    const existing = exercises.find((e) => {
      const def = catalogById.get(e.exerciseId);
      return def?.primaryMuscles.includes(muscle);
    });

    if (existing) {
      const def = catalogById.get(existing.exerciseId);
      if (!def) continue;
      const extra = Math.round(need);
      if (extra <= 0) continue;
      existing.targetSets += extra;
      creditMusclesFromExercise(def, extra, remaining);
      continue;
    }

    const pick = pickExerciseForMuscle(muscle, catalog, usedIds, remaining);
    if (!pick) continue;
    const targetSets = Math.max(MIN_SETS_PER_EXERCISE, Math.round(need));
    usedIds.add(pick.id);
    exercises.push({
      exerciseId: pick.id,
      rawName: pick.canonicalName,
      targetSets,
      repRange: repRangeFor(pick, goal),
      rir: GOAL_PARAMS[goal].rir,
      restSeconds: restFor(pick),
    });
    creditMusclesFromExercise(pick, targetSets, remaining);
  }

  return exercises;
}

function estimateMinutes(exercises: ProgramDayExercise[]): number {
  const totalSets = exercises.reduce((sum, e) => sum + e.targetSets, 0);
  return totalSets * MINUTES_PER_SET;
}

/** After time trimming, top up muscles that fell below their day targets. */
function fillDeficitsAfterTrim(
  exercises: ProgramDayExercise[],
  muscleTargets: Map<MuscleGroup, number>,
  catalog: ExerciseDef[],
  goal: ProgramGoal,
  maxMinutes: number,
): ProgramDayExercise[] {
  const result = exercises.map((e) => ({ ...e }));
  const catalogById = new Map(catalog.map((e) => [e.id, e]));
  const remaining = new Map(muscleTargets);
  const usedIds = new Set(result.map((e) => e.exerciseId));

  for (const ex of result) {
    const def = catalogById.get(ex.exerciseId);
    if (def) creditMusclesFromExercise(def, ex.targetSets, remaining);
  }

  for (const [muscle, need] of remaining) {
    if (need < 1) continue;

    const existing = result.find((e) => {
      const def = catalogById.get(e.exerciseId);
      return def?.primaryMuscles.includes(muscle);
    });

    if (existing) {
      const def = catalogById.get(existing.exerciseId);
      if (!def) continue;
      const extra = Math.max(1, Math.ceil(need));
      if (estimateMinutes(result) + extra * MINUTES_PER_SET > maxMinutes) continue;
      existing.targetSets += extra;
      creditMusclesFromExercise(def, extra, remaining);
      continue;
    }

    const pick = pickExerciseForMuscle(muscle, catalog, usedIds, remaining);
    if (!pick) continue;
    const targetSets = Math.max(MIN_SETS_PER_EXERCISE, Math.ceil(need));
    if (estimateMinutes(result) + targetSets * MINUTES_PER_SET > maxMinutes) continue;
    usedIds.add(pick.id);
    result.push({
      exerciseId: pick.id,
      rawName: pick.canonicalName,
      targetSets,
      repRange: repRangeFor(pick, goal),
      rir: GOAL_PARAMS[goal].rir,
      restSeconds: restFor(pick),
    });
    creditMusclesFromExercise(pick, targetSets, remaining);
  }

  return result;
}

const INTENSITY_CYCLE_3: ProgramDayIntensity[] = ['heavy', 'moderate', 'light'];
const INTENSITY_CYCLE_2: ProgramDayIntensity[] = ['heavy', 'light'];

function intensitiesForOccurrenceCount(count: number): ProgramDayIntensity[] {
  if (count <= 1) return ['moderate'];
  if (count === 2) return INTENSITY_CYCLE_2;
  if (count === 3) return INTENSITY_CYCLE_3;
  return Array.from({ length: count }, (_, i) => INTENSITY_CYCLE_3[i % 3]);
}

function shiftRepRangeForIntensity(
  base: [number, number],
  intensity: ProgramDayIntensity,
): [number, number] {
  if (intensity === 'moderate') return base;
  if (intensity === 'heavy') {
    return [Math.max(base[0] - 3, 3), Math.max(base[1] - 3, 6)];
  }
  return [base[0] + 3, base[1] + 4];
}

function shiftRirForIntensity(baseRir: number, intensity: ProgramDayIntensity): number {
  if (intensity === 'heavy') return Math.max(baseRir - 1, 0);
  return baseRir;
}

function intensityLabel(intensity: ProgramDayIntensity): string {
  return intensity.charAt(0).toUpperCase() + intensity.slice(1);
}

/**
 * Daily undulating periodization: when a day-type repeats within the week,
 * cycle heavy / moderate / light and shift rep ranges + RIR accordingly.
 * Volume (set counts) is unchanged.
 */
function applyDupToDays(days: ProgramDay[], blueprints: DayBlueprint[]): ProgramDay[] {
  const occurrenceCounts = new Map<SplitCanonical, number>();
  for (const bp of blueprints) {
    occurrenceCounts.set(
      bp.splitCanonical,
      (occurrenceCounts.get(bp.splitCanonical) ?? 0) + 1,
    );
  }

  const occurrenceIndex = new Map<SplitCanonical, number>();

  return days.map((day, i) => {
    const bp = blueprints[i];
    const count = occurrenceCounts.get(bp.splitCanonical) ?? 1;
    if (count <= 1) return day;

    const intensities = intensitiesForOccurrenceCount(count);
    const idx = occurrenceIndex.get(bp.splitCanonical) ?? 0;
    occurrenceIndex.set(bp.splitCanonical, idx + 1);
    const intensity = intensities[idx];

    return {
      ...day,
      name: `${day.name} · ${intensityLabel(intensity)}`,
      intensity,
      exercises: day.exercises.map((ex) => ({
        ...ex,
        repRange: shiftRepRangeForIntensity(ex.repRange, intensity),
        rir: shiftRirForIntensity(ex.rir, intensity),
      })),
    };
  });
}

function trimToTimeBudget(
  exercises: ProgramDayExercise[],
  catalogById: Map<string, ExerciseDef>,
  maxMinutes: number,
): ProgramDayExercise[] {
  let result = exercises.map((e) => ({ ...e }));

  while (estimateMinutes(result) > maxMinutes && result.length > 0) {
    const isolationCandidates = result
      .map((e, index) => ({ e, index, def: catalogById.get(e.exerciseId) }))
      .filter(({ def }) => def?.pattern === 'isolation')
      .sort((a, b) => a.e.targetSets - b.e.targetSets || a.index - b.index);

    if (isolationCandidates.length > 0) {
      const { e, index } = isolationCandidates[0];
      if (e.targetSets > MIN_SETS_PER_EXERCISE) {
        result[index] = { ...e, targetSets: e.targetSets - 1 };
      } else {
        result = result.filter((_, i) => i !== index);
      }
      continue;
    }

    const reducible = result
      .map((e, index) => ({ e, index, def: catalogById.get(e.exerciseId) }))
      .filter(({ e }) => e.targetSets > MIN_SETS_PER_EXERCISE)
      .sort((a, b) => {
        const aIso = a.def?.pattern === 'isolation' ? 0 : 1;
        const bIso = b.def?.pattern === 'isolation' ? 0 : 1;
        return aIso - bIso || a.e.targetSets - b.e.targetSets;
      });

    if (reducible.length === 0) break;

    const { e, index } = reducible[0];
    result[index] = { ...e, targetSets: e.targetSets - 1 };
  }

  return result;
}

/**
 * Research-based, deterministic workout program generator.
 * Pure function — no I/O, no React.
 */
export function generateProgram(
  config: ProgramConfig,
  catalog: ExerciseDef[],
  opts: GenerateProgramOptions = {},
): Program {
  const now = opts.now ?? new Date().toISOString();
  const resolved = resolveSplit(config);
  const weeklyTarget = weeklyVolumeTarget(config);
  const blueprints = buildDayBlueprints(resolved, config.daysPerWeek);
  const dayCounts = muscleDayCounts(blueprints);
  const catalogById = new Map(catalog.map((e) => [e.id, e]));

  const days: ProgramDay[] = applyDupToDays(
    blueprints.map((bp) => {
      const targets = dayMuscleTargets(bp, weeklyTarget, dayCounts);
      let exercises = selectExercisesForDay(targets, catalog, config.goal);
      exercises = trimToTimeBudget(exercises, catalogById, config.minutesPerSession);
      exercises = fillDeficitsAfterTrim(
        exercises,
        targets,
        catalog,
        config.goal,
        config.minutesPerSession,
      );
      return {
        name: bp.name,
        splitCanonical: bp.splitCanonical,
        exercises,
      };
    }),
    blueprints,
  );

  const goalLabel = config.goal === 'hypertrophy' ? 'Hypertrophy' : 'Strength';

  return {
    id: opts.id ?? newId(),
    name: `${goalLabel} · ${config.daysPerWeek}-day ${splitLabel(resolved)}`,
    config,
    days,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Sum effective weekly sets per muscle using the same primary/secondary credit
 * rules as day-level prescription (secondary = 0.5, no over-credit once met).
 */
export function weeklyMuscleVolume(
  program: Program,
  catalog: ExerciseDef[],
): Map<MuscleGroup, number> {
  const catalogById = new Map(catalog.map((e) => [e.id, e]));
  const weeklyTarget = weeklyVolumeTarget(program.config);
  const resolved = resolveSplit(program.config);
  const blueprints = buildDayBlueprints(resolved, program.config.daysPerWeek);
  const dayCounts = muscleDayCounts(blueprints);
  const volume = new Map<MuscleGroup, number>();

  const add = (m: MuscleGroup, sets: number) => {
    volume.set(m, (volume.get(m) ?? 0) + sets);
  };

  for (let i = 0; i < program.days.length; i += 1) {
    const day = program.days[i];
    const bp = blueprints[i];
    if (!bp) continue;
    const remaining = dayMuscleTargets(bp, weeklyTarget, dayCounts);

    for (const ex of day.exercises) {
      const def = catalogById.get(ex.exerciseId);
      if (!def) continue;

      for (const m of def.primaryMuscles) {
        if (!remaining.has(m)) continue;
        const need = remaining.get(m) ?? 0;
        if (need <= 0) continue;
        const credited = Math.min(ex.targetSets, need);
        add(m, credited);
        remaining.set(m, need - credited);
      }
      for (const m of def.secondaryMuscles) {
        if (!remaining.has(m)) continue;
        const need = remaining.get(m) ?? 0;
        if (need <= 0) continue;
        const credited = Math.min(ex.targetSets * SECONDARY_MUSCLE_CREDIT, need);
        add(m, credited);
        remaining.set(m, need - credited);
      }
      snapSmallRemainders(remaining);
    }
  }

  return volume;
}

/** Estimated session length in minutes for a program day. */
export function estimateDayMinutes(day: ProgramDay): number {
  return estimateMinutes(day.exercises);
}