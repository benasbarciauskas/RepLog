import { lbToKg } from '@/lib/units';

export interface TokenResult {
  weightKg: number | null;
  /** null = AMRAP / unspecified reps; 0 = weight CARRIER (emits no set). */
  reps: number | null;
  repsOnly: boolean;
  /** true for an AMRAP / to-failure set (reps null in output). */
  isAmrap?: boolean;
  /** captured rate of perceived exertion (6–10), if a trailing @RPE was present. */
  rpe?: number;
}

/** Strip a trailing RPE marker ("@8", "@ rpe 8", "@RPE8") and return it. */
export function extractRpe(token: string): { rest: string; rpe?: number } {
  // RPE is `@` + a 1–2 digit value that is NOT a plausible bar weight. Real RPE
  // is 1–10; a `@ 100` is a WEIGHT, not RPE. Disambiguate by magnitude: only
  // `@N` with N <= 10 (optionally `@rpe N`) is treated as RPE here.
  const m = token.match(/\s*@\s*(?:rpe\s*)?(\d{1,2}(?:\.\d)?)\s*$/i);
  if (!m) return { rest: token };
  const val = Number.parseFloat(m[1]);
  // An explicit `@rpe N` is always RPE; a bare `@N` only when N <= 10.
  const explicit = /@\s*rpe/i.test(m[0]);
  if (!explicit && val > 10) return { rest: token };
  return { rest: token.slice(0, m.index).trim(), rpe: val };
}

/**
 * Parse one set token. Recognized shapes:
 *   105x5 | 105x 5 | 105 x 5 | 70kgx5 | 70kg x 5 | 30kgsx 5 | 42.5 x6 | 5 (reps only)
 *   x12 | x 12  (leading-x rep token, carries weight from caller)
 *   225lb x 5 (lb -> kg) | 100x8-10 (rep range -> top) | 100x amrap / 100xF (AMRAP)
 *   100 for 8 / 100kg for 8 reps (weight-for-reps) | 8 reps x 100 / 8 @ 100 (reps-first)
 *   105x5 @8 / @RPE8 (trailing RPE captured)
 */
export function parseToken(token: string): TokenResult | null {
  let t = token.trim().replace(/\.{2,}$|…$/g, '').trim();
  if (!t) return null;

  // Peel off a trailing RPE ("@8", "@RPE8") so it never breaks the set parse.
  const { rest, rpe } = extractRpe(t);
  t = rest;
  if (!t) return null;

  // Leading-x rep token: "x12", "x 12" — weight is null (reps-only, caller carries).
  const leadingX = t.match(/^[x×]\s*(\d+(?:\.\d+)?)$/i);
  if (leadingX) {
    return {
      weightKg: null,
      reps: Math.round(Number.parseFloat(leadingX[1])),
      repsOnly: true,
      rpe,
    };
  }

  // WEIGHT [unit] x AMRAP / x F: "100x amrap", "100 x AMRAP", "100xF" -> reps null.
  const amrap = t.match(
    /^(\d+(?:\.\d+)?)\s*(kgs?|kg|lbs?|lb)?\s*[x×]\s*(?:amrap|max|f)$/i,
  );
  if (amrap) {
    return {
      weightKg: weightToKg(amrap[1], amrap[2]),
      reps: null,
      repsOnly: false,
      isAmrap: true,
      rpe,
    };
  }

  // WEIGHT [unit] x REPS, with optional rep RANGE ("100x8-10" -> top 10) and
  // lb -> kg conversion. (x may be x or ×; unit kg/kgs/lb/lbs optional.)
  const withWeight = t.match(
    /^(\d+(?:\.\d+)?)\s*(kgs?|kg|lbs?|lb)?\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?$/i,
  );
  if (withWeight) {
    const top = withWeight[4] ?? withWeight[3]; // top of a rep range
    return {
      weightKg: weightToKg(withWeight[1], withWeight[2]),
      reps: Math.round(Number.parseFloat(top)),
      repsOnly: false,
      rpe,
    };
  }

  // WEIGHT [unit] for REPS [reps]: "100 for 5", "100kg for 8 reps".
  const weightForReps = t.match(
    /^(\d+(?:\.\d+)?)\s*(kgs?|kg|lbs?|lb)?\s+for\s+(\d+(?:\.\d+)?)(?:\s*reps?)?$/i,
  );
  if (weightForReps) {
    return {
      weightKg: weightToKg(weightForReps[1], weightForReps[2]),
      reps: Math.round(Number.parseFloat(weightForReps[3])),
      repsOnly: false,
      rpe,
    };
  }

  // REPS-first: "8 reps x 100kg", "8 @ 100kg", "5 reps @ 100" -> reps then weight.
  const repsFirst = t.match(
    /^(\d+(?:\.\d+)?)\s*(?:reps?)?\s*[x×@]\s*(\d+(?:\.\d+)?)\s*(kgs?|kg|lbs?|lb)?$/i,
  );
  if (repsFirst && /reps?|@/i.test(t)) {
    return {
      weightKg: weightToKg(repsFirst[2], repsFirst[3]),
      reps: Math.round(Number.parseFloat(repsFirst[1])),
      repsOnly: false,
      rpe,
    };
  }

  // WEIGHT unit, no rep marker (e.g. a standalone "60kg"): a weight CARRIER, not
  // a set. Contract: reps=0 signals "no set here, just a weight to carry forward".
  // scanTokens treats any reps===0 result as a carrier (sets carriedWeight, emits
  // no set), so this never produces a 0-rep set in the output.
  const weightOnly = t.match(/^(\d+(?:\.\d+)?)\s*(?:kgs?|kg|lbs?|lb)$/i);
  if (weightOnly) {
    const unit = t.match(/(kgs?|kg|lbs?|lb)$/i)?.[1];
    return {
      weightKg: weightToKg(weightOnly[1], unit),
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
      rpe,
    };
  }

  return null;
}

export function roundNum(n: number): number {
  // keep one decimal of precision where present, else integer
  return Math.round(n * 100) / 100;
}

/**
 * Convert a numeric weight string to kilograms, honoring an optional unit.
 * lb / lbs converts via the shared lbToKg helper; kg / kgs / no unit pass
 * through. Result keeps two decimals of precision (roundNum).
 */
export function weightToKg(value: string, unit?: string | null): number {
  const n = Number.parseFloat(value);
  if (unit && /^lbs?$/i.test(unit.trim())) return roundNum(lbToKg(n));
  return roundNum(n);
}

/**
 * Tokenize a space-containing part (no commas) into individual set tokens.
 * Handles: "100x5 102.5x5 105x4", "25 x12 x12 x15", "70kg x 5", "105x 5".
 */
export function tokenizePart(part: string): string[] {
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
    // "105x 5", "70kg x 5", "100x5", "42.5 x6", "225lb x 5", rep-range "100x8-10",
    // and AMRAP "100x amrap" / "100xF" — all kept as one token for parseToken.
    const weightXReps = remaining.match(
      /^(\d+(?:\.\d+)?)\s*(?:kgs?|kg|lbs?|lb)?\s*[x×]\s*(?:amrap|max|f\b|\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)/i,
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
