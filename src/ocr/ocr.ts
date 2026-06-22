/**
 * Tesseract.js wrapper. 100% client-side OCR — no network beyond the one-time
 * worker/traineddata fetch tesseract.js does itself; no API key, ever.
 *
 * `imageToText` lazily imports tesseract.js (it's heavy — ~hundreds of KB plus a
 * wasm core and a language model) so it only loads when the user actually OCRs
 * an image, keeping the initial bundle lean. A fresh worker is spun up per call
 * and TERMINATED in a `finally`, so workers never leak across imports.
 */

/** Minimal shape of the tesseract.js module we depend on (kept loose for mocking). */
interface TesseractLike {
  createWorker: (
    lang?: string,
    oem?: number,
    options?: { logger?: (m: { status: string; progress: number }) => void },
  ) => Promise<TesseractWorker>;
}

interface TesseractWorker {
  recognize: (image: Blob) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<void>;
}

/**
 * OCR a single image blob to text. Reports coarse progress in [0, 1] via
 * `onProgress`, guaranteed MONOTONIC (never goes backwards) — tesseract emits
 * progress that resets between phases (loading → recognizing), so we clamp to
 * the running max. Resolves the recognized text; always terminates the worker.
 */
export async function imageToText(
  blob: Blob,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const Tesseract = (await import('tesseract.js')) as unknown as TesseractLike;

  let lastProgress = 0;
  const report = (p: number) => {
    if (!onProgress) return;
    const clamped = Math.min(1, Math.max(0, p));
    if (clamped > lastProgress) {
      lastProgress = clamped;
      onProgress(clamped);
    }
  };

  report(0);

  const worker = await Tesseract.createWorker('eng', 1, {
    logger: (m) => {
      // tesseract reports `progress` in [0,1] per phase; only the recognizing
      // phase maps to user-meaningful progress, but any forward motion is fine
      // since `report` is monotonic.
      if (typeof m.progress === 'number') report(m.progress);
    },
  });

  try {
    const { data } = await worker.recognize(blob);
    report(1);
    return (data.text ?? '').trim();
  } finally {
    await worker.terminate();
  }
}
