import * as chrono from 'chrono-node';
import type { SplitCanonical } from '@/types/models';

/**
 * Pull a bodyweight reading (in kg) out of a free-text line.
 * Handles: "19 June 87ish kgs", "Weight 88", "bodyweight: 90.5kg", "BW 84kg",
 *          "@ 88kg", "@88", "@ 90.5 kg".
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

  // 2. @-prefixed bodyweight: "@ 88kg", "@88", "@ 90.5 kg".
  //    Constrain to 2-3 digit values so we don't grab set weights.
  const atPrefixed =
    /@\s*(\d{2,3}(?:\.\d+)?)\s*(?:kgs?|kg)?\b/i;
  const m3 = text.match(atPrefixed);
  if (m3) {
    return parseNumber(m3[1]);
  }

  // 3. "<num>ish kgs" / "<num> kgs" — a weight reading anywhere on the line.
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

// Weekday prefix pattern (optional, for DD/MM date matching).
const WEEKDAY_PREFIX = /^(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?),?\s*/i;

/**
 * Try to parse an explicit DD/MM numeric date from the beginning of a line.
 * Handles: "14/10", "14/10/24", "14-10-2024", "mon 14/10", "Wed 5/4".
 * Validates day 1-31, month 1-12.
 * Returns null if the text doesn't match; caller should then try chrono.
 *
 * @param text - the line text
 * @param yearHint - a year extracted from context (e.g. from a 4-digit year elsewhere)
 * @param nowYear - the current calendar year, passed in from the call boundary (never read clock here)
 */
function parseNumericDDMM(
  text: string,
  yearHint?: number,
  nowYear?: number,
): { date: string; confidence: 'high' | 'low' } | null {
  // Strip optional leading weekday.
  const stripped = text.replace(WEEKDAY_PREFIX, '');

  // Match DD/MM or DD/MM/YY or DD/MM/YYYY (separators: / . -)
  // Only match at the START of the (possibly weekday-stripped) text.
  const m = stripped.match(
    /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/,
  );
  if (!m) return null;

  const day = Number.parseInt(m[1], 10);
  const month = Number.parseInt(m[2], 10);

  // Validate DD/MM ranges.
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  // Parse year from the match, yearHint, or nowYear fallback.
  let year: number | null = null;
  let hasExplicitYear = false;

  if (m[3]) {
    const raw = Number.parseInt(m[3], 10);
    year = m[3].length <= 2 ? 2000 + raw : raw;
    hasExplicitYear = true;
  } else if (yearHint != null) {
    year = yearHint;
  } else if (nowYear != null) {
    year = nowYear;
  }

  if (year == null) return null;

  const confidence: 'high' | 'low' = hasExplicitYear ? 'high' : 'low';
  const date = toISODate(new Date(year, month - 1, day));
  return { date, confidence };
}

/**
 * Extract a workout date from free text.
 * First tries an explicit DD/MM numeric path (UK order); if that doesn't match,
 * falls back to chrono-node.
 *
 * @param text - the line text
 * @param yearHint - a year extracted from context (fills in missing years for chrono too)
 * @param nowYear - the current calendar year; passed in from the call boundary; never
 *                  read the clock inside this function (keeps the parser deterministic).
 *
 * confidence is 'high' when an explicit calendar date was parsed,
 * 'low' for inferred / relative references.
 */
export function extractDate(
  text: string,
  yearHint?: number,
  nowYear?: number,
): { date: string; confidence: 'high' | 'low' } | null {
  // 1. Try explicit DD/MM path BEFORE chrono so UK order wins.
  const numericResult = parseNumericDDMM(text, yearHint, nowYear);
  if (numericResult) return numericResult;

  // 2. Fall back to chrono for named-month dates ("26 Aug 2024", "19 June", "Nov 13").
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
