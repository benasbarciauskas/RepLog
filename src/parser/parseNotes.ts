import type { ParseResult, ParsedWorkout, WorkoutExercise } from '@/types/models';
import type { ExerciseCatalog } from './catalog';
import { parseExerciseLine } from './exerciseLine';
import { detectSplit, extractBodyweight, extractDate } from './fields';
import { segmentWorkouts } from './segment';

/**
 * Top-level entry point: parse a raw note (one or many sessions) into candidate
 * workouts plus a list of warnings for ambiguous / un-parsed remainders so the
 * review UI can surface them instead of silently dropping data.
 */
export function parseNotes(rawText: string, catalog: ExerciseCatalog): ParseResult {
  const warnings: string[] = [];
  const workouts: ParsedWorkout[] = [];

  const chunks = segmentWorkouts(rawText);

  for (const chunk of chunks) {
    const lines = chunk.split(/\r?\n/);

    // Year hint: prefer a 4-digit year anywhere in the chunk so "13 Nov" lines
    // can be dated when the header carries the year.
    const yearHint = findYearHint(chunk);

    let date: string | null = null;
    let dateConfidence: 'high' | 'low' = 'low';
    let bodyweightKg: number | null = null;
    let splitCanonical: ParsedWorkout['splitCanonical'] = 'unknown';
    let splitRaw: string | null = null;

    const exercises: WorkoutExercise[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Bodyweight (first hit on any line wins).
      if (bodyweightKg === null) {
        const bw = extractBodyweight(line);
        if (bw !== null) bodyweightKg = bw;
      }

      // Date (first explicit date in the chunk wins).
      if (date === null) {
        const d = extractDate(line, yearHint);
        if (d) {
          date = d.date;
          dateConfidence = d.confidence;
        }
      }

      // Split (first matching header wins, but skip lines that are set data).
      if (splitCanonical === 'unknown' && !looksLikeSetLine(line)) {
        const s = detectSplit(line);
        if (s.canonical !== 'unknown') {
          splitCanonical = s.canonical;
          splitRaw = s.raw;
        }
      }

      // Exercise line.
      const parsed = parseExerciseLine(line, catalog);
      if (parsed.length > 0) {
        exercises.push(...parsed);
        collectInlineRemainders(line, warnings);
      }
    }

    // Only emit a workout if it has content (exercises, a date, or a split).
    const hasContent =
      exercises.length > 0 || date !== null || splitCanonical !== 'unknown';
    if (!hasContent) continue;

    workouts.push({
      date: date ?? '',
      dateConfidence,
      bodyweightKg,
      splitCanonical,
      splitRaw,
      exercises,
    });
  }

  return { workouts, warnings };
}

function findYearHint(text: string): number | undefined {
  const m = text.match(/\b(19|20)\d{2}\b/);
  return m ? Number.parseInt(m[0], 10) : undefined;
}

/** Heuristic: does this line carry set data (weights/reps)? */
function looksLikeSetLine(line: string): boolean {
  // A weight×reps token, or a "Name: <digits>x<digits>" exercise line.
  return /\d+\s*(?:kgs?)?\s*[x×]\s*\d+/i.test(line) || /:\s*\d[\d.]*\s*(?:kgs?)?\s*[x×,]/i.test(line);
}

/**
 * After an exercise line parses, scan its comma tokens for an inline secondary
 * exercise that was NOT captured (e.g. "..., then archers x 10"). Such tokens
 * contain alphabetic content (an exercise name) and must be flagged, never
 * silently dropped.
 */
function collectInlineRemainders(line: string, warnings: string[]): void {
  const colon = line.indexOf(':');
  const setText = colon !== -1 ? line.slice(colon + 1) : line;

  for (const rawToken of setText.split(',')) {
    const token = rawToken.trim();
    if (!token) continue;

    // A pure set token: digits, optional kg/kgs, optional x, optional reps.
    const isSetToken = /^\d+(?:\.\d+)?\s*(?:kgs?|kg)?\s*(?:[x×]\s*\d+(?:\.\d+)?)?\s*\.{0,3}…?$/i.test(
      token,
    );
    if (isSetToken) continue;

    // Skip pure noise (no letters at all, e.g. "..." or stray punctuation).
    if (!/[a-z]/i.test(token)) continue;

    warnings.push(`Unparsed inline entry "${token}" — review and add manually if it's an exercise.`);
  }
}
