import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCatalog } from '@/parser';
import { aiParseWorkouts } from './openrouter';

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