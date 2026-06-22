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

<!-- RUFLO-GIT-STANDARD -->
## Git Workflow (Ruflo Git Standard)

Branches: `main` = live. `beta` = integration/preview (where it exists). Feature branches are
`<type>/<slug>` where type ∈ `feat|fix|chore|refactor|docs`.

Flow (one verb — `scripts/flow.sh`):
- `scripts/flow.sh feature "<name>"` → new worktree under `.worktrees/<slug>` on `feat/<slug>`,
  branched off `beta` if it exists, else `main`. Account is auto-switched to the repo owner.
- A sub-agent works ONLY inside its assigned worktree on its `feat/` branch. It must not touch
  `main`/`beta`, other worktrees, or other features' files.
- `scripts/flow.sh done` → push the branch and open a PR into the right base.
- `scripts/flow.sh promote` → open the `beta → main` release PR.
- `scripts/flow.sh sync` → prune merged branches + dead worktrees.

**Agent autonomy — who may push / open PRs:**
- **No-live/no-beta repos** (local-only tools, placeholders — no live deployment AND no `beta`
  branch): an agent MAY run `scripts/flow.sh done` itself (push + open the PR). It must still
  NOT merge the PR and NOT `promote`.
- **Repos with a live deployment and/or a `beta` branch:** the agent commits and STOPS; the
  human runs `flow.sh done`, reviews, and merges/promotes.
- Always, regardless of tier: never push directly to `main`/`beta`, never merge or promote a
  PR, never `--no-verify`.

`main` and `beta` are protected by GitHub rulesets: no direct pushes, PR + green CI required.
Merges are squash-only; the head branch auto-deletes on merge.

## Security (non-negotiable — see SECURITY.md)

- NEVER commit secrets: no `.env`, API keys, tokens, `*.session.json`, cookies, private keys.
  Load secrets from env / keychain. A pre-commit hook blocks this; do not `--no-verify` around it.
- No secrets in frontend JS bundles; no source maps in production.
- Enforce authorization on every protected action (not just authentication). No IDOR — never trust
  user-supplied IDs/roles; scope every query to the authenticated user/tenant.
- Validate & sanitize all input at the boundary; parameterized queries only (no SQL/NoSQL injection);
  escape output (no XSS); CSRF protection on state-changing requests.
- Rate-limit login/signup/API/AI endpoints. Lock down CORS. Set security headers. Cookies =
  HttpOnly+Secure+SameSite. Verify webhook signatures. Enforce payment/subscription checks server-side.
- Treat AI input as untrusted (prompt injection); AI tools get the same authz as the user.
- No verbose error/stack traces or PII/tokens in logs or responses. Review generated code before merge.
