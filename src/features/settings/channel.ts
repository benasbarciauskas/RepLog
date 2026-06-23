/** Flip to true once the /RepLog/beta/ build is published. */
export const BETA_AVAILABLE = false;

/** Release channel the app is running as. */
export type Channel = 'stable' | 'beta' | 'local';

/** Public URLs for each hosted channel. */
export const CHANNEL_URLS = {
  stable: 'https://benasbarciauskas.github.io/RepLog/',
  beta: 'https://benasbarciauskas.github.io/RepLog/beta/',
} as const;

/**
 * Which build is running, derived from the Vite base path baked in at build
 * time: `/RepLog/` = Stable (the live release), `/RepLog/beta/` = Beta (the
 * preview build from the beta branch), anything else (e.g. `/` in dev) = a
 * local build. Pure + testable.
 */
export function detectChannel(baseUrl: string): Channel {
  if (baseUrl === '/RepLog/beta/') return 'beta';
  if (baseUrl === '/RepLog/') return 'stable';
  return 'local';
}
