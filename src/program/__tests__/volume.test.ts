import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES, createCatalog } from '@/parser/catalog';
import { buildCustomExerciseDef } from '@/features/logger/customExercise';
import {
  volumeRecommendations,
  volumeReport,
  weeklyVolumeByMuscle,
} from '@/program/volume';
import type { ExerciseDef, Workout, WorkoutExercise } from '@/types/models';

const CATALOG = createCatalog().all();
const NOW = new Date('2024-06-19T12:00:00.000Z');

function exercise(
  exerciseId: string,
  sets: WorkoutExercise['sets'],
): WorkoutExercise {
  return { exerciseId, rawName: 'Test', unit: 'kg', sets };
}

function workout(date: string, exercises: WorkoutExercise[]): Workout {
  return {
    id: `w-${date}`,
    date,
    dateConfidence: 'high',
    bodyweightKg: null,
    splitCanonical: 'push',
    splitRaw: null,
    blockId: null,
    sourceNoteId: 'n1',
    createdAt: `${date}T10:00:00.000Z`,
    exercises,
  };
}

describe('weeklyVolumeByMuscle', () => {
  it('credits primary muscles 1.0 and secondary 0.5 per working set', () => {
    const workouts = [
      workout('2024-06-19', [
        exercise('barbell-bench-press', [
          { weightKg: 60, reps: 8, isWarmup: true, raw: '60x8' },
          { weightKg: 100, reps: 5, raw: '100x5' },
          { weightKg: 100, reps: 5, raw: '100x5' },
          { weightKg: 100, reps: 5, raw: '100x5' },
        ]),
      ]),
    ];

    const totals = weeklyVolumeByMuscle(workouts, CATALOG, 7, NOW);
    expect(totals.get('chest')).toBe(3);
    expect(totals.get('triceps')).toBe(1.5);
    expect(totals.get('front-delts')).toBe(1.5);
  });

  it('excludes warm-up sets', () => {
    const workouts = [
      workout('2024-06-19', [
        exercise('barbell-bench-press', [
          { weightKg: 60, reps: 8, isWarmup: true, raw: '60x8' },
          { weightKg: 80, reps: 5, isWarmup: true, raw: '80x5' },
        ]),
      ]),
    ];

    const totals = weeklyVolumeByMuscle(workouts, CATALOG, 7, NOW);
    expect(totals.get('chest') ?? 0).toBe(0);
  });

  it('filters workouts outside the trailing windowDays', () => {
    const workouts = [
      workout('2024-06-19', [
        exercise('barbell-bench-press', [{ weightKg: 100, reps: 5, raw: '100x5' }]),
      ]),
      workout('2024-06-10', [
        exercise('barbell-bench-press', [{ weightKg: 100, reps: 5, raw: '100x5' }]),
      ]),
    ];

    const totals = weeklyVolumeByMuscle(workouts, CATALOG, 7, NOW);
    expect(totals.get('chest')).toBe(1);
  });

  it('ignores unknown and cardio exercises', () => {
    const cardioDef = BUILTIN_EXERCISES.find((d) => d.category === 'cardio');
    expect(cardioDef).toBeDefined();

    const workouts = [
      workout('2024-06-19', [
        exercise('unknown:custom-move', [{ weightKg: 50, reps: 10, raw: '50x10' }]),
        exercise(cardioDef!.id, [{ weightKg: null, reps: 20, raw: '20' }]),
        exercise('barbell-bench-press', [{ weightKg: 100, reps: 5, raw: '100x5' }]),
      ]),
    ];

    const totals = weeklyVolumeByMuscle(workouts, CATALOG, 7, NOW);
    expect(totals.get('chest')).toBe(1);
    expect(totals.size).toBeGreaterThan(0);
    for (const muscle of cardioDef!.primaryMuscles) {
      expect(totals.get(muscle) ?? 0).toBe(0);
    }
  });

  it('counts custom exercises toward their tagged primary muscles', () => {
    const customDef: ExerciseDef = buildCustomExerciseDef({
      canonicalName: 'Sissy Squat',
      primaryMuscles: ['quads'],
      secondaryMuscles: ['glutes'],
    });
    const catalog = [...CATALOG, customDef];

    const workouts = [
      workout('2024-06-19', [
        exercise(customDef.id, [
          { weightKg: 0, reps: 12, raw: '12' },
          { weightKg: 0, reps: 12, raw: '12' },
          { weightKg: 0, reps: 12, raw: '12' },
        ]),
      ]),
    ];

    const totals = weeklyVolumeByMuscle(workouts, catalog, 7, NOW);
    expect(totals.get('quads')).toBe(3);
    expect(totals.get('glutes')).toBe(1.5);
  });
});

describe('volumeReport', () => {
  it('classifies under, optimal, and high at band edges', () => {
    const under = volumeReport([], CATALOG, { experience: 'intermediate', now: NOW });
    const chestUnder = under.find((r) => r.muscle === 'chest');
    expect(chestUnder?.sets).toBe(0);
    expect(chestUnder?.status).toBe('under');
    expect(chestUnder?.mev).toBe(8);
    expect(chestUnder?.mav).toBe(18);

    const optimalSets = Array.from({ length: 10 }, () => ({
      weightKg: 100,
      reps: 5,
      raw: '100x5',
    }));
    // 10 bench sets → chest 10 (optimal: >=8 and <=18)
    const optimal = volumeReport(
      [workout('2024-06-19', [exercise('barbell-bench-press', optimalSets)])],
      CATALOG,
      { experience: 'intermediate', now: NOW },
    );
    expect(optimal.find((r) => r.muscle === 'chest')?.status).toBe('optimal');

    const highSets = Array.from({ length: 20 }, () => ({
      weightKg: 100,
      reps: 5,
      raw: '100x5',
    }));
    const high = volumeReport(
      [workout('2024-06-19', [exercise('barbell-bench-press', highSets)])],
      CATALOG,
      { experience: 'intermediate', now: NOW },
    );
    expect(high.find((r) => r.muscle === 'chest')?.status).toBe('high');
  });

  it('scales landmarks by experience', () => {
    const report = volumeReport([], CATALOG, { experience: 'beginner', now: NOW });
    const chest = report.find((r) => r.muscle === 'chest');
    expect(chest?.mev).toBe(6);
    expect(chest?.mav).toBe(12);

    const advanced = volumeReport([], CATALOG, { experience: 'advanced', now: NOW });
    const advChest = advanced.find((r) => r.muscle === 'chest');
    expect(advChest?.mev).toBe(10);
    expect(advChest?.mav).toBe(22);
  });

  it('sorts under muscles before optimal and by name within status', () => {
    const report = volumeReport([], CATALOG, { experience: 'intermediate', now: NOW });
    const statuses = report.map((r) => r.status);
    const firstOptimal = statuses.indexOf('optimal');
    const lastUnder = statuses.lastIndexOf('under');
    if (firstOptimal >= 0 && lastUnder >= 0) {
      expect(lastUnder).toBeLessThan(firstOptimal);
    }
  });
});

describe('volumeRecommendations', () => {
  it('suggests adding sets for undertrained muscles', () => {
    const report = volumeReport([], CATALOG, { experience: 'intermediate', now: NOW });
    const recs = volumeRecommendations(report);
    expect(recs.some((r) => r.match(/add \d+ sets of chest this week/i))).toBe(true);
  });

  it('suggests trimming for high-volume muscles', () => {
    const highSets = Array.from({ length: 20 }, () => ({
      weightKg: 100,
      reps: 5,
      raw: '100x5',
    }));
    const report = volumeReport(
      [workout('2024-06-19', [exercise('barbell-bench-press', highSets)])],
      CATALOG,
      {
      experience: 'intermediate',
      now: NOW,
    });
    const recs = volumeRecommendations(report);
    expect(recs.some((r) => /consider trimming chest volume/i.test(r))).toBe(true);
  });

  it('returns an empty array when every muscle is optimal', () => {
    const workouts = [
      workout('2024-06-19', [
        exercise('barbell-bench-press', [
          { weightKg: 100, reps: 5, raw: '100x5' },
          { weightKg: 100, reps: 5, raw: '100x5' },
          { weightKg: 100, reps: 5, raw: '100x5' },
          { weightKg: 100, reps: 5, raw: '100x5' },
          { weightKg: 100, reps: 5, raw: '100x5' },
          { weightKg: 100, reps: 5, raw: '100x5' },
          { weightKg: 100, reps: 5, raw: '100x5' },
          { weightKg: 100, reps: 5, raw: '100x5' },
        ]),
      ]),
    ];
    const report = volumeReport(workouts, CATALOG, {
      experience: 'intermediate',
      now: NOW,
    });
    const chest = report.find((r) => r.muscle === 'chest');
    expect(chest?.status).toBe('optimal');
    expect(volumeRecommendations(report.filter((r) => r.muscle === 'chest'))).toEqual([]);
  });
});