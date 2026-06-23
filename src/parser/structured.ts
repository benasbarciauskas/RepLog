const SET_ROW =
  /^\s*(?:\d{1,3}\s+)?(\d+(?:\.\d+)?)\s*(kgs?|kg|lbs?|lb)?\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s+\d+(?:\.\d+)?)?\s*$/i;

const INLINE_EXERCISE_AFTER_COLON =
  /\d+(?:\.\d+)?\s*(?:kgs?|kg|lbs?|lb)?\s*[x×]\s*\d+(?:\.\d+)?/i;

/**
 * Rewrite multi-line "set list" workout exports into inline `Name: sets` lines
 * that the existing parser already understands. All other lines pass through
 * unchanged.
 */
export function preprocessStructured(rawText: string): string {
  const lines = rawText.split(/\r?\n/);
  const out: string[] = [];

  let pendingName: string | null = null;
  let pendingSets: string[] = [];

  const flush = () => {
    if (pendingName !== null) {
      if (pendingSets.length > 0) {
        out.push(`${pendingName}: ${pendingSets.join(', ')}`);
      } else {
        out.push(pendingName);
      }
      pendingName = null;
      pendingSets = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine; // preserve original spacing for verbatim passthrough

    if (isSetRow(line)) {
      pendingSets.push(buildSetToken(line));
      continue;
    }

    if (isNameHeader(line)) {
      flush();
      pendingName = cleanNameHeader(line);
      pendingSets = [];
      continue;
    }

    flush();
    out.push(line);
  }

  flush();
  return out.join('\n');
}

function isSetRow(line: string): boolean {
  const trimmed = line.trim();
  const m = trimmed.match(SET_ROW);
  if (!m) return false;
  const weightStart = trimmed.indexOf(m[1]);
  if (weightStart < 0) return false;
  // No alphabetic characters before the weight (units/1RM after it are fine).
  return !/[a-z]/i.test(trimmed.slice(0, weightStart));
}

function buildSetToken(line: string): string {
  const m = line.trim().match(SET_ROW)!;
  const weight = m[1];
  const unit = m[2];
  const reps = m[3];
  const unitStr = unit ? ` ${normalizeUnit(unit)}` : ' kg';
  return `${weight}${unitStr} x ${reps}`;
}

function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase();
  if (u === 'kgs' || u === 'kg') return 'kg';
  if (u === 'lbs' || u === 'lb') return 'lb';
  return unit;
}

function isNameHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (isSetRow(line)) return false;
  if (!/[a-z]/i.test(trimmed)) return false;
  if (isMetadataLine(trimmed)) return false;
  if (isInlineExerciseLine(trimmed)) return false;
  return true;
}

function isInlineExerciseLine(line: string): boolean {
  const colon = line.indexOf(':');
  if (colon === -1) return false;
  const after = line.slice(colon + 1).trim();
  return INLINE_EXERCISE_AFTER_COLON.test(after);
}

function isMetadataLine(line: string): boolean {
  if (/^\d{1,2}:\d{2}\b/.test(line)) return true;
  if (/^\d+\s*m\s+\d+/i.test(line)) return true;
  return false;
}

function cleanNameHeader(line: string): string {
  return line
    .trim()
    .replace(/\s+1\s*rm\s*$/i, '')
    .trim();
}