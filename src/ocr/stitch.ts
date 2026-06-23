/**
 * Stitch OCR text from many frames of a scrolling screen recording into one
 * corpus (spec addendum A1, step 4). Consecutive frames overlap heavily — as the
 * user scrolls, the bottom of frame N reappears at the top of frame N+1 — so a
 * naive concatenation repeats most lines. We dedupe at the LINE level while
 * preserving first-seen order, which keeps each workout line exactly once in the
 * order it scrolled past.
 *
 * Why line-level (not a longest-common-substring merge): OCR is noisy and lines
 * reflow, so anchoring on whole, normalized lines is robust and cheap. A line is
 * "already seen" if a normalized form (collapsed whitespace, lowercased,
 * punctuation-trimmed) has appeared. Blank lines are preserved as soft
 * separators but never deduped against each other.
 */
export function stitchOcrText(fragments: string[]): string {
  const out: string[] = [];
  const seen = new Set<string>();
  let lastWasBlank = false;

  for (const fragment of fragments) {
    if (!fragment) continue;
    for (const rawLine of fragment.split(/\r?\n/)) {
      const line = rawLine.replace(/\s+$/, '');

      if (line.trim() === '') {
        // Collapse runs of blanks to a single separator; skip a leading blank.
        if (!lastWasBlank && out.length > 0) {
          out.push('');
          lastWasBlank = true;
        }
        continue;
      }

      const key = normalize(line);
      if (seen.has(key)) continue;

      seen.add(key);
      out.push(line.trim());
      lastWasBlank = false;
    }
  }

  // Drop any trailing separator.
  while (out.length > 0 && out[out.length - 1] === '') out.pop();

  return out.join('\n');
}

/** Normalize a line for dedup: lowercase, collapse whitespace, trim edge punctuation. */
function normalize(line: string): string {
  return line
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,:;–—-]+|[\s.,:;–—-]+$/g, '')
    .trim();
}
