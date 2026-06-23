import { epley1rm } from '@/analytics/epley';
import { kgToLb } from '@/lib/units';
import type { Unit, Workout } from '@/types/models';

function toDisplayUnit(kg: number, unit: Unit): number {
  return unit === 'lb' ? kgToLb(kg) : kg;
}

function fmt(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

function escapeField(value: string): string {
  if (/[,"\r\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function workoutsToCsv(workouts: Workout[], unit: Unit): string {
  const header = [
    'date',
    'exercise',
    'set',
    `weight_${unit}`,
    'reps',
    'rpe',
    'warmup',
    `est_1rm_${unit}`,
    `volume_${unit}`,
    `bodyweight_${unit}`,
    'split',
  ].join(',');

  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));

  const rows: string[] = [header];

  for (const workout of sorted) {
    const bodyweightField =
      workout.bodyweightKg !== null && workout.bodyweightKg !== undefined
        ? fmt(toDisplayUnit(workout.bodyweightKg, unit))
        : '';

    for (const exercise of workout.exercises) {
      exercise.sets.forEach((set, idx) => {
        const weightField =
          set.weightKg !== null && set.weightKg !== undefined
            ? fmt(toDisplayUnit(set.weightKg, unit))
            : '';

        const est1rmField = (() => {
          if (set.weightKg === null || set.weightKg === undefined) return '';
          if (set.reps <= 0) return '';
          const e1rmKg = epley1rm(set.weightKg, set.reps);
          if (!isFinite(e1rmKg)) return '';
          return fmt(toDisplayUnit(e1rmKg, unit));
        })();

        const volumeField = (() => {
          if (set.weightKg === null || set.weightKg === undefined) return '';
          const volKg = set.weightKg * set.reps;
          if (!isFinite(volKg)) return '';
          return fmt(toDisplayUnit(volKg, unit));
        })();

        const row = [
          escapeField(workout.date),
          escapeField(exercise.rawName),
          escapeField(String(idx + 1)),
          escapeField(weightField),
          escapeField(String(set.reps)),
          escapeField(set.rpe !== null && set.rpe !== undefined ? String(set.rpe) : ''),
          escapeField(set.isWarmup ? 'yes' : 'no'),
          escapeField(est1rmField),
          escapeField(volumeField),
          escapeField(bodyweightField),
          escapeField(workout.splitCanonical),
        ].join(',');

        rows.push(row);
      });
    }
  }

  return rows.join('\n') + '\n';
}
