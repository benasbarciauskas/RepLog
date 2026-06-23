# Parser dialect-widening — design spec (2026-06-23)

## What

The deterministic notes parser (`src/parser/*`) currently nails ONE note dialect
(`Exercise: weight x rep, rep`, `DD Mon YYYY` dates, `88ish kgs` bodyweight). A live
smoke test proved it drops data on common freeform variants. This widens the grammar to
cover four more forms WITHOUT regressing the existing dialect and WITHOUT any LLM.
Web-only; never touches `mobile/`.

Authoritative inputs that must now parse (from the smoke test that broke):

    mon 14/10 push day @ 88kg
    bench press 100x5 102.5x5 105x4
    ohp 60kg 5/5/4
    tri pushdown 25 x12 x12 x15

    wed legs
    squat 140 x5x5
    RDL 100kg x8 x8
    pullups 12/10/8

Expected: 2 workouts (push 14 Oct + legs), bodyweight 88 on the first, every exercise
captured with its sets/weights.

## Date order decision

Numeric dates are DD/MM (UK): `14/10` = 14 Oct, `5/4` = 5 Apr. When the first field is >12
it is unambiguous regardless. We add an explicit DD/MM path AHEAD of the chrono fallback.

## Changes by module

### 1. src/parser/fields.ts — extractDate
Add an explicit numeric-date path, tried BEFORE the chrono fallback so DD/MM order wins:
- Match optional leading weekday + `DD/MM`, `DD/MM/YY`, `DD/MM/YYYY` (separators / . -),
  e.g. `mon 14/10`, `14/10/24`, `14-10-2024`, `Wed 5/4`.
- Interpret as day/month (UK). Validate ranges (day 1-31, month 1-12); if it does not
  validate as DD/MM, fall through to chrono (never silently mis-date).
- Year: from matched 2/4-digit year (2-digit -> 20YY); else yearHint; else current year.
  The current year is passed IN by the caller — extractDate stays pure, never calls
  new Date()/Date.now() for "now". See "Purity".
- Confidence: explicit year present -> high; year inferred -> low (UI treats low as
  "review"). Do NOT widen the 'high' | 'low' type.
- Keep the existing chrono path (so `26 Aug 2024`, `19 June`, `Nov 13` still parse).

### 2. src/parser/segment.ts — isSessionHeader
Today a new session only starts on a digit-leading date or `Workout from...`, so a
weekday-led header (`mon 14/10`) and a bare `wed legs` are not split -> the second session
is swallowed. Add:
- Optional leading weekday (mon|tue|wed|thu|fri|sat|sun, full or abbreviated, optional
  trailing comma) in front of the existing DATE_* patterns.
- A WEEKDAY-led header: a line starting with a weekday token (optionally followed by a
  split word / date), e.g. `wed legs`, `Monday push`. Guard: only when the weekday is at
  line start AND the line is NOT itself a set/exercise line — avoids false splits on prose.

### 3. src/parser/exerciseLine.ts — set tokenizer (parseSets / parseToken)
The core fix. parseSets currently splits set-text on COMMAS only, and parseToken only
understands WEIGHTxREPS and bare reps. Replace comma-splitting with a token scanner that
recognizes, anywhere in the set-text (comma- OR space-separated):
- `WEIGHT[unit] x REPS` (spaces flexible): `100x5`, `105x 5`, `70kg x 5`, `25 x12`.
  Multiple space-separated such tokens -> multiple sets: `100x5 102.5x5 105x4` -> 3 sets.
- Slash rep-list after a leading weight: `60kg 5/5/4` -> 3 sets of 60kg x5,x5,x4;
  bodyweight `12/10/8` (no weight) -> 3 reps-only sets x12,x10,x8.
- WEIGHT SCHEME shorthand `140 x5x5` (and `squat 140 x5x5`) -> weight 140, scheme 5x5 =
  5 sets of 5 reps at 140. (NxM after a weight = N sets of M reps.)
- Bare reps-only number (carried weight) — unchanged; keeps `105x 5, 5, 5` working.
Carried-weight semantics preserved: a reps-only / rep-list token with no weight inherits
the previous token's weight (today's behaviour for `105x5, 5, 5`).

Disambiguation (slash rep-list `5/5/4` vs date `14/10`): the slash form is parsed ONLY
inside parseSets, which runs only after a line is split into a name (with letters) +
set-text. A bare `14/10` header has no exercise name, so never reaches the set tokenizer.
Dates match only at header/line-start (sec 1/2). No overlap.

### 4. src/parser/fields.ts — extractBodyweight
Add the @-prefixed form: `@ 88kg`, `@88`, `@ 90.5 kg` -> 88 / 88 / 90.5. Keep all existing
forms (`88ish kgs`, `BW 84kg`, `weight: 90`). Constrain to 2-3 digit values so it does not
grab a set weight.

## Purity / "now"
extractDate stays deterministic. The current-year fallback for a yearless numeric date
needs A year but must not read the clock. Thread it in: add an optional nowYear (or extend
yearHint); parseNotes passes the real current year, sourced ONCE at the call boundary (the
UI/hook layer), not inside the parser. Tests pass an explicit year and assert deterministically.

## Testing (TDD — tests first)
- New fixtures in src/parser/__tests__/fixtures/notes.ts per dialect; new cases in
  parseNotes.test.ts, exerciseLine.test.ts, fields.test.ts, segment.test.ts.
- Boundary/disambiguation: `5/5/4` reps vs `14/10` date on different lines; `140 x5x5`
  scheme; `@88` vs a set weight; DD/MM where day>12 and where ambiguous (`5/4`).
- Regression gate: EVERY existing parser test stays green. MULTI_SESSION_NOTE still yields
  its current 4-workout result unchanged.
- Re-run the two smoke notes: messy one now yields 2 workouts + all exercises; designed one
  unchanged.

## Out of scope
OCR engine swap, any LLM / in-browser model, mobile parser, the cloud BYO-key path.
