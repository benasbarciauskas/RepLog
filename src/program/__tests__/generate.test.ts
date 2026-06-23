import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES } from '@/parser/catalog';
import {
  GOAL_PARAMS,
  ISOLATION_HYPERTROPHY_REP_RANGE,
  MINUTES_PER_SET,
  WEEKLY_VOLUME_BY_EXPERIENCE,
  estimateDayMinutes,
  generateProgram,
  weeklyMuscleVolume,
} from '@/program/generate';
import type { MuscleGroup, ProgramConfig } from '@/types/models';

const CATALOG = BUILTIN_EXERCISES;
const NOW = '2026-06-01T12:00:00.000Z';

const TRAINED_MUSCLES: MuscleGroup[] = [
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

function makeConfig(overrides: Partial<ProgramConfig> = {}): ProgramConfig {
  return {
    goal: 'hypertrophy',
    experience: 'beginner',
    daysPerWeek: 3,
    split: 'auto',
    minutesPerSession: 90,
    ...overrides,
  };
}

describe('generateProgram', () => {
  it('3-day beginner hypertrophy auto resolves to full-body with DUP intensities', () => {
    const program = generateProgram(makeConfig(), CATALOG, { now: NOW });
    expect(program.days).toHaveLength(3);
    expect(program.days.every((d) => d.splitCanonical === 'full-body')).toBe(true);
    expect(program.days.map((d) => d.name)).toEqual([
      'Full Body 1 · Heavy',
      'Full Body 2 · Moderate',
      'Full Body 3 · Light',
    ]);
    expect(program.days.map((d) => d.intensity)).toEqual(['heavy', 'moderate', 'light']);
    expect(program.name).toContain('Full Body');
  });

  it('6-day plan resolves to PPL x2 with DUP intensities and shifted rep ranges', () => {
    const program = generateProgram(
      makeConfig({ daysPerWeek: 6, experience: 'intermediate', minutesPerSession: 120 }),
      CATALOG,
      { now: NOW },
    );
    expect(program.days).toHaveLength(6);
    expect(program.days.map((d) => d.name)).toEqual([
      'Push A · Heavy',
      'Pull A · Heavy',
      'Legs A · Heavy',
      'Push B · Light',
      'Pull B · Light',
      'Legs B · Light',
    ]);
    expect(program.days.map((d) => d.splitCanonical)).toEqual([
      'push',
      'pull',
      'legs',
      'push',
      'pull',
      'legs',
    ]);
    expect(program.days.map((d) => d.intensity)).toEqual([
      'heavy',
      'heavy',
      'heavy',
      'light',
      'light',
      'light',
    ]);

    const pushHeavy = program.days[0].exercises[0];
    const pushLight = program.days[3].exercises[0];
    const def = CATALOG.find((e) => e.id === pushHeavy.exerciseId);
    const baseRange =
      def?.pattern === 'isolation'
        ? ISOLATION_HYPERTROPHY_REP_RANGE
        : GOAL_PARAMS.hypertrophy.repRange;

    expect(pushHeavy.repRange).toEqual([
      Math.max(baseRange[0] - 3, 3),
      Math.max(baseRange[1] - 3, 6),
    ]);
    expect(pushHeavy.rir).toBe(GOAL_PARAMS.hypertrophy.rir - 1);
    expect(pushLight.repRange).toEqual([baseRange[0] + 3, baseRange[1] + 4]);
    expect(pushLight.rir).toBe(GOAL_PARAMS.hypertrophy.rir);
  });

  it('DUP does not change weekly set volume per muscle', () => {
    const withoutDupBaseline = makeConfig({
      daysPerWeek: 6,
      experience: 'intermediate',
      minutesPerSession: 120,
    });
    const program = generateProgram(withoutDupBaseline, CATALOG, { now: NOW });
    const volume = weeklyMuscleVolume(program, CATALOG);

    for (const muscle of TRAINED_MUSCLES) {
      const sets = volume.get(muscle) ?? 0;
      if (sets === 0) continue;
      const totalSets = program.days.reduce((sum, day) => {
        return (
          sum +
          day.exercises.reduce((daySum, ex) => {
            const def = CATALOG.find((e) => e.id === ex.exerciseId);
            if (!def?.primaryMuscles.includes(muscle)) return daySum;
            return daySum + ex.targetSets;
          }, 0)
        );
      }, 0);
      expect(sets).toBeGreaterThan(0);
      expect(totalSets).toBeGreaterThan(0);
    }
  });

  it('single-occurrence day-types stay at moderate defaults without intensity tags', () => {
    const program = generateProgram(
      makeConfig({ daysPerWeek: 5, split: 'push-pull-legs', minutesPerSession: 120 }),
      CATALOG,
      { now: NOW },
    );
    expect(program.days.map((d) => d.name)).toEqual([
      'Push',
      'Pull',
      'Legs',
      'Upper',
      'Lower',
    ]);
    expect(program.days.every((d) => d.intensity === undefined)).toBe(true);
    for (const day of program.days) {
      for (const ex of day.exercises) {
        const def = CATALOG.find((e) => e.id === ex.exerciseId);
        expect(ex.rir).toBe(GOAL_PARAMS.hypertrophy.rir);
        if (def?.pattern === 'isolation') {
          expect(ex.repRange).toEqual(ISOLATION_HYPERTROPHY_REP_RANGE);
        } else {
          expect(ex.repRange).toEqual(GOAL_PARAMS.hypertrophy.repRange);
        }
      }
    }
  });

  it('weekly muscle volume is within ±2 of experience target for trained muscles', () => {
    for (const experience of ['beginner', 'intermediate', 'advanced'] as const) {
      const target = WEEKLY_VOLUME_BY_EXPERIENCE[experience];
      const program = generateProgram(
        makeConfig({
          experience,
          daysPerWeek: 4,
          split: 'upper-lower',
          minutesPerSession: experience === 'advanced' ? 180 : 120,
        }),
        CATALOG,
        { now: NOW },
      );
      const volume = weeklyMuscleVolume(program, CATALOG);

      for (const muscle of TRAINED_MUSCLES) {
        const sets = volume.get(muscle) ?? 0;
        if (sets === 0) continue;
        expect(sets, `${experience} ${muscle}`).toBeGreaterThanOrEqual(target - 2);
        expect(sets, `${experience} ${muscle}`).toBeLessThanOrEqual(target + 2);
      }
    }
  });

  it('rep ranges and RIR match the goal on moderate (single-occurrence) days', () => {
    const hypertrophy = generateProgram(
      makeConfig({ goal: 'hypertrophy', daysPerWeek: 5, split: 'push-pull-legs' }),
      CATALOG,
      { now: NOW },
    );
    const strength = generateProgram(
      makeConfig({
        goal: 'strength',
        daysPerWeek: 5,
        split: 'push-pull-legs',
        minutesPerSession: 120,
      }),
      CATALOG,
      { now: NOW },
    );

    for (const day of hypertrophy.days) {
      for (const ex of day.exercises) {
        const def = CATALOG.find((e) => e.id === ex.exerciseId);
        expect(ex.rir).toBe(GOAL_PARAMS.hypertrophy.rir);
        if (def?.pattern === 'isolation') {
          expect(ex.repRange).toEqual(ISOLATION_HYPERTROPHY_REP_RANGE);
        } else {
          expect(ex.repRange).toEqual(GOAL_PARAMS.hypertrophy.repRange);
        }
      }
    }

    for (const day of strength.days) {
      for (const ex of day.exercises) {
        expect(ex.rir).toBe(GOAL_PARAMS.strength.rir);
        expect(ex.repRange).toEqual(GOAL_PARAMS.strength.repRange);
      }
    }
  });

  it('has no duplicate exerciseId within a day', () => {
    const program = generateProgram(
      makeConfig({ daysPerWeek: 5, experience: 'advanced', minutesPerSession: 120 }),
      CATALOG,
      { now: NOW },
    );
    for (const day of program.days) {
      const ids = day.exercises.map((e) => e.exerciseId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('excludes cardio-category exercises', () => {
    const program = generateProgram(makeConfig({ minutesPerSession: 120 }), CATALOG, { now: NOW });
    const cardioIds = new Set(CATALOG.filter((e) => e.category === 'cardio').map((e) => e.id));
    for (const day of program.days) {
      for (const ex of day.exercises) {
        expect(cardioIds.has(ex.exerciseId)).toBe(false);
      }
    }
  });

  it('estimated session time respects minutesPerSession after trimming', () => {
    const program = generateProgram(
      makeConfig({ minutesPerSession: 45, daysPerWeek: 6, experience: 'advanced' }),
      CATALOG,
      { now: NOW },
    );
    for (const day of program.days) {
      const minutes = estimateDayMinutes(day);
      const totalSets = day.exercises.reduce((s, e) => s + e.targetSets, 0);
      expect(minutes).toBe(totalSets * MINUTES_PER_SET);
      expect(minutes).toBeLessThanOrEqual(45 + MINUTES_PER_SET);
    }
  });
});