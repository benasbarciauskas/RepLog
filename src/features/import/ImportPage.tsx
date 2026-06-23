import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  ClipboardType,
  Film,
  ImagePlus,
  Loader2,
  Plus,
  ScanText,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { newId } from '@/lib/id';
import { DEFAULT_SETTINGS, repository } from '@/data/repository';
import type { NoteSource, RawNote } from '@/types/models';
import { imageToText } from '@/ocr/ocr';
import { stitchOcrText } from '@/ocr/stitch';
import { VideoDecodeError, videoToFrames } from '@/ocr/video';
import { useSettings, useWorkouts } from '@/data/hooks';
import { aiParseWorkouts, aiParseWorkoutsFromImages } from '@/ai/openrouter';
import { createCatalog } from '@/parser';
import { TrySampleDataButton } from '@/features/data/DataActions';
import { ingestCorpus } from './pipeline';
import { REVIEW_STATE_TAG, type ReviewRouteState } from './types';

const ENTER = { duration: 0.22, ease: [0.23, 1, 0.32, 1] as const };

type Mode = 'screenshots' | 'paste' | 'video';

interface ProgressState {
  /** 0–1 overall progress, or null when idle. */
  value: number | null;
  /** Status line shown beside the bar. */
  label: string;
}

const IDLE: ProgressState = { value: null, label: '' };

export default function ImportPage() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const workouts = useWorkouts();
  const settings = useSettings();

  const [mode, setMode] = useState<Mode>('screenshots');
  const [images, setImages] = useState<File[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ProgressState>(IDLE);

  const goToReview = useCallback(
    (corpus: string, source: NoteSource, sourceLabels?: string[]) => {
      const trimmed = corpus.trim();
      if (!trimmed) {
        toast.error('Nothing to parse', {
          description: 'We could not read any text from that. Try a clearer source.',
        });
        return false;
      }

      const { workouts, skipped, warnings } = ingestCorpus(trimmed);

      if (workouts.length === 0) {
        if (trimmed.length > 0) {
          setPasteText(trimmed);
          setMode('paste');
          toast.info(
            settings?.aiApiKey
              ? "Couldn't auto-detect a workout. Here's the text we read — try AI parse, or edit and Parse."
              : "Couldn't auto-detect a workout. Here's the text we read — edit it or paste your note, then Parse.",
          );
          return false;
        }
        toast.error('No workouts found', {
          description:
            skipped.length > 0
              ? `Found ${skipped.length} note${skipped.length === 1 ? '' : 's'}, but none looked like a workout.`
              : 'That text did not contain any recognisable workout data.',
        });
        return false;
      }

      // Stash the raw note for provenance. Persisting a RawNote is safe — it is
      // the imported source, not a confirmed workout (nothing logs until the
      // user confirms on Review).
      const note: RawNote = {
        id: newId(),
        sourceType: source,
        rawText: trimmed,
        importedAt: new Date().toISOString(),
        status: 'needs-review',
      };
      void repository.addNote(note);

      const state: ReviewRouteState & { tag: typeof REVIEW_STATE_TAG } = {
        tag: REVIEW_STATE_TAG,
        workouts,
        skippedCount: skipped.length,
        skipped,
        warnings,
        sourceLabels,
      };
      navigate('/review', { state });
      return true;
    },
    [navigate, setPasteText, setMode, settings?.aiApiKey],
  );

  const aiParse = useCallback(
    async (corpus: string) => {
      if (!settings?.aiApiKey) {
        toast.error('Add your OpenRouter key in Settings to use AI parse.');
        return;
      }
      const trimmed = corpus.trim();
      if (!trimmed) {
        toast.error('Nothing to parse', {
          description: 'Paste or edit your workout notes first.',
        });
        return;
      }

      setBusy(true);
      setProgress({ value: null, label: 'AI parsing…' });
      try {
        const custom = await repository.getCustomExercises();
        const catalog = createCatalog(custom);
        const parsed = await aiParseWorkouts(
          trimmed,
          {
            apiKey: settings.aiApiKey,
            model: settings.aiModel || 'meta-llama/llama-3.3-70b-instruct:free',
          },
          catalog,
        );

        if (parsed.length === 0) {
          toast.error('AI did not find a workout in that text.');
          return;
        }

        const note: RawNote = {
          id: newId(),
          sourceType: 'paste',
          rawText: trimmed,
          importedAt: new Date().toISOString(),
          status: 'needs-review',
        };
        void repository.addNote(note);

        const state: ReviewRouteState & { tag: typeof REVIEW_STATE_TAG } = {
          tag: REVIEW_STATE_TAG,
          workouts: parsed,
          skippedCount: 0,
          skipped: [],
          warnings: ['Parsed with AI — double-check the numbers before saving.'],
          sourceLabels: undefined,
        };
        navigate('/review', { state });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'AI parse failed.');
      } finally {
        setBusy(false);
        setProgress(IDLE);
      }
    },
    [navigate, settings?.aiApiKey, settings?.aiModel],
  );

  const aiVisionParse = useCallback(async () => {
    if (!settings?.aiApiKey) {
      toast.error('Add your OpenRouter key in Settings to use AI parse.');
      return;
    }
    if (images.length === 0) return;

    setBusy(true);
    setProgress({ value: null, label: 'AI reading screenshots…' });
    try {
      const dataUrls = await Promise.all(images.map(readFileAsDataUrl));
      const custom = await repository.getCustomExercises();
      const catalog = createCatalog(custom);
      const parsed = await aiParseWorkoutsFromImages(
        dataUrls,
        {
          apiKey: settings.aiApiKey,
          model: settings.aiVisionModel || DEFAULT_SETTINGS.aiVisionModel!,
        },
        catalog,
      );

      if (parsed.length === 0) {
        toast.error('AI did not find a workout in those images.');
        return;
      }

      const note: RawNote = {
        id: newId(),
        sourceType: 'screenshot',
        rawText: '[AI vision import]',
        importedAt: new Date().toISOString(),
        status: 'needs-review',
      };
      void repository.addNote(note);

      const state: ReviewRouteState & { tag: typeof REVIEW_STATE_TAG } = {
        tag: REVIEW_STATE_TAG,
        workouts: parsed,
        skippedCount: 0,
        skipped: [],
        warnings: ['Parsed with AI from screenshots — double-check the numbers before saving.'],
        sourceLabels: images.map((f) => f.name),
      };
      navigate('/review', { state });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI parse failed.');
    } finally {
      setBusy(false);
      setProgress(IDLE);
    }
  }, [navigate, settings?.aiApiKey, settings?.aiVisionModel, images]);

  // --- Screenshots → OCR each → corpus -------------------------------------
  const parseScreenshots = useCallback(async () => {
    if (images.length === 0 || busy) return;
    setBusy(true);
    setProgress({ value: 0, label: 'Reading screenshots…' });
    try {
      const texts: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const base = i / images.length;
        const span = 1 / images.length;
        const text = await imageToText(images[i], (p) => {
          setProgress({
            value: base + p * span,
            label: `Reading screenshot ${i + 1} of ${images.length}…`,
          });
        });
        texts.push(text);
      }
      setProgress({ value: 1, label: 'Parsing…' });
      // Each screenshot is its own note; join with a blank line so the segmenter
      // treats them as separate chunks unless a date header bridges them.
      goToReview(texts.join('\n\n'), 'screenshot');
    } catch (err) {
      toast.error('Could not read those images', {
        description: err instanceof Error ? err.message : 'OCR failed. Try paste instead.',
      });
    } finally {
      setBusy(false);
      setProgress(IDLE);
    }
  }, [images, busy, goToReview]);

  // --- Paste → corpus directly ---------------------------------------------
  const parsePaste = useCallback(() => {
    if (!pasteText.trim() || busy) return;
    goToReview(pasteText, 'paste');
  }, [pasteText, busy, goToReview]);

  // --- Video → frames → OCR → stitch → corpus ------------------------------
  const parseVideo = useCallback(async () => {
    if (!videoFile || busy) return;
    setBusy(true);
    setProgress({ value: 0, label: 'Sampling frames…' });
    try {
      const frames = await videoToFrames(videoFile, {
        fps: 1,
        maxFrames: 60,
        onProgress: (p) =>
          setProgress({ value: p * 0.35, label: 'Sampling frames…' }),
      });

      if (frames.length === 0) {
        toast.error('No frames captured', {
          description: 'That recording was too short to sample. Try screenshots or paste.',
        });
        return;
      }

      if (frames.length >= 60) {
        toast.info('Long recording', {
          description: 'We sampled the first 60 frames. Trim the clip for full coverage.',
        });
      }

      const texts: string[] = [];
      for (let i = 0; i < frames.length; i++) {
        const base = 0.35 + (i / frames.length) * 0.6;
        const span = (1 / frames.length) * 0.6;
        const text = await imageToText(frames[i], (p) =>
          setProgress({
            value: base + p * span,
            label: `Reading frame ${i + 1} of ${frames.length}…`,
          }),
        );
        texts.push(text);
      }

      setProgress({ value: 1, label: 'Stitching & parsing…' });
      const corpus = stitchOcrText(texts);
      goToReview(corpus, 'screenshot', undefined);
    } catch (err) {
      if (err instanceof VideoDecodeError) {
        toast.error('Could not decode that video', {
          description:
            'iPhone recordings are HEVC, which Chrome often cannot read. Open RepLog in Safari, or use screenshots / paste instead.',
          duration: 8000,
        });
      } else {
        toast.error('Video import failed', {
          description: err instanceof Error ? err.message : 'Try screenshots or paste instead.',
        });
      }
    } finally {
      setBusy(false);
      setProgress(IDLE);
    }
  }, [videoFile, busy, goToReview]);

  return (
    <div>
      <PageHeader
        eyebrow="Step one"
        title="Import"
        description="Drop screenshots, paste text, or upload a screen recording. RepLog reads and parses it on-device — nothing leaves your phone."
      />

      <Tabs value={mode} onValueChange={(v) => !busy && setMode(v as Mode)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="screenshots" disabled={busy}>
            <ImagePlus aria-hidden /> Screenshots
          </TabsTrigger>
          <TabsTrigger value="paste" disabled={busy}>
            <ClipboardType aria-hidden /> Paste
          </TabsTrigger>
          <TabsTrigger value="video" disabled={busy}>
            <Film aria-hidden /> Video
          </TabsTrigger>
        </TabsList>

        <TabsContent value="screenshots" className="mt-6">
          <ScreenshotMode
            images={images}
            busy={busy}
            onAdd={(files) => setImages((prev) => [...prev, ...files])}
            onRemove={(idx) => setImages((prev) => prev.filter((_, i) => i !== idx))}
            onClear={() => setImages([])}
          />
        </TabsContent>

        <TabsContent value="paste" className="mt-6">
          <PasteMode value={pasteText} onChange={setPasteText} busy={busy} />
        </TabsContent>

        <TabsContent value="video" className="mt-6">
          <VideoMode file={videoFile} busy={busy} onSelect={setVideoFile} />
        </TabsContent>
      </Tabs>

      {/* Progress + action footer */}
      <div className="mt-6 space-y-4">
        {progress.value !== null ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={ENTER}
            className="space-y-2 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-highlight" aria-hidden />
                {progress.label}
              </span>
              <span className="tnum text-muted-foreground">
                {Math.round(progress.value * 100)}%
              </span>
            </div>
            <Progress value={progress.value * 100} />
          </motion.div>
        ) : null}

        <div className="flex flex-col items-end gap-2">
          {mode === 'screenshots' && settings?.aiApiKey && images.length > 0 ? (
            <div className="flex w-full flex-col items-end gap-1">
              <motion.div whileTap={reduce || busy ? undefined : { scale: 0.97 }}>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => void aiVisionParse()}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <ScanText aria-hidden />
                  )}
                  {busy ? 'Working…' : 'Read with AI'}
                </Button>
              </motion.div>
              <p className="text-xs text-muted-foreground">
                Sends the image to OpenRouter with your key.
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            {mode === 'paste' && settings?.aiApiKey ? (
              <motion.div whileTap={reduce || busy || !pasteText.trim() ? undefined : { scale: 0.97 }}>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => void aiParse(pasteText)}
                  disabled={busy || pasteText.trim().length === 0}
                >
                  {busy ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <ScanText aria-hidden />
                  )}
                  {busy ? 'Working…' : 'AI parse'}
                </Button>
              </motion.div>
            ) : null}
            <ParseButton mode={mode} busy={busy} reduce={reduce} onClick={runForMode(mode, { parseScreenshots, parsePaste, parseVideo })} disabled={isDisabled(mode, { images, pasteText, videoFile, busy })} />
          </div>
        </div>
      </div>

      {/* First-run shortcut: when there's nothing logged yet, let people load a
          few demo workouts to see the dashboard and coach before importing. */}
      {workouts.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 border-t border-border pt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Just want to look around first?
          </p>
          <TrySampleDataButton variant="outline" />
        </div>
      ) : null}
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
}

function runForMode(
  mode: Mode,
  handlers: { parseScreenshots: () => void; parsePaste: () => void; parseVideo: () => void },
) {
  if (mode === 'screenshots') return handlers.parseScreenshots;
  if (mode === 'paste') return handlers.parsePaste;
  return handlers.parseVideo;
}

function isDisabled(
  mode: Mode,
  s: { images: File[]; pasteText: string; videoFile: File | null; busy: boolean },
): boolean {
  if (s.busy) return true;
  if (mode === 'screenshots') return s.images.length === 0;
  if (mode === 'paste') return s.pasteText.trim().length === 0;
  return s.videoFile === null;
}

function ParseButton({
  mode,
  busy,
  reduce,
  onClick,
  disabled,
}: {
  mode: Mode;
  busy: boolean;
  reduce: boolean | null;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <motion.div whileTap={reduce || disabled ? undefined : { scale: 0.97 }}>
      <Button size="lg" onClick={onClick} disabled={disabled}>
        {busy ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <Sparkles aria-hidden />
        )}
        {busy ? 'Working…' : mode === 'paste' ? 'Parse text' : 'Read & parse'}
      </Button>
    </motion.div>
  );
}

// --- Screenshots mode -------------------------------------------------------

function ScreenshotMode({
  images,
  busy,
  onAdd,
  onRemove,
  onClear,
}: {
  images: File[];
  busy: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (idx: number) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list).filter((f) => f.type.startsWith('image/'));
    if (files.length) onAdd(files);
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files);
        }}
        disabled={busy}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60',
          dragging
            ? 'border-highlight bg-highlight-muted'
            : 'border-border bg-surface/40 hover:border-highlight/40 hover:bg-surface-elevated',
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-highlight-muted text-highlight">
          <ImagePlus className="size-6" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="space-y-1">
          <span className="block text-sm font-semibold text-foreground">
            Drop screenshots or tap to choose
          </span>
          <span className="block text-xs text-muted-foreground">
            Screenshot your Notes app — add them one at a time or many at once. PNG / JPG.
          </span>
        </span>
      </button>

      <p className="text-xs text-muted-foreground">
        For many notes at once, pasting the text or using one screenshot per note is most reliable.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          accept(e.target.files);
          e.target.value = '';
        }}
      />

      {images.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {images.length} image{images.length === 1 ? '' : 's'} ready
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
              >
                <ImagePlus aria-hidden /> Add more
              </Button>
              <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>
                <Trash2 aria-hidden /> Clear
              </Button>
            </div>
          </div>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {images.map((file, idx) => (
              <li
                key={`${file.name}-${idx}`}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface"
              >
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="size-full object-cover"
                  onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                />
                <button
                  type="button"
                  onClick={() => onRemove(idx)}
                  disabled={busy}
                  aria-label={`Remove ${file.name}`}
                  className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 transition-opacity hover:bg-destructive hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                aria-label="Add another screenshot"
                className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-surface/40 text-muted-foreground transition-colors hover:border-highlight/40 hover:bg-surface-elevated hover:text-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
              >
                <Plus className="size-5" aria-hidden />
                <span className="text-xs">Add one</span>
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// --- Paste mode -------------------------------------------------------------

function PasteMode({
  value,
  onChange,
  busy,
}: {
  value: string;
  onChange: (v: string) => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor="paste-notes" className="sr-only">
        Paste your workout notes
      </label>
      <textarea
        id="paste-notes"
        value={value}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          'Paste your notes here, e.g.\n\n26 Aug 2024 — Push\nBench 5x5: 105x5, 5, 5, 5, 4\nOHP: 70kgx5, 60kgx8'
        }
        rows={12}
        className={cn(
          'w-full resize-y rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-foreground shadow-sm',
          'placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60',
        )}
      />
      <p className="text-xs text-muted-foreground">
        Unrelated notes are filtered out automatically — paste as much as you like.
      </p>
    </div>
  );
}

// --- Video mode -------------------------------------------------------------

function VideoMode({
  file,
  busy,
  onSelect,
}: {
  file: File | null;
  busy: boolean;
  onSelect: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 px-6 py-12 text-center transition-colors',
          'hover:border-highlight/40 hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60',
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-highlight-muted text-highlight">
          {file ? (
            <ScanText className="size-6" strokeWidth={1.75} aria-hidden />
          ) : (
            <Film className="size-6" strokeWidth={1.75} aria-hidden />
          )}
        </span>
        <span className="space-y-1">
          <span className="block text-sm font-semibold text-foreground">
            {file ? file.name : 'Choose a screen recording'}
          </span>
          <span className="block text-xs text-muted-foreground">
            Scroll through your Notes app while recording. .mp4 / .mov
          </span>
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="sr-only"
        onChange={(e) => {
          onSelect(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />

      <div className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/5 p-3 text-xs text-muted-foreground">
        <Badge variant="outline" className="border-warn/40 text-warn">
          Heads up
        </Badge>
        <p className="leading-relaxed">
          iPhone recordings are HEVC. Safari reads them; Chrome often can&apos;t.
          If decoding fails, RepLog will tell you — fall back to screenshots or
          paste, which always work.
        </p>
      </div>
    </div>
  );
}
