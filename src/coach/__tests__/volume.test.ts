import { describe, expect, it } from 'vitest';
import { buildMuscleLookup, weeklyMuscleVolume } from '../volume';
import type {
  ExerciseDef,
  MuscleGroup,
  SetEntry,
  Workout,
  WorkoutExercise,
} from '@/types/models';

/** A muscle lookup hand-built for the fixtures used here. */
function lookup(): Map<string, { primary: MuscleGroup[]; secondary: MuscleGroup[] }> {
  return new Map([
    ['bench', { primary: ['chest'] as MuscleGroup[], secondary: ['triceps'] as MuscleGroup[] }],
    [
      'squat',
      { primary: ['quads'] as MuscleGroup[], secondary: ['glutes', 'lower-back'] as MuscleGroup[] },
    ],
  ]);
}

function set(isWarmup = false): SetEntry {
  return { weightKg: 100, reps: 5, isWarmup, raw: '100x5' };
}

function ex(exerciseId: string, working: number, warmup = 0): WorkoutExercise {
  const sets: SetEntry[] = [
    ...Array.from({ length: warmup }, () => set(true)),
    ...Array.from({ length: working }, () => set(false)),
  ];
  return { exerciseId, rawName: exerciseId, unit: 'kg', sets };
}

function workout(date: string, exercises: WorkoutExercise[]): Workout {
  return {
    id: `w-${date}`,
    date,
    dateConfidence: 'high',
    bodyweightKg: 80,
    splitCanonical: 'push',
    splitRaw: null,
    blockId: null,
    sourceNoteId: 'n1',
    exercises,
    createdAt: `${date}T00:00:00.000Z`,
  };
}

/** setsPerWeek for a muscle, or undefined when absent. */
function spw(
  report: ReturnType<typeof weeklyMuscleVolume>,
  muscle: MuscleGroup,
): number | undefined {
  return report.muscles.find((m) => m.muscle === muscle)?.setsPerWeek;
}

describe('buildMuscleLookup', () => {
  it('maps each def id to its primary/secondary muscles', () => {
    const defs: ExerciseDef[] = [
      {
        id: 'cable-curl',
        canonicalName: 'Cable Curl',
        aliases: [],
        category: 'pull',
        pattern: 'isolation',
        primaryMuscles: ['biceps'],
        secondaryMuscles: ['forearms'],
      },
    ];
    const map = buildMuscleLookup(defs);
    expect(map.get('cable-curl')).toEqual({
      primary: ['biceps'],
      secondary: ['forearms'],
    });
  });
});

describe('weeklyMuscleVolume', () => {
  it('credits primary muscles fully and secondary muscles at half', () => {
    // 4 working sets of bench in a single-week window (weeks: 1 so spw == totalSets).
    const w = [workout('2026-06-20', [ex('bench', 4)])];
    const report = weeklyMuscleVolume(w, lookup(), { weeks: 1, anchor: '2026-06-20' });
    // chest (primary) = 4 * 1.0 = 4; triceps (secondary) = 4 * 0.5 = 2.
    expect(spw(report, 'chest')).toBeCloseTo(4, 5);
    expect(spw(report, 'triceps')).toBeCloseTo(2, 5);
  });

  it('excludes warm-up sets from the count', () => {
    const w = [workout('2026-06-20', [ex('bench', 3, 2)])]; // 3 working + 2 warmup
    const report = weeklyMuscleVolume(w, lookup(), { weeks: 1, anchor: '2026-06-20' });
    expect(spw(report, 'chest')).toBeCloseTo(3, 5);
  });

  it('includes a workout just inside the window and excludes one just outside', () => {
    // 4-week window anchored 2026-06-28 → range [2026-06-01, 2026-06-28].
    const inside = workout('2026-06-01', [ex('bench', 2)]); // exactly the lower edge
    const outside = workout('2026-05-31', [ex('bench', 10)]); // one day before edge
    const report = weeklyMuscleVolume([inside, outside], lookup(), {
      weeks: 4,
      anchor: '2026-06-28',
    });
    // Only the 2 inside sets count → totalSets 2 over 4 weeks = 0.5/wk.
    expect(spw(report, 'chest')).toBeCloseTo(0.5, 5);
  });

  it('defaults the anchor to the latest workout date', () => {
    const w = [
      workout('2026-06-28', [ex('bench', 4)]), // latest → anchor
      workout('2026-06-01', [ex('bench', 4)]), // within 4 weeks of the anchor
      workout('2026-04-01', [ex('bench', 99)]), // far outside → ignored
    ];
    const report = weeklyMuscleVolume(w, lookup()); // default weeks 4
    expect(report.anchorDate).toBe('2026-06-28');
    // 4 + 4 = 8 working sets in window, over 4 weeks → 2/wk.
    expect(spw(report, 'chest')).toBeCloseTo(2, 5);
  });

  it('divides totalSets by the window weeks', () => {
    // 24 working sets spread across a 4-week window → 6/wk.
    const w = [
      workout('2026-06-28', [ex('bench', 6)]),
      workout('2026-06-21', [ex('bench', 6)]),
      workout('2026-06-14', [ex('bench', 6)]),
      workout('2026-06-07', [ex('bench', 6)]),
    ];
    const report = weeklyMuscleVolume(w, lookup(), { weeks: 4, anchor: '2026-06-28' });
    expect(spw(report, 'chest')).toBeCloseTo(6, 5);
  });

  it('classifies setsPerWeek of 0 as never', () => {
    const report = weeklyMuscleVolume([], lookup());
    const calves = report.muscles.find((m) => m.muscle === 'calves')!;
    expect(calves.setsPerWeek).toBe(0);
    expect(calves.status).toBe('never');
  });

  it('classifies 7.9 sets/wk as under and 8 as optimal', () => {
    // weeks 1 so spw == working sets of bench (chest, primary 1.0).
    const under = weeklyMuscleVolume([workout('2026-06-20', [ex('bench', 7)])], lookup(), {
      weeks: 1,
      anchor: '2026-06-20',
    });
    // 7 working sets → 7/wk → under.
    expect(under.muscles.find((m) => m.muscle === 'chest')!.status).toBe('under');

    const optimal = weeklyMuscleVolume([workout('2026-06-20', [ex('bench', 8)])], lookup(), {
      weeks: 1,
      anchor: '2026-06-20',
    });
    expect(optimal.muscles.find((m) => m.muscle === 'chest')!.status).toBe('optimal');
  });

  it('classifies the boundary cases 7.9 → under, 8 → optimal, 20 → optimal, 20.1 → high', () => {
    // Drive setsPerWeek precisely with a custom single-muscle lookup over a 10-week window.
    const map = new Map([
      ['only', { primary: ['abs'] as MuscleGroup[], secondary: [] as MuscleGroup[] }],
    ]);
    const status = (workingSets: number): string => {
      const r = weeklyMuscleVolume([workout('2026-06-28', [ex('only', workingSets)])], map, {
        weeks: 10,
        anchor: '2026-06-28',
      });
      return r.muscles.find((m) => m.muscle === 'abs')!.status;
    };
    expect(status(79)).toBe('under'); // 7.9/wk
    expect(status(80)).toBe('optimal'); // 8.0/wk
    expect(status(200)).toBe('optimal'); // 20.0/wk
    expect(status(201)).toBe('high'); // 20.1/wk
  });

  it('contributes nothing for an uncatalogued exerciseId', () => {
    const w = [workout('2026-06-20', [ex('unknown:mystery', 10)])];
    const report = weeklyMuscleVolume(w, lookup(), { weeks: 1, anchor: '2026-06-20' });
    expect(report.muscles.every((m) => m.setsPerWeek === 0)).toBe(true);
    expect(report.muscles.every((m) => m.status === 'never')).toBe(true);
  });

  it('counts custom-exercise muscles when passed via buildMuscleLookup', () => {
    const defs: ExerciseDef[] = [
      {
        id: 'machine-calf-raise',
        canonicalName: 'Machine Calf Raise',
        aliases: [],
        category: 'legs',
        pattern: 'isolation',
        primaryMuscles: ['calves'],
        secondaryMuscles: [],
      },
    ];
    const map = buildMuscleLookup(defs);
    const w = [workout('2026-06-20', [ex('machine-calf-raise', 5)])];
    const report = weeklyMuscleVolume(w, map, { weeks: 1, anchor: '2026-06-20' });
    expect(spw(report, 'calves')).toBeCloseTo(5, 5);
  });

  it('reports every muscle as never with a null anchor for empty workouts', () => {
    const report = weeklyMuscleVolume([], lookup());
    expect(report.anchorDate).toBeNull();
    expect(report.muscles.length).toBe(16);
    expect(report.muscles.every((m) => m.status === 'never' && m.setsPerWeek === 0)).toBe(true);
  });

  it('clamps weeks to at least 1', () => {
    const w = [workout('2026-06-20', [ex('bench', 4)])];
    const report = weeklyMuscleVolume(w, lookup(), { weeks: 0, anchor: '2026-06-20' });
    expect(report.weeks).toBe(1);
    // With weeks clamped to 1, the window is just the anchor day → 4 sets / 1 week.
    expect(spw(report, 'chest')).toBeCloseTo(4, 5);
  });

  it('sorts muscles descending by setsPerWeek', () => {
    // chest gets 6 (primary), triceps 3 (secondary) — chest must come first.
    const w = [workout('2026-06-20', [ex('bench', 6)])];
    const report = weeklyMuscleVolume(w, lookup(), { weeks: 1, anchor: '2026-06-20' });
    for (let i = 1; i < report.muscles.length; i++) {
      expect(report.muscles[i - 1].setsPerWeek).toBeGreaterThanOrEqual(
        report.muscles[i].setsPerWeek,
      );
    }
    expect(report.muscles[0].muscle).toBe('chest');
  });
});
