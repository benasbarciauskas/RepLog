import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCatalog } from '@/parser';
import { aiParseWorkouts, aiParseWorkoutsFromImages } from './openrouter';

const SECRET_KEY = 'sk-or-test-secret-key-12345';

function mockFetchResponse(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('aiParseWorkouts', () => {
  it('maps a successful OpenRouter response into ParsedWorkout with catalog ids', async () => {
    const aiContent = JSON.stringify({
      workouts: [
        {
          date: '2024-08-26',
          split: 'push',
          bodyweightKg: 87,
          exercises: [
            {
              name: 'Bench press',
              sets: [
                { weightKg: 105, reps: 5, rpe: null },
                { weightKg: 105, reps: 5, rpe: 8 },
              ],
            },
            {
              name: 'Overhead Press',
              sets: [{ weightKg: 70, reps: 5, rpe: null }],
            },
          ],
        },
      ],
    });

    vi.stubGlobal(
      'fetch',
      mockFetchResponse(200, {
        choices: [{ message: { content: aiContent } }],
      }),
    );

    const catalog = createCatalog();
    const result = await aiParseWorkouts('Push day notes', { apiKey: SECRET_KEY, model: 'test-model' }, catalog);

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-08-26');
    expect(result[0].dateConfidence).toBe('high');
    expect(result[0].bodyweightKg).toBe(87);
    expect(result[0].splitCanonical).toBe('push');
    expect(result[0].exercises).toHaveLength(2);
    expect(result[0].exercises[0].exerciseId).toBe('barbell-bench-press');
    expect(result[0].exercises[0].sets).toEqual([
      { weightKg: 105, reps: 5, rpe: null, raw: '105x5' },
      { weightKg: 105, reps: 5, rpe: 8, raw: '105x5' },
    ]);
    expect(result[0].exercises[1].exerciseId).toBe('overhead-press');
  });

  it('rejects with the key-rejected message on HTTP 401', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(401, { error: 'Unauthorized' }));

    const catalog = createCatalog();
    await expect(
      aiParseWorkouts('text', { apiKey: SECRET_KEY, model: 'test-model' }, catalog),
    ).rejects.toThrow('Your OpenRouter key was rejected. Check it in Settings.');
  });

  it('rejects with the unreadable message on malformed content', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponse(200, {
        choices: [{ message: { content: 'not json at all' } }],
      }),
    );

    const catalog = createCatalog();
    await expect(
      aiParseWorkouts('text', { apiKey: SECRET_KEY, model: 'test-model' }, catalog),
    ).rejects.toThrow('The AI returned an unreadable result. Try again or edit the text.');
  });

  it('never includes the apiKey in thrown error messages', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(403, { error: 'Forbidden' }));

    const catalog = createCatalog();
    try {
      await aiParseWorkouts('text', { apiKey: SECRET_KEY, model: 'test-model' }, catalog);
      expect.fail('expected rejection');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain(SECRET_KEY);
      expect(message).not.toContain('sk-or');
    }
  });
});

describe('aiParseWorkoutsFromImages', () => {
  const DATA_URL_1 = 'data:image/jpeg;base64,abc123';
  const DATA_URL_2 = 'data:image/png;base64,def456';
  const VISION_MODEL = 'meta-llama/llama-3.2-11b-vision-instruct:free';

  const sampleAiContent = JSON.stringify({
    workouts: [
      {
        date: '2024-08-26',
        split: 'push',
        bodyweightKg: 87,
        exercises: [
          {
            name: 'Bench press',
            sets: [{ weightKg: 105, reps: 5, rpe: null }],
          },
        ],
      },
    ],
  });

  it('sends multimodal content with text and image_url parts', async () => {
    const fetchMock = mockFetchResponse(200, {
      choices: [{ message: { content: sampleAiContent } }],
    });
    vi.stubGlobal('fetch', fetchMock);

    const catalog = createCatalog();
    await aiParseWorkoutsFromImages(
      [DATA_URL_1, DATA_URL_2],
      { apiKey: SECRET_KEY, model: VISION_MODEL },
      catalog,
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      model: string;
      messages: { role: string; content: unknown }[];
    };

    expect(body.model).toBe(VISION_MODEL);
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/json',
    });

    const userContent = body.messages[1].content as {
      type: string;
      text?: string;
      image_url?: { url: string };
    }[];
    expect(userContent).toHaveLength(3);
    expect(userContent[0]).toEqual({
      type: 'text',
      text: 'Extract all workouts from the following image(s). Return structured JSON with the same format as the system prompt specifies.',
    });
    expect(userContent[1]).toEqual({ type: 'image_url', image_url: { url: DATA_URL_1 } });
    expect(userContent[2]).toEqual({ type: 'image_url', image_url: { url: DATA_URL_2 } });
  });

  it('maps a successful response into ParsedWorkout with catalog ids', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponse(200, {
        choices: [{ message: { content: sampleAiContent } }],
      }),
    );

    const catalog = createCatalog();
    const result = await aiParseWorkoutsFromImages(
      [DATA_URL_1],
      { apiKey: SECRET_KEY, model: VISION_MODEL },
      catalog,
    );

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-08-26');
    expect(result[0].splitCanonical).toBe('push');
    expect(result[0].exercises[0].exerciseId).toBe('barbell-bench-press');
  });

  it('rejects with the key-rejected message on HTTP 401', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(401, { error: 'Unauthorized' }));

    const catalog = createCatalog();
    await expect(
      aiParseWorkoutsFromImages([DATA_URL_1], { apiKey: SECRET_KEY, model: VISION_MODEL }, catalog),
    ).rejects.toThrow('Your OpenRouter key was rejected. Check it in Settings.');
  });

  it('rejects with the key-rejected message on HTTP 403', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(403, { error: 'Forbidden' }));

    const catalog = createCatalog();
    await expect(
      aiParseWorkoutsFromImages([DATA_URL_1], { apiKey: SECRET_KEY, model: VISION_MODEL }, catalog),
    ).rejects.toThrow('Your OpenRouter key was rejected. Check it in Settings.');
  });

  it('rejects with the rate-limit message on HTTP 429', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(429, { error: 'Rate limited' }));

    const catalog = createCatalog();
    await expect(
      aiParseWorkoutsFromImages([DATA_URL_1], { apiKey: SECRET_KEY, model: VISION_MODEL }, catalog),
    ).rejects.toThrow('OpenRouter rate limit reached (free tier is limited per day). Try again later.');
  });

  it('rejects on non-ok HTTP status', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(500, { error: 'Server error' }));

    const catalog = createCatalog();
    await expect(
      aiParseWorkoutsFromImages([DATA_URL_1], { apiKey: SECRET_KEY, model: VISION_MODEL }, catalog),
    ).rejects.toThrow('AI parse failed (HTTP 500).');
  });

  it('rejects with the unreadable message on malformed content', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponse(200, {
        choices: [{ message: { content: 'not json at all' } }],
      }),
    );

    const catalog = createCatalog();
    await expect(
      aiParseWorkoutsFromImages([DATA_URL_1], { apiKey: SECRET_KEY, model: VISION_MODEL }, catalog),
    ).rejects.toThrow('The AI returned an unreadable result. Try again or edit the text.');
  });

  it('returns an empty array when the AI finds no workouts', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponse(200, {
        choices: [{ message: { content: JSON.stringify({ workouts: [] }) } }],
      }),
    );

    const catalog = createCatalog();
    const result = await aiParseWorkoutsFromImages(
      [DATA_URL_1],
      { apiKey: SECRET_KEY, model: VISION_MODEL },
      catalog,
    );

    expect(result).toEqual([]);
  });

  it('rejects with the at-least-one-image error when given no images', async () => {
    const fetchMock = mockFetchResponse(200, {
      choices: [{ message: { content: sampleAiContent } }],
    });
    vi.stubGlobal('fetch', fetchMock);

    const catalog = createCatalog();
    await expect(
      aiParseWorkoutsFromImages([], { apiKey: SECRET_KEY, model: VISION_MODEL }, catalog),
    ).rejects.toThrow('At least one image is required.');

    // Guard rejects before any network call is made.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caps the request at 8 images, dropping the 9th and beyond', async () => {
    const fetchMock = mockFetchResponse(200, {
      choices: [{ message: { content: sampleAiContent } }],
    });
    vi.stubGlobal('fetch', fetchMock);

    const nineImages = Array.from(
      { length: 9 },
      (_, i) => `data:image/jpeg;base64,img${i}`,
    );

    const catalog = createCatalog();
    await aiParseWorkoutsFromImages(
      nineImages,
      { apiKey: SECRET_KEY, model: VISION_MODEL },
      catalog,
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      messages: { role: string; content: { type: string }[] }[];
    };

    // 1 text part + 8 image_url parts (VISION_IMAGE_CAP = 8) — the 9th image is dropped.
    expect(body.messages[1].content).toHaveLength(9);
    const imageParts = body.messages[1].content.filter((p) => p.type === 'image_url');
    expect(imageParts).toHaveLength(8);
  });
});