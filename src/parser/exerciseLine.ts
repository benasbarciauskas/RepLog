import type { ExerciseDef, SetEntry, WorkoutExercise } from '@/types/models';
import { parseToken, roundNum, tokenizePart, weightToKg } from './setToken';
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
  return stripBodyweightMarker(name.replace(/\s+\d+\s*[x×]\s*\d+\s*$/i, '').trim());
}

/**
 * Drop a trailing added-weight marker from a name segment so inline bodyweight
 * moves resolve: "pull ups +" -> "pull ups", "dips bw+" -> "dips", "dips bw +".
 * The numeric weight that followed the marker is set data and was already split
 * off as setText by splitNameAndSets; only the dangling "bw"/"+" remains here.
 */
function stripBodyweightMarker(name: string): string {
  return name.replace(/\s*(?:\bbw\b)?\s*\+\s*$/i, '').trim();
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

  // 0. SETS x REPS @ WEIGHT scheme: "5x5 @ 100", "3 x 8 @ 100kg".
  //    Distinguished from the WEIGHT xNxM scheme (1, below) by the trailing
  //    `@ WEIGHT`: the `@` makes the leading number the SET COUNT, the second
  //    the reps, and the post-`@` number the weight. lb/lbs converts to kg.
  const setsRepsAtWeight = text.match(
    /^(\d+)\s*[x×]\s*(\d+)\s*@\s*(\d+(?:\.\d+)?)\s*(kgs?|kg|lbs?|lb)?\s*$/i,
  );
  if (setsRepsAtWeight) {
    const n = Number.parseInt(setsRepsAtWeight[1], 10); // number of sets
    const m = Number.parseInt(setsRepsAtWeight[2], 10); // reps per set
    const weight = weightToKg(setsRepsAtWeight[3], setsRepsAtWeight[4]);
    return Array.from({ length: n }, () => ({
      weightKg: weight,
      reps: m,
      raw: `${setsRepsAtWeight[1]}x${setsRepsAtWeight[2]} @ ${setsRepsAtWeight[3]}`,
    }));
  }

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

  // 1b. Slash / comma DROP-WEIGHTS followed by `x REPS`: "100/90/80 x 5",
  //     "100,90,80 x 5" = descending weights, each performed for the shared reps
  //     after the `x`. This is distinct from a standalone slash rep-list
  //     ("12/10/8" -> reps, format 3 below): the trailing `x N` is the signal
  //     that the group is WEIGHTS, not reps. Checked BEFORE the slash rep-list
  //     and the comma token scanner so the trailing `x N` is honored.
  const dropWeightsX = text.match(
    /^(\d+(?:\.\d+)?(?:\s*[/,]\s*\d+(?:\.\d+)?)+)\s*(?:kgs?|kg|lbs?|lb)?\s*[x×]\s*(\d+)\s*$/i,
  );
  if (dropWeightsX) {
    const unit = /lbs?\b/i.test(text) ? 'lb' : 'kg';
    const reps = Number.parseInt(dropWeightsX[2], 10);
    const weights = dropWeightsX[1].split(/[/,]/).map((w) => w.trim());
    return weights.map((w) => ({
      weightKg: weightToKg(w, unit),
      reps,
      raw: `${w} x ${reps}`,
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

  // 3. Bare slash rep-list with NO leading weight: "12/10/8" or "12/10".
  //    Only matches when the very first token is digits/digits (no letters before).
  //    NO date guard here: parseSets only ever receives set-text from a line that
  //    already has an exercise name, so a bare "12/10" here is a 2-set rep-list,
  //    never a DD/MM date. Date headers carry no name and are matched at
  //    line-start in segment.ts / fields.ts before they reach this tokenizer.
  const bareSlashMatch = text.match(/^(\d+(?:\/\d+)+)(?:\s|$)/);
  if (bareSlashMatch) {
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
    // Multi-word "rich" forms ("100kg for 8 reps", "8 reps x 100kg", "100x5 @8",
    // "100 x AMRAP") must stay a single token so parseToken sees the whole phrase
    // — space-splitting would shatter them. A part parseToken recognizes whole is
    // kept intact; otherwise fall back to the space tokenizer ("25 x12 x15").
    if (isRichToken(part)) {
      rawTokens.push(part);
      continue;
    }
    // Within a comma segment, split further on spaces — but keep "105x 5" together.
    rawTokens.push(...tokenizePart(part));
  }

  const sets: SetEntry[] = [];
  let carriedWeight: number | null = null;
  let carriedReps: number | null = null;

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

    // DROP-WEIGHT bare number after a weighted set context: a trailing bare value
    // ("100x5, 90, 80") is a descending DROP WEIGHT (reps inherited), NOT reps,
    // when it is plausibly a weight rather than a rep count. Heuristic: the value
    // is > 20 (above any realistic rep count) AND <= the carried weight (a drop
    // descends). This keeps "125x5, 120x5, 5" — small trailing reps — as reps.
    if (
      /^\d+(?:\.\d+)?$/.test(t) &&
      carriedWeight !== null &&
      carriedReps !== null
    ) {
      const val = roundNum(Number.parseFloat(t));
      if (val > 20 && val <= carriedWeight) {
        carriedWeight = val;
        sets.push({ weightKg: val, reps: carriedReps, raw: token });
        continue;
      }
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
    if (parsed.reps !== null) carriedReps = parsed.reps;

    const set: SetEntry = {
      weightKg: weight,
      reps: parsed.isAmrap ? (null as unknown as number) : (parsed.reps as number),
      raw: token,
    };
    if (parsed.rpe !== undefined) set.rpe = parsed.rpe;
    sets.push(set);
  }

  return sets;
}

/**
 * Does parseToken recognize this whole space-containing part as ONE set? Used so
 * multi-word forms ("100kg for 8", "8 reps x 100", "100x5 @8") are kept intact
 * rather than space-split. A part with no spaces is left to the normal path.
 */
function isRichToken(part: string): boolean {
  const p = part.trim();
  if (!/\s/.test(p)) return false;
  // Only the genuinely multi-word dialects belong here: "WEIGHT for REPS",
  // "REPS reps x/@ WEIGHT", "N @ WEIGHT", trailing "@RPE", or "x AMRAP". A plain
  // space-separated multi-token part ("100x5 102.5x5", "25 x12 x12") must NOT be
  // captured — it is space-tokenized as several sets instead.
  const richForms = [
    /^\d+(?:\.\d+)?\s*(?:kgs?|kg|lbs?|lb)?\s+for\s+\d+/i, // weight for reps
    /^\d+(?:\.\d+)?\s+reps?\s*[x×@]\s*\d+/i, // "8 reps x/@ 100"
    /^\d+(?:\.\d+)?\s*@\s*\d+/i, // reps-first "8 @ 100"
    /[x×]\s*(?:amrap|max|f)\b/i, // AMRAP / to-failure
    /@\s*(?:rpe\s*)?\d/i, // trailing RPE
  ];
  if (!richForms.some((re) => re.test(p))) return false;
  const parsed = parseToken(p);
  return parsed !== null && parsed.reps !== 0;
}

/**
 * Does this comma-segment consist ENTIRELY of recognized set tokens (plus an
 * optional leading exercise name on the first segment), with no leftover
 * alphabetic remainder?
 *
 * Used by parseNotes.collectInlineRemainders to decide whether a comma-segment
 * is fully accounted for by the set tokenizer (so it must NOT be flagged) or
 * carries an un-captured inline secondary exercise like "then archers x 10"
 * (which MUST be flagged). Reuses the SAME token recognizers as parseSets /
 * tokenizePart so there is a single grammar, never a second narrower one.
 *
 * @param segment   one comma-segment of set-text
 * @param allowName when true, a leading exercise-name prefix (letters before the
 *                  first digit, as splitNameAndSets would strip) is allowed and
 *                  ignored — used for the first segment of a no-colon line.
 */
export function isFullySetTokens(segment: string, allowName: boolean): boolean {
  let text = segment.replace(/\.{2,}|…/g, '').trim();
  if (!text) return true; // empty segment = nothing to flag

  // A pure bare-rep segment ("12", "12.5") is set data.
  if (/^\d+(?:\.\d+)?$/.test(text)) return true;

  // Optionally strip a leading exercise name (letters before the first digit),
  // mirroring splitNameAndSets for a no-colon line's first segment.
  if (allowName) {
    const firstDigit = text.search(/\d/);
    if (firstDigit > 0) {
      const namePart = text.slice(0, firstDigit);
      // Only treat it as a name if it is purely name-like (letters/spaces/.-'/),
      // not e.g. an "x12" leading-x token.
      if (/^[a-z][a-z\s.'/-]*$/i.test(namePart)) {
        text = text.slice(firstDigit).trim();
      }
    } else if (firstDigit === -1) {
      // No digits at all — pure alpha (e.g. "then archers"): an unparsed remainder.
      return false;
    }
  }

  // Whole-segment forms parseSets matches at the start (scheme / slash lists).
  if (
    /^(\d+(?:\.\d+)?)\s*(?:kgs?|kg)?\s*[x×]\d+[x×]\d+(?:\s|$)/i.test(text) ||
    /^(\d+(?:\.\d+)?)\s*(?:kgs?|kg)?\s+\d+(?:\/\d+)+(?:\s|$)/i.test(text) ||
    /^\d+(?:\/\d+)+(?:\s|$)/.test(text)
  ) {
    // These consume the whole token; treat remainder (if any) by re-checking below
    // is overkill — the regexes above anchor on the leading run, and a trailing
    // remainder after a slash/scheme list is not a real-world dialect. Accept.
    return true;
  }

  // Otherwise, repeatedly consume known per-token forms (the same ones the
  // tokenizer's tokenizePart / parseToken understand). If we consume the whole
  // string, it's all set tokens; if an alphabetic remainder is left, flag it.
  let remaining = text;
  // optional leading weight carrier ("25 x12", "100kg x8")
  const carrier = remaining.match(
    /^(\d+(?:\.\d+)?)\s*(?:kgs?|kg)(?=\s)|^(\d+(?:\.\d+)?)(?=\s+[x×])/i,
  );
  if (carrier) remaining = remaining.slice(carrier[0].length).trim();

  while (remaining.length > 0) {
    // WEIGHT [unit] x REPS  ("105x5", "70kg x 5", "42.5 x6", "105x 5")
    const weightXReps = remaining.match(
      /^(\d+(?:\.\d+)?)\s*(?:kgs?|kg)?\s*[x×]\s*(\d+(?:\.\d+)?)/i,
    );
    if (weightXReps) {
      remaining = remaining.slice(weightXReps[0].length).trim();
      continue;
    }
    // leading-x rep token ("x12", "x 12")
    const leadingX = remaining.match(/^[x×]\s*(\d+(?:\.\d+)?)/i);
    if (leadingX) {
      remaining = remaining.slice(leadingX[0].length).trim();
      continue;
    }
    // bare weight-only / bare reps ("60kg", "12")
    const bare = remaining.match(/^(\d+(?:\.\d+)?)\s*(?:kgs?|kg)?(?=\s|$)/i);
    if (bare && bare[0].length > 0) {
      remaining = remaining.slice(bare[0].length).trim();
      continue;
    }
    break;
  }

  // Fully consumed, or only non-alphabetic noise left → all set tokens.
  return !/[a-z]/i.test(remaining);
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
