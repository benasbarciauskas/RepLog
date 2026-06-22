# RepLog Design System

The visual contract for RepLog. Page agents (Wave 2b) build on top of this — keep
everything consistent with the tokens, type scale, motion language, and primitives
below. Vibe: **athletic, data-forward, premium, dark-first.** Linear-grade cleanliness
with energy. PRs / 1RMs / weights are the heroes.

## Principles

- **Dark-first and theme-locked.** `<html class="dark">` plus `next-themes`
  `forcedTheme="dark"`. Do not build a light/dark toggle or invert sections. The
  `.light` token block exists only for shadcn parity.
- **One accent, used sparingly.** The acid-lime `highlight` is for PRs, the active
  nav item, primary emphasis, and chart series. Never paint whole surfaces with it.
- **Numbers are the heroes.** Weights, 1RMs, and PRs render big in tabular figures.
- **Mobile-first, fully responsive.** Bottom tab bar on mobile, left sidebar at `md+`.
- **Reduced motion is respected everywhere.** Movement is opt-out; information never is.

## Color tokens

Defined in `src/index.css` as CSS variables, surfaced through Tailwind v4 `@theme`.
Use the Tailwind utility names (right column) in app code.

| Token (`--*`)          | Tailwind utility            | Role |
| ---------------------- | --------------------------- | ---- |
| `background`           | `bg-background`             | App backdrop (near-black, not pure `#000`) |
| `foreground`           | `text-foreground`          | Primary text |
| `surface`              | `bg-surface`               | Sidebar / bars / subtle panels above bg |
| `surface-elevated`     | `bg-surface-elevated`      | Hover / raised panels above cards |
| `card` / `card-foreground` | `bg-card` / `text-card-foreground` | Card surface (shadcn `<Card>`) |
| `muted-foreground`     | `text-muted-foreground`    | Secondary / hint text |
| `border`               | `border-border`            | Hairlines, dividers |
| **`highlight`**        | `bg-highlight` / `text-highlight` | **THE accent — acid lime.** PRs, active nav, emphasis |
| `highlight-foreground` | `text-highlight-foreground` | Text on a lime fill |
| `highlight-muted`      | `bg-highlight-muted`       | 12%-alpha lime wash (icon badges, active pills) |
| `success`              | `text-success`             | Positive / in-band states |
| `warn`                 | `text-warn`                | Caution / low-confidence flags |
| `destructive`          | `text-destructive`         | Errors / over-limit |
| `chart-1..5`           | via chart config           | Chart series (chart-1 = lime) |

Plus standard shadcn tokens (`primary`, `secondary`, `accent`, `popover`, `ring`,
`input`) for the `ui/*` components. `ring` is the lime so focus states stay on-brand.

## Type scale

- Body / UI: `--font-sans` (Inter / system grotesk). Headings use
  `tracking-tight` + `font-semibold`.
- Numbers: `--font-mono` is available, but the hero number style is the **`.tnum`**
  utility — tabular figures + tight tracking so columns of weights line up and the
  count-up never reflows. Always put `.tnum` on a displayed weight/rep/1RM.
- Display sizes (utilities, line-height baked in):
  `text-display-sm` (30px) · `text-display-md` (44px) · `text-display-lg` (64px) ·
  `text-display-xl` (84px). Use `display-sm`/`display-md` in `StatCard`; reach for
  `display-lg`/`xl` for a single page-hero number.

## Spacing & shape

- Radius scale from `--radius: 0.75rem` → `rounded-sm/md/lg/xl`. Cards use `rounded-xl`.
  Keep ONE radius family; don't mix sharp and pill on the same surface.
- Page content is capped at `max-w-5xl`, padded `px-4 sm:px-6`, with `pb-24` on mobile
  to clear the bottom tab bar (the shell handles this — pages just render their content).
- Generous vertical rhythm: `PageHeader` ships `mb-8`; group stat grids with `gap-4`.

## Motion language

Custom easing curves live as tokens; in JS use the cubic array `[0.23, 1, 0.32, 1]`
(strong ease-out) for UI enters. Rules (from Emil Kowalski's framework):

- **Motivated only.** Animate for hierarchy, feedback, state, or spatial continuity —
  never decoration on something seen 100×/day.
- **Fast.** UI transitions stay under ~300ms. Press feedback 100–160ms.
- **Enter = ease-out**, never ease-in. Never animate from `scale(0)` — start at `0.95`.
- **Reduced motion:** every animated primitive checks `useReducedMotion()` and degrades
  to instant / opacity-only. There is also a CSS backstop in `index.css`.
- Route transitions: `PageTransition` + `<AnimatePresence mode="wait">` (already wired
  in the shell). Card grids should stagger reveals 30–80ms apart (`whileInView`).

## Shared primitives (`src/components/`)

All are typed, reusable, and reduced-motion safe. Import paths use the `@/` alias.

### `AnimatedNumber` — `@/components/AnimatedNumber`
Count-up number; snaps to final value under reduced motion.
```ts
{ value: number; decimals?: number; prefix?: string; suffix?: string;
  duration?: number; animateOnView?: boolean; className?: string }
```
`<AnimatedNumber value={140} suffix=" kg" />`

### `StatCard` — `@/components/StatCard`
The dashboard hero unit: a big `.tnum` number with a label and hint.
```ts
{ label: string; value?: number; decimals?: number; suffix?: string;
  display?: ReactNode;            // alternative hero content, e.g. "BW"
  hint?: string;                  // date / context line
  icon?: ComponentType<LucideProps>;
  tone?: 'default' | 'highlight'; // 'highlight' paints the number lime — use for PRs
  interactive?: boolean;          // hover lift
  onClick?: () => void;           // becomes a button (e.g. open the exercise page)
  className?: string }
```
Use `tone="highlight"` for personal records. Provide either `value` (animates) or
`display` (static content like "BW").

### `EmptyState` — `@/components/EmptyState`
Framed-icon empty / "not enough data" view with optional CTA.
```ts
{ icon?: ComponentType<LucideProps>; title: string; description?: string;
  action?: ReactNode; className?: string }
```

### `PageHeader` — `@/components/PageHeader`
Standard page heading. Every page starts with one.
```ts
{ eyebrow?: string; title: string; description?: string;
  actions?: ReactNode; className?: string }
```

### `PageTransition` — `@/components/PageTransition`
Route enter/exit wrapper. Already mounted by the shell — pages do not need it.

### Charts — `@/components/charts/LineChartCard` and `AreaChartCard`
Themed recharts v3 wrappers built on the shadcn chart primitives; colors come from
the tokens (default series = lime). Generic over the row type.
```ts
// LineChartCard — progression / e1rm over time
{ title: string; description?: string; data: T[];
  xKey: keyof T & string; dataKey: keyof T & string; seriesLabel?: string;
  color?: string;                 // defaults to var(--color-highlight)
  xTickFormatter?: (v) => string; headerAction?: ReactNode;
  height?: number; className?: string }

// AreaChartCard — gradient-fill trend (e.g. bodyweight). Same props.
```
Example: `<LineChartCard title="Bench Press" data={series} xKey="date" dataKey="e1rm" />`

## Navigation & shell

- `src/App.tsx` is the shell: `Sidebar` (desktop), `MobileTopBar` + `BottomNav`
  (mobile), `PageTransition` route animation, `Onboarding`, and the sonner `Toaster`
  (top-center, rich colors). Pages render inside `<main class="max-w-5xl …">`.
- Route map and nav model live in `src/components/nav-items.ts` (`NAV_ITEMS`).
  Active link state = lime text + `highlight-muted` pill (mobile) / left rail (desktop).
- **Toasts:** `import { toast } from 'sonner'` anywhere; the `<Toaster>` is mounted.
- **Icons:** lucide-react, `strokeWidth` ~1.75–2. The project already depends on it.

## Routes (for page agents)

| Path             | Component (default export)                     | File |
| ---------------- | ---------------------------------------------- | ---- |
| `/`              | `HomeRoute` → `DashboardPage` (or redirect to `/import` when `useWorkouts()` is empty) | `src/features/dashboard/DashboardPage.tsx` |
| `/import`        | `ImportPage`                                   | `src/features/import/ImportPage.tsx` |
| `/review`        | `ReviewPage`                                   | `src/features/review/ReviewPage.tsx` |
| `/exercise/:id`  | `ExercisePage` (reads `:id` via `useParams`)   | `src/features/exercise/ExercisePage.tsx` |
| `/coach`         | `CoachPage`                                    | `src/features/coach/CoachPage.tsx` |

Each placeholder currently renders a `PageHeader` + a "coming soon" `EmptyState`.
Replace the body; keep the `PageHeader` for consistency. Unknown routes redirect to `/`.

## Don't

- Don't add a theme toggle or invert section backgrounds.
- Don't introduce a second accent color or saturate large surfaces with lime.
- Don't animate keyboard-triggered or high-frequency actions.
- Don't add heavy deps — motion, recharts, lucide, sonner are already present.
- Don't skip the reduced-motion guard on any new animation.
