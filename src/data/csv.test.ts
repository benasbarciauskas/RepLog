import { describe, expect, it } from 'vitest';
import { kgToLb } from '@/lib/units';
import { epley1rm } from '@/analytics/epley';
import type { Workout } from '@/types/models';
import { workoutsToCsv } from './csv';

function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: 'w1',
    date: '2024-08-26',
    dateConfidence: 'high',
    bodyweightKg: 87,
    splitCanonical: 'push',
    splitRaw: 'Push',
    blockId: null,
    sourceNoteId: 'n1',
    createdAt: '2024-08-26T10:00:00.000Z',
    exercises: [
      {
        exerciseId: 'barbell-bench-press',
        rawName: 'Bench Press',
        unit: 'kg',
        sets: [{ weightKg: 100, reps: 5, raw: '100x5' }],
      },
    ],
    ...overrides,
  };
}

function parseRows(csv: string): string[][] {
  const lines = csv.split('\n').filter((l) => l.length > 0);
  return lines.map((line) => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields;
  });
}

describe('workoutsToCsv', () => {
  it('emits header-only for empty workouts', () => {
    const csv = workoutsToCsv([], 'kg');
    const rows = parseRows(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe('date');
    expect(csv.endsWith('\n')).toBe(true);
  });

  it('header has correct column names with kg suffix', () => {
    const csv = workoutsToCsv([], 'kg');
    const [header] = parseRows(csv);
    expect(header).toEqual([
      'date', 'exercise', 'set', 'weight_kg', 'reps', 'rpe', 'warmup',
      'est_1rm_kg', 'volume_kg', 'bodyweight_kg', 'split',
    ]);
  });

  it('header has correct column names with lb suffix', () => {
    const csv = workoutsToCsv([], 'lb');
    const [header] = parseRows(csv);
    expect(header).toEqual([
      'date', 'exercise', 'set', 'weight_lb', 'reps', 'rpe', 'warmup',
      'est_1rm_lb', 'volume_lb', 'bodyweight_lb', 'split',
    ]);
  });

  it('emits one row per set', () => {
    const workout = makeWorkout({
      exercises: [
        {
          exerciseId: 'bench',
          rawName: 'Bench',
          unit: 'kg',
          sets: [
            { weightKg: 100, reps: 5, raw: '100x5' },
            { weightKg: 110, reps: 3, raw: '110x3' },
          ],
        },
        {
          exerciseId: 'squat',
          rawName: 'Squat',
          unit: 'kg',
          sets: [{ weightKg: 120, reps: 5, raw: '120x5' }],
        },
      ],
    });
    const rows = parseRows(workoutsToCsv([workout], 'kg'));
    // 1 header + 3 set rows
    expect(rows).toHaveLength(4);
  });

  it('passes through kg values unchanged', () => {
    const workout = makeWorkout();
    const rows = parseRows(workoutsToCsv([workout], 'kg'));
    const dataRow = rows[1];
    // weight
    expect(dataRow[3]).toBe('100');
    // est_1rm
    const expected1rm = String(Math.round(epley1rm(100, 5) * 100) / 100);
    expect(dataRow[7]).toBe(expected1rm);
    // volume = 100*5 = 500
    expect(dataRow[8]).toBe('500');
    // bodyweight
    expect(dataRow[9]).toBe('87');
  });

  it('converts weights to lb', () => {
    const workout = makeWorkout({ bodyweightKg: 80 });
    const rows = parseRows(workoutsToCsv([workout], 'lb'));
    const dataRow = rows[1];
    expect(dataRow[3]).toBe(String(Math.round(kgToLb(100) * 100) / 100));
    expect(dataRow[7]).toBe(String(Math.round(kgToLb(epley1rm(100, 5)) * 100) / 100));
    expect(dataRow[8]).toBe(String(Math.round(kgToLb(100 * 5) * 100) / 100));
    expect(dataRow[9]).toBe(String(Math.round(kgToLb(80) * 100) / 100));
  });

  it('emits empty weight, volume, and est_1rm when weightKg is null', () => {
    const workout = makeWorkout({
      exercises: [
        {
          exerciseId: 'pullup',
          rawName: 'Pull-up',
          unit: 'kg',
          sets: [{ weightKg: null, reps: 8, raw: 'BWx8' }],
        },
      ],
    });
    const rows = parseRows(workoutsToCsv([workout], 'kg'));
    const dataRow = rows[1];
    expect(dataRow[3]).toBe('');  // weight
    expect(dataRow[7]).toBe('');  // est_1rm
    expect(dataRow[8]).toBe('');  // volume
  });

  it('emits warmup=yes for warmup sets, no otherwise', () => {
    const workout = makeWorkout({
      exercises: [
        {
          exerciseId: 'bench',
          rawName: 'Bench',
          unit: 'kg',
          sets: [
            { weightKg: 60, reps: 10, raw: '60x10', isWarmup: true },
            { weightKg: 100, reps: 5, raw: '100x5', isWarmup: false },
          ],
        },
      ],
    });
    const rows = parseRows(workoutsToCsv([workout], 'kg'));
    expect(rows[1][6]).toBe('yes');
    expect(rows[2][6]).toBe('no');
  });

  it('emits empty rpe when absent', () => {
    const workout = makeWorkout();
    const rows = parseRows(workoutsToCsv([workout], 'kg'));
    expect(rows[1][5]).toBe('');
  });

  it('emits rpe value when present', () => {
    const workout = makeWorkout({
      exercises: [
        {
          exerciseId: 'bench',
          rawName: 'Bench',
          unit: 'kg',
          sets: [{ weightKg: 100, reps: 5, rpe: 8, raw: '100x5@8' }],
        },
      ],
    });
    const rows = parseRows(workoutsToCsv([workout], 'kg'));
    expect(rows[1][5]).toBe('8');
  });

  it('escapes exercise names containing a comma', () => {
    const workout = makeWorkout({
      exercises: [
        {
          exerciseId: 'x',
          rawName: 'Curl, wide grip',
          unit: 'kg',
          sets: [{ weightKg: 20, reps: 10, raw: '20x10' }],
        },
      ],
    });
    const csv = workoutsToCsv([workout], 'kg');
    const rows = parseRows(csv);
    expect(rows[1][1]).toBe('Curl, wide grip');
  });

  it('escapes exercise names containing a double-quote', () => {
    const workout = makeWorkout({
      exercises: [
        {
          exerciseId: 'x',
          rawName: 'DB "Fly"',
          unit: 'kg',
          sets: [{ weightKg: 20, reps: 10, raw: '20x10' }],
        },
      ],
    });
    const csv = workoutsToCsv([workout], 'kg');
    const rows = parseRows(csv);
    expect(rows[1][1]).toBe('DB "Fly"');
  });

  it('sorts workouts chronologically by date ascending', () => {
    const older = makeWorkout({ id: 'w1', date: '2024-01-01' });
    const newer = makeWorkout({ id: 'w2', date: '2024-12-31' });
    // Pass in reverse order
    const rows = parseRows(workoutsToCsv([newer, older], 'kg'));
    expect(rows[1][0]).toBe('2024-01-01');
    expect(rows[2][0]).toBe('2024-12-31');
  });

  it('set index is 1-based per exercise', () => {
    const workout = makeWorkout({
      exercises: [
        {
          exerciseId: 'bench',
          rawName: 'Bench',
          unit: 'kg',
          sets: [
            { weightKg: 80, reps: 8, raw: '80x8' },
            { weightKg: 90, reps: 5, raw: '90x5' },
            { weightKg: 100, reps: 3, raw: '100x3' },
          ],
        },
      ],
    });
    const rows = parseRows(workoutsToCsv([workout], 'kg'));
    expect(rows[1][2]).toBe('1');
    expect(rows[2][2]).toBe('2');
    expect(rows[3][2]).toBe('3');
  });

  it('includes trailing newline', () => {
    const csv = workoutsToCsv([makeWorkout()], 'kg');
    expect(csv.endsWith('\n')).toBe(true);
  });
});
