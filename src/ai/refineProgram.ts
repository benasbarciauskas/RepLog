import type { Program, ProgramConfig } from '@/types/models';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const HTTP_REFERER = 'https://benasbarciauskas.github.io/RepLog/';

const SYSTEM_PROMPT = `You refine a structured workout program by swapping exercises for better alternatives.
Return ONLY valid JSON — no markdown, no prose, no code fences.

Output shape (same as input Program):
{
  "id": string,
  "name": string,
  "config": { "goal": "hypertrophy"|"strength", "experience": "beginner"|"intermediate"|"advanced", "daysPerWeek": number, "split": string, "minutesPerSession": number },
  "days": [
    {
      "name": string,
      "splitCanonical": string,
      "exercises": [
        { "exerciseId": string, "rawName": string, "targetSets": number, "repRange": [number, number], "rir": number, "restSeconds": number }
      ]
    }
  ],
  "createdAt": string,
  "updatedAt": string
}

Rules:
- Keep the EXACT same structure: same number of days, same day names, same splitCanonical values, same targetSets/repRange/rir/restSeconds per slot.
- Only swap exerciseId and rawName within each slot — improve exercise selection, do not add or remove exercises or days.
- Use only exerciseId values from the provided catalog list.
- Preserve id, name, config, createdAt; set updatedAt to the provided timestamp.`;

function stripJsonFences(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function isValidProgram(raw: unknown): raw is Program {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as Program;
  if (typeof p.id !== 'string' || typeof p.name !== 'string') return false;
  if (!p.config || !Array.isArray(p.days)) return false;
  if (typeof p.createdAt !== 'string' || typeof p.updatedAt !== 'string') return false;
  for (const day of p.days) {
    if (typeof day.name !== 'string' || !Array.isArray(day.exercises)) return false;
    for (const ex of day.exercises) {
      if (
        typeof ex.exerciseId !== 'string' ||
        typeof ex.rawName !== 'string' ||
        typeof ex.targetSets !== 'number' ||
        !Array.isArray(ex.repRange) ||
        ex.repRange.length !== 2 ||
        typeof ex.rir !== 'number' ||
        typeof ex.restSeconds !== 'number'
      ) {
        return false;
      }
    }
  }
  return true;
}

function structureMatches(original: Program, refined: Program): boolean {
  if (original.days.length !== refined.days.length) return false;
  for (let d = 0; d < original.days.length; d++) {
    const oDay = original.days[d];
    const rDay = refined.days[d];
    if (oDay.name !== rDay.name || oDay.splitCanonical !== rDay.splitCanonical) return false;
    if (oDay.exercises.length !== rDay.exercises.length) return false;
    for (let e = 0; e < oDay.exercises.length; e++) {
      const oEx = oDay.exercises[e];
      const rEx = rDay.exercises[e];
      if (
        oEx.targetSets !== rEx.targetSets ||
        oEx.repRange[0] !== rEx.repRange[0] ||
        oEx.repRange[1] !== rEx.repRange[1] ||
        oEx.rir !== rEx.rir ||
        oEx.restSeconds !== rEx.restSeconds
      ) {
        return false;
      }
    }
  }
  return true;
}

export async function refineProgram(
  program: Program,
  config: ProgramConfig,
  catalogIds: string[],
  opts: { apiKey: string; model: string },
): Promise<Program> {
  const { apiKey, model } = opts;
  const now = new Date().toISOString();

  const userPayload = {
    program,
    config,
    catalogExerciseIds: catalogIds,
    updatedAt: now,
  };

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
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
      }),
    });
  } catch {
    throw new Error('Could not reach OpenRouter. Check your connection.');
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('Your OpenRouter key was rejected. Check it in Settings.');
  }
  if (response.status === 429) {
    throw new Error('OpenRouter rate limit reached. Try again later.');
  }
  if (!response.ok) {
    throw new Error(`AI refine failed (HTTP ${response.status}).`);
  }

  let body: { choices?: { message?: { content?: string } }[] };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    throw new Error('The AI returned an unreadable result.');
  }

  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('The AI returned an unreadable result.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(content));
  } catch {
    throw new Error('The AI returned an unreadable result.');
  }

  if (!isValidProgram(parsed)) {
    throw new Error('The AI returned an invalid program shape.');
  }

  if (!structureMatches(program, parsed)) {
    throw new Error('The AI changed the program structure.');
  }

  const catalogSet = new Set(catalogIds);
  for (const day of parsed.days) {
    for (const ex of day.exercises) {
      if (!catalogSet.has(ex.exerciseId)) {
        throw new Error('The AI used unknown exercise ids.');
      }
    }
  }

  return {
    ...parsed,
    id: program.id,
    name: program.name,
    config: program.config,
    createdAt: program.createdAt,
    updatedAt: now,
  };
}