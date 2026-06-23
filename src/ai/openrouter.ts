import type { ExerciseCatalog } from '@/parser/catalog';
import { detectSplit } from '@/parser/fields';
import type { ParsedWorkout, SetEntry, WorkoutExercise } from '@/types/models';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const HTTP_REFERER = 'https://benasbarciauskas.github.io/RepLog/';

const SYSTEM_PROMPT = `You extract structured workout data from messy gym notes or OCR text.
Return ONLY valid JSON — no markdown, no prose, no code fences.

Output shape:
{
  "workouts": [
    {
      "date": "YYYY-MM-DD or null",
      "split": "body-part/split label or null",
      "bodyweightKg": number or null,
      "exercises": [
        {
          "name": "exercise name",
          "sets": [
            { "weightKg": number or null, "reps": number or null, "rpe": number or null }
          ]
        }
      ]
    }
  ]
}

Rules:
- All weights are in kilograms. Only convert to kg when a line is clearly in pounds/lb (multiply by 0.4536).
- null weightKg means bodyweight (BW).
- Ignore non-workout content (groceries, todos, random text).
- A scheme like "5x5: 105x5,5,5" means sets of 105kg×5 each; carry the weight across reps-only entries (e.g. "5,5,4" after "105x5" are more sets at 105kg).
- Ignore a trailing estimated-1RM column if present.
- If nothing is a workout, return {"workouts":[]}.`;

interface AiSet {
  weightKg?: number | null;
  reps?: number | null;
  rpe?: number | null;
}

interface AiExercise {
  name?: string;
  sets?: AiSet[];
}

interface AiWorkout {
  date?: string | null;
  split?: string | null;
  bodyweightKg?: number | null;
  exercises?: AiExercise[];
}

interface AiResponse {
  workouts?: AiWorkout[];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function stripJsonFences(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function mapWorkout(raw: AiWorkout, catalog: ExerciseCatalog): ParsedWorkout | null {
  const exercises: WorkoutExercise[] = [];

  for (const ex of raw.exercises ?? []) {
    const name = (ex.name ?? '').trim();
    if (!name) continue;

    const def = catalog.match(name);
    const exerciseId = def?.id ?? `unknown:${slugify(name)}`;

    const sets: SetEntry[] = (ex.sets ?? []).map((s) => ({
      weightKg: typeof s.weightKg === 'number' ? s.weightKg : null,
      reps: typeof s.reps === 'number' ? Math.max(0, Math.round(s.reps)) : 0,
      rpe: typeof s.rpe === 'number' ? s.rpe : null,
      raw: `${s.weightKg ?? 'BW'}x${s.reps ?? ''}`,
    }));

    exercises.push({
      exerciseId,
      rawName: name,
      unit: 'kg',
      sets,
    });
  }

  if (exercises.length === 0) return null;

  const dateStr = raw.date && typeof raw.date === 'string' && isValidISODate(raw.date) ? raw.date : '';
  const dateConfidence = dateStr ? 'high' : 'low';
  const { canonical, raw: splitRaw } = detectSplit(raw.split ?? '');

  return {
    date: dateStr,
    dateConfidence,
    bodyweightKg: typeof raw.bodyweightKg === 'number' ? raw.bodyweightKg : null,
    splitCanonical: canonical,
    splitRaw,
    exercises,
  };
}

type OpenRouterMessage = {
  role: 'system' | 'user';
  content: string | { type: string; text?: string; image_url?: { url: string } }[];
};

async function requestAndMap(
  messages: OpenRouterMessage[],
  opts: { apiKey: string; model: string },
  catalog: ExerciseCatalog,
): Promise<ParsedWorkout[]> {
  const { apiKey, model } = opts;

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': HTTP_REFERER,
        'X-Title': 'RepLog',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages,
      }),
    });
  } catch {
    throw new Error('Could not reach OpenRouter. Check your connection.');
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('Your OpenRouter key was rejected. Check it in Settings.');
  }
  if (response.status === 429) {
    throw new Error('OpenRouter rate limit reached (free tier is limited per day). Try again later.');
  }
  if (!response.ok) {
    throw new Error(`AI parse failed (HTTP ${response.status}).`);
  }

  let body: { choices?: { message?: { content?: string } }[] };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    throw new Error('The AI returned an unreadable result. Try again or edit the text.');
  }

  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('The AI returned an unreadable result. Try again or edit the text.');
  }

  let parsed: AiResponse;
  try {
    parsed = JSON.parse(stripJsonFences(content)) as AiResponse;
  } catch {
    throw new Error('The AI returned an unreadable result. Try again or edit the text.');
  }

  if (!Array.isArray(parsed.workouts)) {
    throw new Error('The AI returned an unreadable result. Try again or edit the text.');
  }

  return parsed.workouts
    .map((w) => mapWorkout(w, catalog))
    .filter((w): w is ParsedWorkout => w !== null);
}

export async function aiParseWorkouts(
  text: string,
  opts: { apiKey: string; model: string },
  catalog: ExerciseCatalog,
): Promise<ParsedWorkout[]> {
  return requestAndMap(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
    opts,
    catalog,
  );
}

export const VISION_IMAGE_CAP = 8; // OpenRouter vision models cap at 8 images per request

export async function aiParseWorkoutsFromImages(
  images: string[],
  opts: { apiKey: string; model: string },
  catalog: ExerciseCatalog,
): Promise<ParsedWorkout[]> {
  if (images.length === 0) {
    throw new Error('At least one image is required.');
  }

  const capped = images.slice(0, VISION_IMAGE_CAP);

  return requestAndMap(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract all workouts from the following image(s). Return structured JSON with the same format as the system prompt specifies.',
          },
          ...capped.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
        ],
      },
    ],
    opts,
    catalog,
  );
}