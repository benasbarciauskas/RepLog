import * as chrono from 'chrono-node';
import type { SplitCanonical } from '@/types/models';

/**
 * Pull a bodyweight reading (in kg) out of a free-text line.
 * Handles: "19 June 87ish kgs", "Weight 88", "bodyweight: 90.5kg", "BW 84kg".
 * Returns null when no bodyweight signal is present.
 */
export function extractBodyweight(text: string): number | null {
  // 1. Explicit label: weight / bodyweight / bw  -> number  (+ optional ish/kg/kgs)
  const labelled =
    /\b(?:body\s*weight|bodyweight|weight|bw)\s*[:=]?\s*(\d{2,3}(?:\.\d+)?)\s*(?:ish)?\s*(?:kgs?|kg)?\b/i;
  const m1 = text.match(labelled);
  if (m1) {
    return parseNumber(m1[1]);
  }

  // 2. "<num>ish kgs" / "<num> kgs" — a weight reading anywhere on the line.
  //    Require either the "ish" qualifier or a kg unit so we don't grab set weights.
  const unitMatch =
    /\b(\d{2,3}(?:\.\d+)?)\s*ish\s*(?:kgs?|kg)?\b|\b(\d{2,3}(?:\.\d+)?)\s*kgs\b/i;
  const m2 = text.match(unitMatch);
  if (m2) {
    return parseNumber(m2[1] ?? m2[2]);
  }

  return null;
}

function parseNumber(s: string): number {
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

interface SplitPattern {
  canonical: SplitCanonical;
  test: RegExp;
}

// Order matters: more specific compound splits before single-word ones.
const SPLIT_PATTERNS: SplitPattern[] = [
  { canonical: 'chest-back', test: /\bchest\s*(?:and|&|\+|\/|-)?\s*back\b|\bback\s*(?:and|&|\+|\/|-)?\s*chest\b/i },
  { canonical: 'chest-tris', test: /\bchest\s*(?:and|&|\+|\/|-)?\s*tri(?:cep)?s?\b/i },
  { canonical: 'back-bis', test: /\bback\s*(?:and|&|\+|\/|-)?\s*bi(?:cep)?s?\b/i },
  { canonical: 'cardio', test: /\b(?:cardio|marathon|run(?:ning)?|jog(?:ging)?|5k|10k|treadmill|cycling|rowing\s+erg)\b/i },
  { canonical: 'full-body', test: /\bfull\s*body\b/i },
  { canonical: 'upper', test: /\bupper(?:\s*body)?\b/i },
  { canonical: 'lower', test: /\blower(?:\s*body)?\b/i },
  { canonical: 'push', test: /\bpush\b/i },
  { canonical: 'pull', test: /\bpull(?:\s*day)?\b/i },
  { canonical: 'legs', test: /\blegs?\b/i },
  { canonical: 'shoulders', test: /\bshoulders?\b/i },
  { canonical: 'arms', test: /\barms?\b/i },
];

/**
 * Classify a line/header into a canonical split.
 * Returns `{ canonical: 'unknown', raw: null }` when nothing matches.
 */
export function detectSplit(text: string): { canonical: SplitCanonical; raw: string | null } {
  for (const { canonical, test } of SPLIT_PATTERNS) {
    const m = text.match(test);
    if (m) {
      return { canonical, raw: m[0].trim() };
    }
  }
  return { canonical: 'unknown', raw: null };
}

/**
 * Extract a workout date from free text. Uses chrono-node.
 * `yearHint` fills in a missing year (e.g. "13 Nov" -> "<yearHint>-11-13").
 * confidence is 'high' when chrono parsed an explicit calendar date,
 * 'low' for relative/implied references.
 */
export function extractDate(
  text: string,
  yearHint?: number,
): { date: string; confidence: 'high' | 'low' } | null {
  const ref = yearHint ? new Date(yearHint, 0, 1) : undefined;
  const results = chrono.parse(text, ref, { forwardDate: false });
  if (results.length === 0) return null;

  const result = results[0];
  const start = result.start;
  // Require an explicit day + month to count as a real date (avoid bare years
  // or stray numbers chrono sometimes interprets loosely).
  const hasDay = start.isCertain('day');
  const hasMonth = start.isCertain('month');
  if (!hasDay || !hasMonth) return null;

  const d = start.date();
  if (yearHint && !start.isCertain('year')) {
    d.setFullYear(yearHint);
  }

  const date = toISODate(d);
  const confidence: 'high' | 'low' = hasDay && hasMonth ? 'high' : 'low';
  return { date, confidence };
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}
