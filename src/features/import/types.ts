import type { ParsedWorkout } from '@/types/models';

/**
 * Route-state contract for the Import → Review handoff. Import builds this and
 * passes it via `navigate('/review', { state })`; Review reads it from
 * `useLocation().state`. Nothing here is persisted — it lives only in history
 * state until the user confirms on the Review screen.
 */
export interface ReviewRouteState {
  /** Workouts the parser kept (passed the relevance filter). */
  workouts: ParsedWorkout[];
  /** How many note segments were dropped as unrelated (for the collapsible peek). */
  skippedCount: number;
  /** Text of the dropped segments, so the user can peek / override. */
  skipped: string[];
  /** Parser warnings (low-confidence / unparsed inline entries). */
  warnings: string[];
  /** Where each kept workout came from, for context (e.g. "Screenshot 2"). */
  sourceLabels?: string[];
}

/** Discriminator stored in history state so Review can recognise our payload. */
export const REVIEW_STATE_TAG = 'replog:review' as const;
