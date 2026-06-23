/**
 * Sample frames from a user-supplied screen recording for OCR (spec addendum
 * A1). Everything runs client-side via a hidden <video> + <canvas>: we seek the
 * video at ~1 fps, draw each frame to a canvas, and emit the frames as image
 * blobs for the OCR pipeline.
 *
 * Adjacent frames are deduped with a cheap average-hash (aHash): a screen
 * recording sits still for long stretches (reading a note, pausing a scroll), so
 * we skip frames that are near-identical to the previously KEPT frame — no point
 * OCRing the same screenful twice.
 *
 * HEVC caveat: iPhone screen recordings are HEVC `.mov`. Safari decodes them;
 * Chrome usually cannot. On a decode failure we throw `VideoDecodeError` so the
 * UI can surface a clear message and steer the user to screenshots/paste.
 */

export interface VideoToFramesOptions {
  /** Frames sampled per second of video (default ~1 fps). */
  fps?: number;
  /** Hard cap on total frames returned (default 60) — long recordings are clamped. */
  maxFrames?: number;
  /** Progress in [0, 1] as sampling proceeds. */
  onProgress?: (progress: number) => void;
  /**
   * Hamming-distance threshold (0–64) under which two aHashes count as
   * near-identical and the later frame is skipped. Default 4.
   */
  dedupeThreshold?: number;
}

/** Thrown when the browser cannot decode the supplied video (typically HEVC in Chrome). */
export class VideoDecodeError extends Error {
  constructor(message = 'This video could not be decoded in your browser.') {
    super(message);
    this.name = 'VideoDecodeError';
  }
}

const SIDE = 8; // aHash works on an 8×8 grayscale grid → a 64-bit hash.

/**
 * Decode a video file and return deduped frame blobs (~1 fps, capped).
 * Throws {@link VideoDecodeError} when the browser can't decode the file.
 */
export async function videoToFrames(
  file: File | Blob,
  options: VideoToFramesOptions = {},
): Promise<Blob[]> {
  const {
    fps = 1,
    maxFrames = 60,
    onProgress,
    dedupeThreshold = 4,
  } = options;

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  const canvas = document.createElement('canvas');
  const hashCanvas = document.createElement('canvas');
  hashCanvas.width = SIDE;
  hashCanvas.height = SIDE;

  try {
    await waitForMetadata(video);

    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new VideoDecodeError(
        'This video could not be decoded in your browser. Try Safari, or use screenshots / paste.',
      );
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      throw new VideoDecodeError(
        'This video could not be decoded in your browser (no video track). Try Safari, or use screenshots / paste.',
      );
    }
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    const hashCtx = hashCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !hashCtx) {
      throw new VideoDecodeError('Could not create a canvas for frame extraction.');
    }

    const step = 1 / Math.max(0.1, fps);
    const timestamps = buildTimestamps(duration, step, maxFrames);

    const frames: Blob[] = [];
    let prevHash: bigint | null = null;

    for (let i = 0; i < timestamps.length; i++) {
      await seek(video, timestamps[i]);
      ctx.drawImage(video, 0, 0, width, height);

      // Downscale to 8×8 grayscale for the average hash.
      hashCtx.drawImage(video, 0, 0, SIDE, SIDE);
      const hash = averageHash(hashCtx.getImageData(0, 0, SIDE, SIDE).data);

      const duplicate =
        prevHash !== null &&
        hammingDistance(prevHash, hash) <= dedupeThreshold;

      if (!duplicate) {
        const blob = await canvasToBlob(canvas);
        if (blob) frames.push(blob);
        prevHash = hash;
      }

      onProgress?.((i + 1) / timestamps.length);
    }

    return frames;
  } catch (err) {
    if (err instanceof VideoDecodeError) throw err;
    // MediaError / decode rejections from a codec the browser lacks (HEVC).
    throw new VideoDecodeError(
      'This video could not be decoded in your browser. iPhone recordings are HEVC — try Safari, or use screenshots / paste instead.',
    );
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** Even-spaced sample timestamps across the clip, capped at `maxFrames`. */
function buildTimestamps(duration: number, step: number, maxFrames: number): number[] {
  const stamps: number[] = [];
  for (let t = 0; t < duration && stamps.length < maxFrames; t += step) {
    stamps.push(t);
  }
  return stamps;
}

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 1 && Number.isFinite(video.duration)) {
      resolve();
      return;
    }
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new VideoDecodeError());
    };
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
  });
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new VideoDecodeError());
    };
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = Math.min(time, Math.max(0, video.duration - 0.001));
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/**
 * Average hash of an 8×8 RGBA buffer: grayscale each pixel, then set a bit per
 * pixel that is brighter than the frame's mean. Returns a 64-bit hash.
 */
export function averageHash(rgba: Uint8ClampedArray): bigint {
  const grays: number[] = [];
  for (let i = 0; i < rgba.length; i += 4) {
    // Rec. 601 luma.
    grays.push(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]);
  }
  const mean = grays.reduce((a, b) => a + b, 0) / grays.length;

  let hash = 0n;
  for (let i = 0; i < grays.length; i++) {
    hash <<= 1n;
    if (grays[i] >= mean) hash |= 1n;
  }
  return hash;
}

/** Number of differing bits between two 64-bit hashes. */
export function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

/**
 * Pure dedup contract used by the sampler (exported for testing): the second
 * frame is a near-duplicate of the first when their aHash Hamming distance is
 * within `threshold`.
 */
export function isNearDuplicate(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  threshold = 4,
): boolean {
  return hammingDistance(averageHash(a), averageHash(b)) <= threshold;
}
