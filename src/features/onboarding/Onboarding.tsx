import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ClipboardType,
  Film,
  Filter,
  ImagePlus,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'replog.onboarding.dismissed';

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

interface Step {
  icon: ComponentType<LucideProps>;
  title: string;
  body: ReactNode;
}

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: 'Your notes, read like a coach',
    body: (
      <>
        RepLog turns the messy workout notes on your phone into structured
        training data, then surfaces your all-time bests, your split history, and
        what is holding you back. Everything runs on your device. Nothing is
        uploaded, no account, no cost.
      </>
    ),
  },
  {
    icon: ImagePlus,
    title: 'Three ways to bring them in',
    body: (
      <>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <ImportIcon icon={ImagePlus} />
            <span>
              <span className="font-medium text-foreground">Screenshots</span>{' '}
              of your Notes app. RepLog reads the text on-device.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <ImportIcon icon={ClipboardType} />
            <span>
              <span className="font-medium text-foreground">Paste</span> raw
              text straight in.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <ImportIcon icon={Film} />
            <span>
              <span className="font-medium text-foreground">Video</span> of you
              scrolling through your notes.{' '}
              <span className="text-warn">Works best in Safari</span> &mdash;
              iPhone recordings are HEVC, which Chrome often cannot decode.
            </span>
          </li>
        </ul>
      </>
    ),
  },
  {
    icon: Filter,
    title: 'Paste anything, keep what counts',
    body: (
      <>
        Drop in whole notes, grocery lists and all. RepLog automatically filters
        out anything that is not a workout, then shows you the parsed sessions to{' '}
        <span className="font-medium text-foreground">review and fix</span>{' '}
        before they are saved. You are always in control of what gets logged.
      </>
    ),
  },
];

/** Small framed icon used inside the import-modes list. */
function ImportIcon({ icon: Icon }: { icon: ComponentType<LucideProps> }) {
  return (
    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-highlight-muted text-highlight">
      <Icon className="size-4" strokeWidth={1.75} aria-hidden />
    </span>
  );
}

/**
 * First-run onboarding overlay. Three steps that explain what RepLog does, the
 * three import modes (with the Safari-for-video caveat), and the
 * paste-anything / auto-filter / review-and-save flow. Dismissal persists in
 * localStorage so it shows once. Animated, reduced-motion safe, responsive
 * (bottom sheet on mobile, centered card on sm+).
 */
export function Onboarding() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      // localStorage unavailable (private mode / SSR) — skip onboarding.
    }
  }, []);

  // Esc to skip.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setOpen(false);
  }

  function next() {
    if (step >= STEPS.length - 1) dismiss();
    else setStep((s) => s + 1);
  }

  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-title"
          onClick={(e) => {
            // Click the scrim (not the card) to dismiss.
            if (e.target === e.currentTarget) dismiss();
          }}
        >
          <motion.div
            className="relative w-full max-w-md rounded-2xl border border-border bg-surface-elevated p-6 shadow-xl"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
          >
            <button
              type="button"
              onClick={dismiss}
              className="absolute right-4 top-4 rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="Skip onboarding"
            >
              <X className="size-5" aria-hidden />
            </button>

            {/* Animate the step body so progression feels like movement, not a
                flash. Opacity + small y; reduced motion collapses to a fade. */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: EASE_OUT }}
              >
                <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-highlight-muted text-highlight">
                  <Icon className="size-6" strokeWidth={1.75} aria-hidden />
                </div>

                <h2
                  id="onboarding-title"
                  className="text-xl font-semibold tracking-tight text-foreground"
                >
                  {current.title}
                </h2>
                <div className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {current.body}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex items-center justify-between">
              <div className="flex gap-1.5" aria-hidden>
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={
                      i === step
                        ? 'h-1.5 w-5 rounded-full bg-highlight transition-all'
                        : 'h-1.5 w-1.5 rounded-full bg-border transition-all'
                    }
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {isFirst ? (
                  <Button variant="ghost" size="sm" onClick={dismiss}>
                    Skip
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={back}>
                    Back
                  </Button>
                )}
                <Button size="sm" onClick={next}>
                  {isLast ? (
                    <>
                      <Trophy aria-hidden /> Start logging
                    </>
                  ) : (
                    'Next'
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Exposed so a "show me the intro again" affordance could clear it later. */
export const ONBOARDING_STORAGE_KEY = STORAGE_KEY;
