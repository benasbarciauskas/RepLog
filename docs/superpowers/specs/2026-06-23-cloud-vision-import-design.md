# Cloud vision screenshot import — design spec (2026-06-23)

## What

An OPT-IN "Read with AI" path that sends an imported workout SCREENSHOT directly to a
vision-capable LLM via the user's own OpenRouter key, returning a structured workout —
skipping Tesseract OCR + the deterministic parser. This is the high-quality lane for
messy/handwritten screenshots the on-device path can't crack. Tesseract stays the free,
on-device DEFAULT. Web-only; do NOT touch mobile/.

Decisions (locked): image -> structured workout JSON directly (reuse the existing
aiParseWorkouts prompt + catalog mapping); triggered by an EXPLICIT button, never auto.

## Privacy / security (non-negotiable)

- The screenshot leaves the device only when the user clicks "Read with AI". The button
  only appears when an OpenRouter key is configured. Show a one-line notice near it:
  "Sends the image to OpenRouter with your key." This mirrors the existing opt-in text-AI
  path — it's a conscious, per-import action.
- Never log the key or the image. Request is HTTPS to OpenRouter with Bearer key (same as
  the text path). We have no server; nothing is persisted by us.

## Changes by module

### 1. src/ai/openrouter.ts — add a vision entry point
- Refactor the shared tail of aiParseWorkouts (the fetch -> status handling -> json ->
  stripJsonFences -> JSON.parse -> map AiResponse to ParsedWorkout[]) into a private
  helper, e.g. `requestAndMap(messages, { apiKey, model }, catalog)`, so the text and
  image paths share ALL plumbing/error handling and differ only in the `messages` payload
  and model. Keep aiParseWorkouts' behaviour byte-identical (regression).
- Add `export async function aiParseWorkoutsFromImages(images: string[], opts: { apiKey:
  string; model: string }, catalog: ExerciseCatalog): Promise<ParsedWorkout[]>` where
  `images` are data-URL strings (`data:image/png;base64,...`). It builds ONE user message
  with multimodal content:
      [{ type: 'text', text: '<short instruction to extract workouts from these images>' },
       ...images.map(url => ({ type: 'image_url', image_url: { url } }))]
  Reuse SYSTEM_PROMPT, temperature 0, response_format json_object.
- Guard: require >=1 image; cap the batch (e.g. <= 8 images per request) and document the
  cap; throw a clear Error if a model rejects images (surface OpenRouter's error text /
  HTTP status via the same status branches the text path already has).

### 2. src/data/repository.ts + types — vision model setting
- The default text model `meta-llama/llama-3.3-70b-instruct:free` is NOT vision-capable, so
  the image path must use a DIFFERENT model. Add `aiVisionModel` to AppSettings + DEFAULT_SETTINGS
  with a sensible vision-capable default (pick a currently-valid OpenRouter vision model id;
  document it must support image input; user-overridable in Settings). Thread it through
  stripSettingsKey / persistence exactly like aiModel.
- Add a field for it in the Settings UI next to the existing AI model field (label e.g.
  "AI vision model", helper text "Used for 'Read with AI' on screenshots — must support
  images.").

### 3. src/features/import/ImportPage.tsx — the button
- In the screenshot/upload section, when files are staged AND settings.aiApiKey is set,
  render a "Read with AI" button alongside the existing (Tesseract) action. Tesseract stays
  the default/primary action.
- On click: convert the staged image File(s) to data URLs (FileReader.readAsDataURL),
  call aiParseWorkoutsFromImages(dataUrls, { apiKey: settings.aiApiKey, model:
  settings.aiVisionModel }, catalog), then feed the resulting ParsedWorkout[] into the SAME
  Review flow the existing text `aiParse` callback uses (mirror its success/error/loading
  handling: toast on error, a pending/spinner state, route to Review on success).
- No key -> button hidden (same gate as the text aiParse, which toasts "Add your OpenRouter
  key in Settings").

## Testing

- openrouter.test.ts: extend with aiParseWorkoutsFromImages cases (mock fetch — NO real
  network): asserts the request body has the multimodal content array (text + N image_url
  parts), the vision model, and the auth header; maps a sample structured response to
  ParsedWorkout[] via the catalog; error branches (401/403, 429, non-ok, non-JSON, empty
  {"workouts":[]} -> []). Assert aiParseWorkouts' existing tests still pass unchanged (shared
  helper refactor must not change text behaviour).
- ImportPage.test.tsx: the "Read with AI" button is hidden without a key and shown with one;
  clicking it (with a mocked aiParseWorkoutsFromImages + mocked FileReader/data URLs) calls
  the vision fn with data-URL strings and routes to Review. No real network/Tesseract.

## Gates
npm run build (green) + npm run lint (clean) + npm test (all pass, incl. all pre-existing).

## Out of scope
In-browser/local LLM, OCR engine swap, the parser-dialect widening (separate branch),
mobile import, any server-side proxy.
