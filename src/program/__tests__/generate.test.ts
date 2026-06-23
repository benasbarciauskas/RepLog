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
  it('3-day beginner hypertrophy auto resolves to full-body', () => {
    const program = generateProgram(makeConfig(), CATALOG, { now: NOW });
    expect(program.days).toHaveLength(3);
    expect(program.days.every((d) => d.splitCanonical === 'full-body')).toBe(true);
    expect(program.days.map((d) => d.name)).toEqual(['Full Body 1', 'Full Body 2', 'Full Body 3']);
    expect(program.name).toContain('Full Body');
  });

  it('6-day plan resolves to PPL x2', () => {
    const program = generateProgram(
      makeConfig({ daysPerWeek: 6, experience: 'intermediate', minutesPerSession: 120 }),
      CATALOG,
      { now: NOW },
    );
    expect(program.days).toHaveLength(6);
    expect(program.days.map((d) => d.name)).toEqual([
      'Push A',
      'Pull A',
      'Legs A',
      'Push B',
      'Pull B',
      'Legs B',
    ]);
    expect(program.days.map((d) => d.splitCanonical)).toEqual([
      'push',
      'pull',
      'legs',
      'push',
      'pull',
      'legs',
    ]);
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

  it('rep ranges and RIR match the goal', () => {
    const hypertrophy = generateProgram(makeConfig({ goal: 'hypertrophy' }), CATALOG, { now: NOW });
    const strength = generateProgram(
      makeConfig({ goal: 'strength', minutesPerSession: 120 }),
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