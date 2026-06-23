# Strength-ratio standards (verified) — coach engine reference

Source: research pass 2026-06-22, triangulated across T-Nation 4:3:2:1, StrengthLevel, StrengthLog
(200k users), Jeff Nippard / Stronger By Science, Poliquin/Thibaudeau "Know Your Ratios", Christian
Bosse, NSCA/PMC (H:Q). ExRx publishes bodyweight-multiple tables but no inter-lift ratio rule.

All ratios are **numerator 1RM / denominator 1RM** (unit-free → kg/lb irrelevant). Use **estimated
1RM** (Epley) from best sets when a true 1RM isn't logged.

## Default bands to hardcode in `src/coach/ratios.ts`

| ruleId | numerator / denominator | band [min,max] | confidence | low value → underdeveloped |
|---|---|---|---|---|
| `ohp-bench`     | overhead-press / barbell-bench-press | [0.60, 0.67] | **high** | front-delts (+ overhead triceps) |
| `row-bench`     | barbell-row / barbell-bench-press    | [0.75, 0.90] | med (soft) | upper-back, lats |
| `squat-bench`   | back-squat / barbell-bench-press     | [1.30, 1.50] | **high** | quads, glutes |
| `deadlift-squat`| deadlift / back-squat                | [1.15, 1.25] | med-high | hamstrings, glutes, lower-back |
| `pullup-bench`  | weighted-pull-up(total) / barbell-bench-press | [0.90, 1.20] | low (advisory) | lats, biceps |
| `incline-flat`  | incline-bench / barbell-bench-press  | [0.80, 0.90] | med | chest (upper) |
| `frontsquat-backsquat` | front-squat / back-squat      | [0.80, 0.90] | **high** | quads, upper-back, abs |

## Severity rules (apply in `analyzeImbalances`)

- Compute `ratio = num.bestE1rmKg / den.bestE1rmKg`. Skip the rule entirely if either lift has no best (never fabricate).
- `ratio >= min` → **ok** (in/above band).
- `min*0.92 <= ratio < min` → **flag**.
- `ratio < min*0.92` → **priority**.
- **Confidence gating:** only `ohp-bench`, `squat-bench`, `frontsquat-backsquat` (high) may render as **priority**. Med/low rules cap at **flag** and use hedged wording ("may be", "consider"). `deadlift-squat` gets a special red flag only when `ratio < 1.0` (deadlift below squat).
- Message must name both lifts + the actual numbers, e.g. *"You bench 140kg but only overhead press 60kg (0.43, healthy ≥0.60) → front delts likely lagging."*

## Antagonist / volume guidance (not 1RM ratios — for `muscleCoverage` / future volume view)

- Hamstring:Quad ~ [0.60, 0.80]; flag < 0.60 (injury-risk heuristic, not diagnosis).
- Push:Pull volume — pull should be ≥ push; flag when push working-set volume > pull. Don't hardcode biceps:triceps.

## Caveats to surface in UI

- Row type matters (strict Pendlay reads low ~0.70, bounced barbell row high ~0.86) — soft-flag only.
- Pull-up/bench is least standardized — advisory wording.
- Deadlift/squat is body-proportion sensitive — soft-warn except the <1.0 red flag.
- Compare consistent squat style (high-bar vs low-bar shifts the denominator).
