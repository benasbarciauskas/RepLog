import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { repository } from '@/data/repository';
import { SAMPLE_WORKOUTS } from '@/data/sampleData';

/**
 * "Try with sample data" — seeds the demo workouts so a first-time user can see
 * the dashboard, PR grid, and coach light up without importing anything. The
 * live Dexie hooks (useWorkouts etc.) repaint automatically on the write.
 */
export function TrySampleDataButton({
  variant = 'default',
}: {
  variant?: 'default' | 'outline';
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const seed = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await repository.saveWorkouts(SAMPLE_WORKOUTS);
      toast.success('Loaded sample data', {
        description: 'A few demo workouts so you can explore. Clear it anytime.',
      });
      navigate('/');
    } catch (err) {
      toast.error('Could not load sample data', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant={variant} onClick={seed} disabled={busy}>
      <Sparkles aria-hidden />
      {busy ? 'Loading…' : 'Try with sample data'}
    </Button>
  );
}

/**
 * "Clear all data" — wipes every stored workout, note, and custom exercise
 * after an explicit confirm. Irreversible (data is on-device only), so it is
 * gated behind a destructive dialog.
 */
export function ClearAllDataButton({
  variant = 'ghost',
  size = 'sm',
}: {
  variant?: 'ghost' | 'outline';
  size?: 'sm' | 'default';
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const clear = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await repository.clearAll();
      toast.success('All data cleared', {
        description: 'Your workouts, notes, and custom exercises were removed.',
      });
      setOpen(false);
    } catch (err) {
      toast.error('Could not clear data', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 aria-hidden /> Clear all data
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear all data?</DialogTitle>
          <DialogDescription>
            This permanently removes every workout, imported note, and custom
            exercise from this browser. It cannot be undone, and nothing is
            backed up anywhere (RepLog is on-device only).
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={clear}
            disabled={busy}
          >
            <Trash2 aria-hidden />
            {busy ? 'Clearing…' : 'Clear everything'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
