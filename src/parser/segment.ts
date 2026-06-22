/**
 * Split a raw note into per-workout chunks.
 *
 * Heuristic: a new workout begins at a line that looks like a date/session
 * header — a "Workout from <date>" marker, or a line that starts with a date
 * (e.g. "13 Nov", "26 Aug 2024", "19 June"). Everything up to the next such
 * header belongs to the current chunk. If no headers are found, the whole note
 * is a single chunk.
 */
export function segmentWorkouts(rawText: string): string[] {
  const lines = rawText.split(/\r?\n/);
  const chunks: string[] = [];
  let current: string[] = [];

  const flush = () => {
    const text = current.join('\n').trim();
    if (text.length > 0) chunks.push(text);
    current = [];
  };

  for (const line of lines) {
    if (isSessionHeader(line) && current.some((l) => l.trim().length > 0)) {
      flush();
    }
    current.push(line);
  }
  flush();

  return chunks;
}

const MONTHS =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

// "Workout from ...", or a line that begins with a date.
const SESSION_MARKER = new RegExp(`^\\s*workout\\s+(?:from|on|of)\\b`, 'i');
// "13 Nov", "26 Aug 2024", "19 June 87ish kgs" — day then month at line start.
const DATE_DAY_MONTH = new RegExp(`^\\s*\\d{1,2}\\s*(?:st|nd|rd|th)?\\s+${MONTHS}\\b`, 'i');
// "Nov 13", "August 26 2024" — month then day at line start.
const DATE_MONTH_DAY = new RegExp(`^\\s*${MONTHS}\\s+\\d{1,2}\\b`, 'i');
// numeric dates "2024-08-26", "26/08/2024", "8/26"
const DATE_NUMERIC = /^\s*\d{1,4}[/.-]\d{1,2}(?:[/.-]\d{1,4})?\b/;

function isSessionHeader(line: string): boolean {
  return (
    SESSION_MARKER.test(line) ||
    DATE_DAY_MONTH.test(line) ||
    DATE_MONTH_DAY.test(line) ||
    DATE_NUMERIC.test(line)
  );
}
