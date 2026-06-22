import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Upload, ClipboardCheck, Target, X } from 'lucide-react';
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'replog.onboarding.dismissed';

interface Step {
  icon: ComponentType<LucideProps>;
  title: string;
  body: string;
}

// Minimal copy — Wave 3 finalizes wording.
const STEPS: Step[] = [
  {
    icon: Upload,
    title: 'Bring your notes',
    body: 'Drop a screenshot of your workout notes, or paste the text. Everything is parsed on your device.',
  },
  {
    icon: ClipboardCheck,
    title: 'Review and save',
    body: 'RepLog turns the mess into structured workouts. Fix anything off, then confirm to save.',
  },
  {
    icon: Target,
    title: 'Meet your coach',
    body: 'See all-time bests, track PRs, and find the lifts holding you back.',
  },
];

/**
 * First-run onboarding overlay. Three steps, dismissal persisted in
 * localStorage. Minimal by design — Wave 3 finalizes copy and visuals.
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

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

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
          aria-label="Welcome to RepLog"
        >
          <motion.div
            className="relative w-full max-w-md rounded-2xl border border-border bg-surface-elevated p-6 shadow-xl"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
          >
            <button
              type="button"
              onClick={dismiss}
              className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Skip onboarding"
            >
              <X className="size-5" aria-hidden />
            </button>

            <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-highlight-muted text-highlight">
              <Icon className="size-6" strokeWidth={1.75} aria-hidden />
            </div>

            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {current.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{current.body}</p>

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
                <Button variant="ghost" size="sm" onClick={dismiss}>
                  Skip
                </Button>
                <Button size="sm" onClick={next}>
                  {isLast ? 'Get started' : 'Next'}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
