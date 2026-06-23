import type { ExerciseDef, SetEntry, WorkoutExercise } from '@/types/models';
import type { ExerciseCatalog } from './catalog';

/**
 * Parse a single exercise line into one WorkoutExercise (or [] if it has no
 * set data — e.g. a header line).
 *
 * Handles:
 *  - a leading `NxM:` scheme prefix to strip ("Benchpress 5x5: 105x5, 5")
 *  - comma- OR space-separated set tokens
 *  - slash rep-lists after a leading weight: "60kg 5/5/4"
 *  - bodyweight slash rep-lists: "12/10/8"
 *  - WEIGHT xNxM scheme shorthand: "140 x5x5" = 5 sets of 5 reps at 140
 *  - carried-weight x-rep tokens: "25 x12 x12 x15"
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
 * Tokenize the set-data text into SetEntry[].
 *
 * Recognizes (in order of priority):
 *  1. WEIGHT xNxM scheme: "140 x5x5" = N sets of M reps at WEIGHT
 *  2. WEIGHT [unit] slash rep-list: "60kg 5/5/4" = sets of WEIGHT x5, x5, x4
 *  3. Bare slash rep-list (no weight): "12/10/8" = bodyweight sets
 *  4. Space-separated WEIGHT[unit]xREPS tokens: "100x5 102.5x5 105x4"
 *  5. Leading-x rep tokens: "x12 x12 x15" — carry weight from previous
 *  6. Comma-separated legacy format (falls through to token scanner)
 *  7. Reps-only: bare number, carries weight forward
 */
function parseSets(setText: string): SetEntry[] {
  // Normalize: collapse multiple spaces, trim.
  const text = setText.replace(/\.{2,}|…/g, '').trim();
  if (!text) return [];

  // 1. WEIGHT xNxM scheme shorthand at start: "140 x5x5" or "140x5x5".
  //    Matches WEIGHT [unit] x N x M (e.g. "140 x5x5", "60kg x3x8").
  const schemeMatch = text.match(
    /^(\d+(?:\.\d+)?)\s*(?:kgs?|kg)?\s*[x×](\d+)[x×](\d+)(?:\s|$)/i,
  );
  if (schemeMatch) {
    const weight = roundNum(Number.parseFloat(schemeMatch[1]));
    const n = Number.parseInt(schemeMatch[2], 10); // number of sets
    const m = Number.parseInt(schemeMatch[3], 10); // reps per set
    return Array.from({ length: n }, () => ({
      weightKg: weight,
      reps: m,
      raw: `${schemeMatch[1]}x${schemeMatch[2]}x${schemeMatch[3]}`,
    }));
  }

  // 2. WEIGHT [unit] followed by a slash rep-list: "60kg 5/5/4".
  //    The weight must precede the slash-list (separated by space).
  const weightSlashMatch = text.match(
    /^(\d+(?:\.\d+)?)\s*(?:kgs?|kg)?\s+(\d+(?:\/\d+)+)(?:\s|$)/i,
  );
  if (weightSlashMatch) {
    const weight = roundNum(Number.parseFloat(weightSlashMatch[1]));
    const repParts = weightSlashMatch[2].split('/');
    return repParts.map((r) => ({
      weightKg: weight,
      reps: Number.parseInt(r, 10),
      raw: r,
    }));
  }

  // 3. Bare slash rep-list with NO leading weight: "12/10/8".
  //    Only matches when the very first token is digits/digits (no letters before).
  const bareSlashMatch = text.match(/^(\d+(?:\/\d+)+)(?:\s|$)/);
  if (bareSlashMatch && !looksLikeNumericDate(bareSlashMatch[1])) {
    const repParts = bareSlashMatch[1].split('/');
    return repParts.map((r) => ({
      weightKg: null,
      reps: Number.parseInt(r, 10),
      raw: r,
    }));
  }

  // 4-7. General token scanner: handles comma- AND space-separated tokens,
  //      including "100x5 102.5x5", "25 x12 x12 x15", "105x 5, 5, 5".
  return scanTokens(text);
}

/**
 * General token scanner. Splits on commas first, then within each comma-segment
 * further splits on spaces. Handles weight×rep, leading-x rep-only, and bare-rep tokens.
 */
function scanTokens(text: string): SetEntry[] {
  // Split on commas to get comma-segments; within each, split on whitespace.
  const commaParts = text
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const rawTokens: string[] = [];
  for (const part of commaParts) {
    // Bare rep numbers from comma lists ("20, 16, 12") stay whole tokens.
    if (/^\d+(?:\.\d+)?$/.test(part)) {
      rawTokens.push(part);
      continue;
    }
    // Within a comma segment, split further on spaces — but keep "105x 5" together.
    rawTokens.push(...tokenizePart(part));
  }

  const sets: SetEntry[] = [];
  let carriedWeight: number | null = null;

  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i];
    const t = token.trim();
    if (!t || /^\.{2,}$/.test(t) || /^…$/.test(t)) continue;

    const nextToken = rawTokens[i + 1]?.trim();
    if (
      nextToken &&
      /^[x×]/i.test(nextToken) &&
      /^\d+(?:\.\d+)?(?:\s*(?:kgs?|kg))?$/i.test(t)
    ) {
      const weightMatch = t.match(/^(\d+(?:\.\d+)?)/);
      if (weightMatch) carriedWeight = roundNum(Number.parseFloat(weightMatch[1]));
      continue;
    }

    const parsed = parseToken(t);
    if (!parsed) continue;
    if (parsed.reps === 0) {
      if (parsed.weightKg !== null) carriedWeight = parsed.weightKg;
      continue;
    }

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

/**
 * Tokenize a space-containing part (no commas) into individual set tokens.
 * Handles: "100x5 102.5x5 105x4", "25 x12 x12 x15", "70kg x 5", "105x 5".
 */
function tokenizePart(part: string): string[] {
  if (hasMultipleXRepTokens(part)) {
    const tokens: string[] = [];
    let remaining = part.trim();
    const weightCarrier = remaining.match(
      /^(\d+(?:\.\d+)?)\s*(?:kgs?|kg)(?=\s+[x×])|^(\d+(?:\.\d+)?)(?=\s+[x×])/i,
    );
    if (weightCarrier) {
      tokens.push(weightCarrier[0].trim());
      remaining = remaining.slice(weightCarrier[0].length).trim();
    }
    while (remaining.length > 0) {
      const leadingX = remaining.match(/^[x×]\s*(\d+(?:\.\d+)?)/i);
      if (!leadingX) break;
      tokens.push(leadingX[0].trim());
      remaining = remaining.slice(leadingX[0].length).trim();
    }
    return tokens;
  }

  const tokens: string[] = [];
  let remaining = part.trim();

  while (remaining.length > 0) {
    // Try to match a WEIGHT [unit] x REPS token (with optional spaces around x).
    // "105x 5", "70kg x 5", "100x5", "42.5 x6"
    const weightXReps = remaining.match(
      /^(\d+(?:\.\d+)?)\s*(?:kgs?|kg)?\s*[x×]\s*(\d+(?:\.\d+)?)/i,
    );
    if (weightXReps) {
      tokens.push(weightXReps[0].trim());
      remaining = remaining.slice(weightXReps[0].length).trim();
      continue;
    }

    // Leading-x rep token: "x12", "x 12" — no weight, just reps.
    const leadingX = remaining.match(/^[x×]\s*(\d+)/i);
    if (leadingX) {
      tokens.push(leadingX[0].trim());
      remaining = remaining.slice(leadingX[0].length).trim();
      continue;
    }

    // WEIGHT [unit] carrier, or bare weight before x-rep tokens ("25 x12").
    const weightOnly = remaining.match(
      /^(\d+(?:\.\d+)?)\s*(?:kgs?|kg)(?=\s)|^(\d+(?:\.\d+)?)(?=\s+[x×])/i,
    );
    if (weightOnly) {
      tokens.push(weightOnly[0].trim());
      remaining = remaining.slice(weightOnly[0].length).trim();
      continue;
    }

    break;
  }

  return tokens.filter((t) => t.length > 0);
}

function hasMultipleXRepTokens(part: string): boolean {
  if (/^\d+(?:\.\d+)?\s*(?:kgs?|kg)?\s*[x×]\d+[x×]\d+\b/i.test(part)) return false;
  const stripped = part
    .replace(/^(\d+(?:\.\d+)?)\s*(?:kgs?|kg)\s+/i, '')
    .replace(/^(\d+(?:\.\d+)?)\s+/, '');
  const xRepTokens = stripped.match(/(?:^|\s)[x×]\s*\d+(?:\.\d+)?/gi);
  return xRepTokens !== null && xRepTokens.length >= 2;
}

interface TokenResult {
  weightKg: number | null;
  reps: number;
  repsOnly: boolean;
}

/**
 * Parse one set token. Recognized shapes:
 *   105x5 | 105x 5 | 105 x 5 | 70kgx5 | 70kg x 5 | 30kgsx 5 | 42.5 x6 | 5 (reps only)
 *   x12 | x 12  (leading-x rep token, carries weight from caller)
 */
function parseToken(token: string): TokenResult | null {
  const t = token.trim().replace(/\.{2,}$|…$/g, '').trim();
  if (!t) return null;

  // Leading-x rep token: "x12", "x 12" — weight is null (reps-only, caller carries).
  const leadingX = t.match(/^[x×]\s*(\d+(?:\.\d+)?)$/i);
  if (leadingX) {
    return {
      weightKg: null,
      reps: Math.round(Number.parseFloat(leadingX[1])),
      repsOnly: true,
    };
  }

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

  // WEIGHT unit  (no rep marker, e.g. "60kg" standalone) -> treat as weight carrier (repsOnly=false, reps=0)
  // But we don't want to emit a 0-rep set; this is consumed by the tokenizer as a weight carrier.
  // For now, skip bare weight-only tokens (they'd produce reps=0).
  const weightOnly = t.match(/^(\d+(?:\.\d+)?)\s*(?:kgs?|kg)$/i);
  if (weightOnly) {
    // Return as a weight-carrying entry with reps=0 — caller will filter or treat as carrier.
    // Actually: these get emitted as 0-rep sets which we don't want. Instead, carry weight.
    // We'll emit it as a "weight set" with reps=0 and filter it out below.
    return {
      weightKg: roundNum(Number.parseFloat(weightOnly[1])),
      reps: 0,
      repsOnly: false,
    };
  }

  // reps-only token: bare number (not "87 kgs" or "26 Aug").
  const repsOnly = t.match(/^(\d+(?:\.\d+)?)(?!\s*(?:kgs?|kg)$)(?!\s+[a-z])/i);
  if (repsOnly) {
    return {
      weightKg: null,
      reps: Math.round(Number.parseFloat(repsOnly[1])),
      repsOnly: true,
    };
  }

  return null;
}

/** Two-part slash lists that look like DD/MM dates are not rep lists. */
function looksLikeNumericDate(slashText: string): boolean {
  const parts = slashText.split('/').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 2) return false;
  const [day, month] = parts;
  return day >= 1 && day <= 31 && month >= 1 && month <= 12;
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
