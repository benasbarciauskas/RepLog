import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog';
import { parseExerciseLine } from '../exerciseLine';
import { parseNotes } from '../parseNotes';
import { preprocessStructured } from '../structured';

const cat = createCatalog();

const STRUCTURED_WORKOUT = `Evening Workout
19:10, Saturday, 20 Jun 2026
23m  2038 kg  0 PRs
Bayesian Curl  1RM
1  10.3 kg × 12  14
2  10.3 kg × 12  14
Triceps Extension (Cable)  1RM
1  21.6 kg × 12  30
2  21.6 kg × 12  30
Reverse Zottman Curl  1RM
1  10 kg × 12  14
2  12 kg × 12  17
Lateral Raise (Cable)  1RM
1  9 kg × 12  13
2  9 kg × 12  13
Bicep Curl (Dumbbell)  1RM
1  10 kg × 12  14
2  12 kg × 12  17`;

describe('preprocessStructured', () => {
  it('leaves inline exercise lines unchanged', () => {
    const inline = 'Bench press: 100x5, 100x5\nSquat: 120x5';
    expect(preprocessStructured(inline)).toBe(inline);
  });

  it('rewrites a set row with leading number and trailing 1RM into a clean token', () => {
    const preprocessed = preprocessStructured('Bayesian Curl  1RM\n1  10.3 kg × 12  14');
    expect(preprocessed).toContain('Bayesian Curl: 10.3 kg x 12');
  });
});

describe('parseNotes — structured set-list export', () => {
  const result = parseNotes(STRUCTURED_WORKOUT, cat);
  const workout = result.workouts[0];

  it('parses five exercises with correct names', () => {
    expect(workout.exercises).toHaveLength(5);
    const names = workout.exercises.map((e) => e.rawName);
    expect(names).toEqual([
      'Bayesian Curl',
      'Triceps Extension (Cable)',
      'Reverse Zottman Curl',
      'Lateral Raise (Cable)',
      'Bicep Curl (Dumbbell)',
    ]);
  });

  it('captures two sets per exercise at the right weight and reps', () => {
    expect(workout.exercises[0].sets).toEqual([
      { weightKg: 10.3, reps: 12, raw: '10.3 kg x 12' },
      { weightKg: 10.3, reps: 12, raw: '10.3 kg x 12' },
    ]);

    expect(workout.exercises[1].sets).toEqual([
      { weightKg: 21.6, reps: 12, raw: '21.6 kg x 12' },
      { weightKg: 21.6, reps: 12, raw: '21.6 kg x 12' },
    ]);

    expect(workout.exercises[2].sets).toEqual([
      { weightKg: 10, reps: 12, raw: '10 kg x 12' },
      { weightKg: 12, reps: 12, raw: '12 kg x 12' },
    ]);

    expect(workout.exercises[3].sets).toEqual([
      { weightKg: 9, reps: 12, raw: '9 kg x 12' },
      { weightKg: 9, reps: 12, raw: '9 kg x 12' },
    ]);

    expect(workout.exercises[4].sets).toEqual([
      { weightKg: 10, reps: 12, raw: '10 kg x 12' },
      { weightKg: 12, reps: 12, raw: '12 kg x 12' },
    ]);
  });

  it('detects the workout date', () => {
    expect(workout.date).toBe('2026-06-20');
  });

  it('does not treat the time line as an exercise named "19"', () => {
    const bogus = workout.exercises.find((e) => e.rawName === '19');
    expect(bogus).toBeUndefined();
  });
});

describe('parseNotes — inline regression', () => {
  const inline = 'Bench press: 100x5, 100x5\nSquat: 120x5';
  const result = parseNotes(inline, cat);
  const workout = result.workouts[0];

  it('still parses inline notes correctly', () => {
    expect(workout.exercises).toHaveLength(2);
    expect(workout.exercises[0].exerciseId).toBe('barbell-bench-press');
    expect(workout.exercises[0].sets).toEqual([
      { weightKg: 100, reps: 5, raw: '100x5' },
      { weightKg: 100, reps: 5, raw: '100x5' },
    ]);
    expect(workout.exercises[1].exerciseId).toBe('back-squat');
    expect(workout.exercises[1].sets).toEqual([{ weightKg: 120, reps: 5, raw: '120x5' }]);
  });
});

describe('parseExerciseLine — alphabetic name guard', () => {
  it('returns [] when the exercise name has no letters', () => {
    expect(parseExerciseLine('19:10, Saturday, 20 Jun 2026', cat)).toEqual([]);
  });
});