import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock tesseract.js so the OCR contract is testable without the real worker /
// wasm / language download. The mocked worker emits progress through the logger
// (including a backwards blip we expect imageToText to swallow) and resolves text.
const recognize = vi.fn();
const terminate = vi.fn(async () => {});
const createWorker = vi.fn();

vi.mock('tesseract.js', () => ({
  createWorker: (...args: unknown[]) => createWorker(...args),
}));

afterEach(() => {
  recognize.mockReset();
  terminate.mockClear();
  createWorker.mockReset();
});

describe('imageToText', () => {
  it('resolves recognized text, reports monotonic progress, and terminates the worker', async () => {
    let logger: ((m: { status: string; progress: number }) => void) | undefined;

    createWorker.mockImplementation(
      async (_lang, _oem, opts: { logger?: typeof logger }) => {
        logger = opts?.logger;
        return {
          recognize: async (blob: Blob) => {
            // Drive the logger like real tesseract: load phase, then recognize,
            // with a backwards blip in the middle that must be clamped out.
            logger?.({ status: 'loading tesseract core', progress: 0.2 });
            logger?.({ status: 'recognizing text', progress: 0.5 });
            logger?.({ status: 'recognizing text', progress: 0.3 }); // backwards
            logger?.({ status: 'recognizing text', progress: 0.9 });
            return recognize(blob);
          },
          terminate,
        };
      },
    );
    recognize.mockResolvedValue({ data: { text: '  Benchpress: 105x5  ' } });

    const progress: number[] = [];
    const text = await (await import('./ocr')).imageToText(
      new Blob(['x']),
      (p) => progress.push(p),
    );

    expect(text).toBe('Benchpress: 105x5');

    // Progress is strictly increasing (monotonic) and ends at 1.
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]).toBeGreaterThan(progress[i - 1]);
    }
    expect(progress.length).toBeGreaterThan(0);
    expect(progress[progress.length - 1]).toBe(1);
    // The backwards 0.3 blip was swallowed (never emitted to the consumer).
    expect(progress).not.toContain(0.3);

    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it('terminates the worker even when recognition throws', async () => {
    createWorker.mockResolvedValue({
      recognize: async () => {
        throw new Error('recognition failed');
      },
      terminate,
    });

    await expect(
      (await import('./ocr')).imageToText(new Blob(['x'])),
    ).rejects.toThrow('recognition failed');
    expect(terminate).toHaveBeenCalledTimes(1);
  });
});
