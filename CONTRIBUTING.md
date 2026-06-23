# Contributing to RepLog

Thanks for your interest in improving RepLog! Bug reports, feature ideas, and pull
requests are all welcome.

## Ground rules

- RepLog is **100% client-side**. There is no backend, no account system, and no
  network calls for user data — please keep it that way. Anything that would upload a
  user's training data or require a server is out of scope.
- Be kind and constructive in issues and reviews.

## Development setup

**Prerequisites:** [Node.js](https://nodejs.org/) ≥ 20

```bash
git clone https://github.com/benasbarciauskas/RepLog.git
cd RepLog
npm install
npm run dev          # http://localhost:5173
```

Useful scripts:

| Command            | What it does                                  |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Start the dev server                          |
| `npm run build`    | Type-check and build the production bundle     |
| `npm run preview`  | Preview the production build locally           |
| `npm test`         | Run the unit/component tests (Vitest)          |
| `npm run lint`     | Lint with ESLint                               |

## Making a change

1. **Fork** the repo and create a branch off `main`:
   `git checkout -b feat/your-idea` (use `feat/`, `fix/`, `docs/`, `refactor/`, or `chore/`).
2. Make your change. Keep pure logic (parser, analytics, coach) framework-free and **covered by
   tests** — those modules are the heart of the app and are reused across views.
3. Run the gates locally before pushing: `npm run lint && npm run build && npm test` must all pass.
4. Commit with a clear message and open a **pull request** describing what changed and why.

## Project layout

```
src/
  types/        shared domain types (the contract every module imports)
  data/         Dexie/IndexedDB storage + reactive hooks
  parser/       messy-notes parser + exercise catalog
  analytics/    bests, estimated 1RM, blocks, bodyweight series
  coach/        strength-ratio rules + balance score
  ocr/          in-browser OCR + video frame sampling
  features/     one folder per screen (dashboard, import, review, logger, …)
  components/   shared UI primitives, charts, navigation
```

## Reporting bugs & requesting features

Open an [issue](../../issues/new/choose). For bugs, include steps to reproduce, what you
expected, and what happened (a screenshot helps). Since data is local to your browser, a
note on your browser/OS is useful too.

Thanks for contributing! ❤️
