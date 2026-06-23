import type { ExerciseDef, SetEntry, WorkoutExercise } from '@/types/models';
import type { ExerciseCatalog } from './catalog';

/**
 * Parse a single exercise line into one WorkoutExercise (or [] if it has no
 * set data — e.g. a header line).
 *
 * Handles:
 *  - a leading `NxM:` scheme prefix to strip ("Benchpress 5x5: 105x5, 5")
 *  - tokens split on commas
 *  - weight carried forward for reps-only tokens
 *  - kg / kgs / no-unit all treated as kg
 *  - `WEIGHTx REPS`, `WEIGHT x REPS`, `WEIGHTkgx REPS`, `WEIGHT xREPS`
 *  - decimal weights
 *  - trailing `...` truncation ignored
 *  - pull-up lines with added weight resolve to `weighted-pull-up`,
 *    bodyweight to `pull-up`
 */
export function parseExerciseLine(
  line: string,
  catalog: ExerciseCatalog,
): WorkoutExercise[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  const { name, setText } = splitNameAndSets(trimmed);
  if (!/[a-z]/i.test(name)) return [];
  if (!setText) return [];

  const sets = parseSets(setText);
  if (sets.length === 0) return [];

  const hasAddedWeight = sets.some((s) => s.weightKg !== null && s.weightKg > 0);
  const def = resolveExercise(name, hasAddedWeight, catalog);
  const exerciseId = def ? def.id : `unknown:${slugify(name)}`;

  return [
    {
      exerciseId,
      rawName: name,
      unit: 'kg',
      sets,
    },
  ];
}

/**
 * Split a line into the exercise name and the set-data text.
 * Prefer a colon boundary; otherwise fall back to the first token that looks
 * like set data (a number optionally followed by x/reps).
 */
function splitNameAndSets(line: string): { name: string; setText: string } {
  const colon = line.indexOf(':');
  if (colon !== -1) {
    const rawName = line.slice(0, colon).trim();
    const setText = line.slice(colon + 1).trim();
    // Strip a trailing `NxM` scheme from the name part ("Benchpress 5x5").
    return { name: stripSchemeSuffix(rawName), setText };
  }

  // No colon: find where set data begins. A set token starts at a number that
  // is followed by an x/×/kg or sits at a word boundary preceding more digits.
  const m = line.match(/\d/);
  if (!m || m.index === undefined) {
    return { name: line.trim(), setText: '' };
  }
  // The first digit marks where set data begins; everything before is the name.
  const idx = m.index;
  const name = stripSchemeSuffix(line.slice(0, idx).trim());
  const setText = line.slice(idx).trim();
  return { name: name || line.slice(0, idx).trim(), setText };
}

/** Remove a trailing rep-scheme like "5x5" or "3 x 8" from a name segment. */
function stripSchemeSuffix(name: string): string {
  return name.replace(/\s+\d+\s*[x×]\s*\d+\s*$/i, '').trim();
}

/**
 * Tokenize the set-data text into SetEntry[]. Splits on commas, carries weight
 * forward across reps-only tokens, ignores `...` truncation and empty tokens.
 */
function parseSets(setText: string): SetEntry[] {
  const tokens = setText
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !/^\.{2,}$/.test(t) && !/^…$/.test(t));

  const sets: SetEntry[] = [];
  let carriedWeight: number | null = null;

  for (const token of tokens) {
    const parsed = parseToken(token);
    if (!parsed) continue;

    let weight = parsed.weightKg;
    if (weight === null && parsed.repsOnly) {
      // reps-only token inherits the prior weight
      weight = carriedWeight;
    } else if (weight !== null) {
      carriedWeight = weight;
    }

    sets.push({
      weightKg: weight,
      reps: parsed.reps,
      raw: token,
    });
  }

  return sets;
}

interface TokenResult {
  weightKg: number | null;
  reps: number;
  repsOnly: boolean;
}

/**
 * Parse one set token. Recognized shapes:
 *   105x5 | 105x 5 | 105 x 5 | 70kgx5 | 70kg x 5 | 30kgsx 5 | 42.5 x6 | 5 (reps only)
 */
function parseToken(token: string): TokenResult | null {
  const t = token.trim().replace(/\.{2,}$|…$/g, '').trim();
  if (!t) return null;

  // WEIGHT [unit] x REPS  (x may be x or ×; unit kg/kgs optional; spaces flexible)
  const withWeight = t.match(
    /^(\d+(?:\.\d+)?)\s*(?:kgs?|kg)?\s*[x×]\s*(\d+(?:\.\d+)?)$/i,
  );
  if (withWeight) {
    return {
      weightKg: roundNum(Number.parseFloat(withWeight[1])),
      reps: Math.round(Number.parseFloat(withWeight[2])),
      repsOnly: false,
    };
  }

  // WEIGHT unit  (no rep marker, e.g. trailing "20kg") -> treat as reps-only? no.
  // reps-only token: a bare number (optionally with trailing reps marker)
  const repsOnly = t.match(/^(\d+(?:\.\d+)?)$/);
  if (repsOnly) {
    return {
      weightKg: null,
      reps: Math.round(Number.parseFloat(repsOnly[1])),
      repsOnly: true,
    };
  }

  return null;
}

function roundNum(n: number): number {
  // keep one decimal of precision where present, else integer
  return Math.round(n * 100) / 100;
}

/**
 * Resolve an exercise name to a catalog def, applying the pull-up rule:
 * a pull-up/chin-up name with added weight maps to `weighted-pull-up`,
 * bodyweight maps to `pull-up`.
 */
function resolveExercise(
  name: string,
  hasAddedWeight: boolean,
  catalog: ExerciseCatalog,
): ExerciseDef | null {
  const matched = catalog.match(name);

  if (matched && (matched.id === 'pull-up' || matched.id === 'weighted-pull-up')) {
    const wantId = hasAddedWeight ? 'weighted-pull-up' : 'pull-up';
    if (matched.id !== wantId) {
      const alt = catalog.all().find((d) => d.id === wantId);
      if (alt) return alt;
    }
  }

  return matched;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
