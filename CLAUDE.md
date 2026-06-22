# RepLog — project guide for Claude

**What:** A 100% client-side web app that turns messy workout notes (screenshots or pasted text)
into structured training data, then surfaces all-time bests, split history, and a rule-based
"what's lacking" muscle-imbalance coach.

**Owner:** Benas Barciauskas (`benasbarciauskas` GitHub). Private repo.

## Hard constraints

- **No backend, no API key, no LLM in the product.** Parsing is deterministic; OCR is Tesseract.js
  in the browser; coaching is a strength-ratio rule engine. All data stays on-device (IndexedDB).
  A `Repository` interface keeps the seam open for optional cloud sync / WebLLM later — don't wire
  either in v1.
- **Web and iOS are separate codebases.** This repo is web only.
- Mobile-first, fully responsive, subtle animation throughout, `prefers-reduced-motion` respected.

## Stack

React + Vite + TypeScript · Tailwind + shadcn/ui · framer-motion · Tesseract.js · Dexie/IndexedDB ·
chrono-node · Fuse.js · Recharts. Deploy: Vercel (static). Installable PWA.

## Working agreement

- Non-trivial work runs in sub-agents, each in its own `.worktrees/<slug>` — commit there, never
  edit the primary checkout while a worktree is active.
- Ship autonomously on green: CI passing + a clean code-review pass + own smoke test → merge to the
  default branch yourself. Any gate failure → stop and surface. Deploy is the project's ship step.
- Author/committer is always `Benas Barciauskas <benasbarciauskas@gmail.com>`. **Never** add an AI
  co-author trailer.

## Design

Built with the design skills: emil-design-eng, design-taste-frontend, impeccable, ui-ux-pro-max.
shadcn MCP + 21st-dev Magic MCP for components; Chrome DevTools MCP to verify the running UI.

Spec: `docs/superpowers/specs/2026-06-22-replog-design.md`.
