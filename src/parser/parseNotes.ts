import type { ParseResult, ParsedWorkout, WorkoutExercise } from '@/types/models';
import type { ExerciseCatalog } from './catalog';
import { isFullySetTokens, parseExerciseLine } from './exerciseLine';
import { detectSplit, extractBodyweight, extractDate } from './fields';
import { isSessionHeader, segmentWorkouts } from './segment';
import { preprocessStructured } from './structured';

/**
 * Top-level entry point: parse a raw note (one or many sessions) into candidate
 * workouts plus a list of warnings for ambiguous / un-parsed remainders so the
 * review UI can surface them instead of silently dropping data.
 *
 * @param rawText - the raw note text
 * @param catalog - the exercise catalog for name resolution
 * @param nowYear - the current calendar year, sourced ONCE at the call boundary.
 *                  Used as a fallback when yearless DD/MM dates appear and no
 *                  year is available from context. Keeping it here (not inside
 *                  the parser modules) ensures the parser stays deterministic.
 */
export function parseNotes(
  rawText: string,
  catalog: ExerciseCatalog,
  nowYear?: number,
): ParseResult {
  const warnings: string[] = [];
  const workouts: ParsedWorkout[] = [];

  const text = preprocessStructured(rawText);
  const chunks = segmentWorkouts(text);

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

      // Parse the line as an exercise up front so the date guard below can use
      // the authoritative result: a line that yields an exercise is a SET line,
      // never a date header. Only attempt it on lines that look like set data
      // (matches the original guard) so headers/date lines stay cheap.
      const isSetLine = looksLikeSetLine(line);
      const parsed =
        isSetLine && !isSessionHeader(line)
          ? parseExerciseLine(line, catalog)
          : [];

      // Bodyweight (first hit on any line wins).
      if (bodyweightKg === null) {
        const bw = extractBodyweight(line);
        if (bw !== null) bodyweightKg = bw;
      }

      // Date (first explicit date in the chunk wins). Never run date extraction
      // on a line that parses as an exercise — a numeric rep-list like
      // "pullups 12/10" must not be mis-read as a DD/MM date (spec §3: dates are
      // matched only at header/line-start, never mid-line on an exercise line).
      if (date === null && parsed.length === 0) {
        const d = extractDate(line, yearHint, nowYear);
        if (d) {
          date = d.date;
          dateConfidence = d.confidence;
        }
      }

      // Split (first matching header wins, but skip lines that are set data).
      if (splitCanonical === 'unknown' && !isSetLine) {
        const s = detectSplit(line);
        if (s.canonical !== 'unknown') {
          splitCanonical = s.canonical;
          splitRaw = s.raw;
        }
      }

      // Push parsed exercises (skips session headers / non-set lines via `parsed`).
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

// A weekday-led numeric date header ("mon 14/10", "Wed 5/4"): NOT a set line.
const WEEKDAY_LED_NUMERIC_DATE =
  /^\s*(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?),?\s+\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{1,4})?\b/i;

/** Heuristic: does this line carry set data (weights/reps)? */
function looksLikeSetLine(line: string): boolean {
  // A bodyweight slash rep-list after an exercise name — including the two-value
  // form "pullups 12/10" — is set data, not a DD/MM date. Guard against
  // weekday-led numeric date headers ("mon 14/10") which must stay header lines.
  if (
    /[a-z].*\b\d+\/\d+\b/i.test(line) &&
    !WEEKDAY_LED_NUMERIC_DATE.test(line)
  ) {
    return true;
  }
  return (
    /\d+\s*(?:kgs?)?\s*[x×]\s*\d+/i.test(line) ||
    /:\s*\d[\d.]*\s*(?:kgs?)?\s*[x×,]/i.test(line) ||
    /\d+\s*(?:kgs?|kg)\s+\d+\/\d+/i.test(line) ||
    /\d+\s+[x×]\d+[x×]\d+/i.test(line) ||
    /\b\d+\/\d+(?:\/\d+)+\b/.test(line)
  );
}

/**
 * After an exercise line parses, scan its comma-segments for an inline secondary
 * exercise that was NOT captured (e.g. "..., then archers x 10"). Such segments
 * contain alphabetic content (an exercise name) beyond the set tokens and must be
 * flagged, never silently dropped.
 *
 * To avoid false positives on the widened dialects (space-separated `NxM`,
 * `WEIGHT NxM` schemes, slash rep-lists, leading-`x`, bare reps), each segment is
 * checked with isFullySetTokens — the SAME token recognizers the set tokenizer
 * uses — rather than a second, narrower regex. A segment fully accounted for by
 * set tokens is not flagged; only a genuine alphabetic remainder is.
 *
 * On a no-colon line the first segment carries the exercise name (e.g.
 * "bench press 100x5 102.5x5 105x4"), so the name prefix is allowed there.
 */
function collectInlineRemainders(line: string, warnings: string[]): void {
  const colon = line.indexOf(':');
  const setText = colon !== -1 ? line.slice(colon + 1) : line;
  const hasColon = colon !== -1;

  const segments = setText.split(',');
  segments.forEach((rawToken, i) => {
    const token = rawToken.trim();
    if (!token) return;

    // Skip pure noise (no letters at all, e.g. "..." or stray punctuation).
    if (!/[a-z]/i.test(token)) return;

    // The first segment of a no-colon line carries the exercise name; allow it.
    const allowName = !hasColon && i === 0;

    // Fully accounted for by recognized set tokens → not an unparsed remainder.
    if (isFullySetTokens(token, allowName)) return;

    warnings.push(`Unparsed inline entry "${token}" — review and add manually if it's an exercise.`);
  });
}
