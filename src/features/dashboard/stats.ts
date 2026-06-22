import type { ExerciseBest, Workout } from '@/types/models';

/** Local 'yyyy-mm-dd' for a Date (used for "today" and week math). */
export function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse an ISO 'yyyy-mm-dd' as a *local* midnight Date (no TZ drift). */
function parseDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Total volume (Σ weight × reps over working, loaded sets) for one workout. */
export function workoutVolumeKg(workout: Workout): number {
  let total = 0;
  for (const ex of workout.exercises) {
    for (const s of ex.sets) {
      if (s.isWarmup || s.weightKg == null) continue;
      total += s.weightKg * s.reps;
    }
  }
  return total;
}

/** Sum volume across workouts whose date is within [from, to] inclusive (ISO days). */
export function volumeInRange(workouts: Workout[], fromIso: string, toIso: string): number {
  let total = 0;
  for (const w of workouts) {
    if (w.date >= fromIso && w.date <= toIso) total += workoutVolumeKg(w);
  }
  return Math.round(total * 10) / 10;
}

/** Count workouts whose date falls in [from, to] inclusive. */
export function countWorkoutsInRange(
  workouts: Workout[],
  fromIso: string,
  toIso: string,
): number {
  return workouts.filter((w) => w.date >= fromIso && w.date <= toIso).length;
}

/**
 * Monday-anchored start of the ISO week containing `date`, as a local Date.
 * (Mon=0 … Sun=6 offset.)
 */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day);
  return d;
}

/** First-of-month (local) for `date`. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Current training streak in consecutive ISO weeks that contain ≥1 workout,
 * counting back from the week of `today`. A gap week (no session) ends the
 * streak. Returns 0 when the current week has no session.
 *
 * Pure given `today` so it's testable.
 */
export function weeklyStreak(workouts: Workout[], today: Date): number {
  if (workouts.length === 0) return 0;

  // Set of week-start ISO days that have ≥1 workout.
  const weeksWithSession = new Set<string>();
  for (const w of workouts) {
    weeksWithSession.add(isoDay(startOfWeek(parseDay(w.date))));
  }

  let streak = 0;
  const cursor = startOfWeek(today);
  // Walk back week by week while each week has a session.
  while (weeksWithSession.has(isoDay(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

/**
 * Count of PRs (max-weight or best-e1RM all-time bests) set within the last
 * `days` window ending `today`. A best counts if either its maxWeightDate or
 * bestE1rmDate falls inside the window. Pure given `today`.
 */
export function prsInPeriod(
  bests: ExerciseBest[],
  today: Date,
  days = 30,
): number {
  const from = new Date(today);
  from.setDate(from.getDate() - days);
  const fromIso = isoDay(from);
  const toIso = isoDay(today);

  let count = 0;
  for (const b of bests) {
    const inWindow = (d: string | null) => d != null && d >= fromIso && d <= toIso;
    if (inWindow(b.maxWeightDate) || inWindow(b.bestE1rmDate)) count += 1;
  }
  return count;
}

export interface DashboardStats {
  thisWeekVolumeKg: number;
  lastWeekVolumeKg: number;
  /** Signed % change vs last week, or null when last week had no volume. */
  weeklyVolumeDeltaPct: number | null;
  streakWeeks: number;
  workoutsThisMonth: number;
  prsThisPeriod: number;
}

/**
 * Compute the dashboard progress-card stats from workouts + bests, anchored to
 * `today` (defaults to now). Pure when `today` is passed.
 */
export function dashboardStats(
  workouts: Workout[],
  bests: ExerciseBest[],
  today: Date = new Date(),
): DashboardStats {
  const weekStart = startOfWeek(today);
  const weekStartIso = isoDay(weekStart);
  const todayIso = isoDay(today);

  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(weekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

  const thisWeek = volumeInRange(workouts, weekStartIso, todayIso);
  const lastWeek = volumeInRange(workouts, isoDay(lastWeekStart), isoDay(lastWeekEnd));

  const weeklyVolumeDeltaPct =
    lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;

  return {
    thisWeekVolumeKg: thisWeek,
    lastWeekVolumeKg: lastWeek,
    weeklyVolumeDeltaPct,
    streakWeeks: weeklyStreak(workouts, today),
    workoutsThisMonth: countWorkoutsInRange(workouts, isoDay(startOfMonth(today)), todayIso),
    prsThisPeriod: prsInPeriod(bests, today, 30),
  };
}
