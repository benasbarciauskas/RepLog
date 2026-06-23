/**
 * Brand color tokens for inline styles and SVG (mirrors mobile/tailwind.config.js).
 * NativeWind class names use the same hex values via Tailwind; use these when
 * a component cannot read CSS variables (e.g. react-native-svg stroke colours).
 */
export const brand = {
  background: '#0c0d0f',
  surface: '#151617',
  surfaceElevated: '#1e1f20',
  foreground: '#f4f5f6',
  mutedForeground: '#9d9ea2',
  border: 'rgba(255,255,255,0.09)',
  highlight: '#a2eb3c',
  highlightForeground: '#141609',
  highlightMuted: 'rgba(162,235,60,0.12)',
  /** Warm amber — watch / mid scores (mirrors web --warn on dark). */
  warn: '#e8b84a',
  /** Warm red — low scores and destructive states. */
  destructive: '#e85c4a',
} as const;

export type BrandColor = keyof typeof brand;