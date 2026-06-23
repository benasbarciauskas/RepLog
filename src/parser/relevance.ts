import { createCatalog, type ExerciseCatalog } from './catalog';
import { parseExerciseLine } from './exerciseLine';
import { detectSplit, extractBodyweight, extractDate } from './fields';

/**
 * Relevance filter (spec addendum A2). A screenshot / recording / paste can
 * contain unrelated notes (groceries, to-dos, random thoughts). The import flow
 * keeps a note-segment only if it shows real workout signals; everything else is
 * dropped (and counted) so the corpus that reaches storage is workout-only.
 *
 * A segment is workout-related if ANY of these hold:
 *  - it carries a split keyword (push / pull / legs / chest+back / cardio / …);
 *  - at least one of its lines parses to an exercise with ≥1 set;
 *  - it contains a `weight × reps` token (e.g. `105x5`, `70kg x 5`);
 *  - it has both a real date AND a bodyweight reading (a logged session header).
 *
 * Pure + framework-free — used by the import flow and unit-tested directly. A
 * shared catalog is built once per call (cheap) unless one is supplied.
 */
export function isWorkoutRelated(
  segmentText: string,
  catalog: ExerciseCatalog = createCatalog(),
): boolean {
  const text = segmentText?.trim();
  if (!text) return false;

  const lines = text.split(/\r?\n/);

  // Signal 1: a split keyword anywhere in the segment.
  if (detectSplit(text).canonical !== 'unknown') return true;

  // Signal 3: a weight × reps token anywhere (cheap regex, catches set data even
  // when the exercise name is uncatalogued / OCR-mangled).
  if (WEIGHT_REPS.test(text)) return true;

  // Signal 2: any line that parses to an exercise with at least one set.
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const parsed = parseExerciseLine(line, catalog);
    if (parsed.length > 0 && parsed.some((e) => e.sets.length > 0)) return true;
  }

  // Signal 4: a logged session header — a real date together with a bodyweight.
  const hasBodyweight = extractBodyweight(text) !== null;
  if (hasBodyweight) {
    const yearHint = findYearHint(text);
    for (const rawLine of lines) {
      if (extractDate(rawLine, yearHint)) return true;
    }
  }

  return false;
}

// A `weight × reps` token: digits, optional kg/kgs, an x/× separator, then reps.
const WEIGHT_REPS = /\d+(?:\.\d+)?\s*(?:kgs?)?\s*[x×]\s*\d+/i;

function findYearHint(text: string): number | undefined {
  const m = text.match(/\b(?:19|20)\d{2}\b/);
  return m ? Number.parseInt(m[0], 10) : undefined;
}
