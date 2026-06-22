import { Dumbbell } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

/**
 * Placeholder for the live workout logger (v1.1, next wave). The data model,
 * persistence, hooks and route are wired now; the Strong-style logging UI —
 * set rows, rest timer, plate calculator, elapsed timer — lands next.
 */
export default function LoggerPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Live logger"
        title="Log"
        description="Start a workout, add exercises, and log every set as you train."
      />
      <EmptyState
        icon={Dumbbell}
        title="The live logger is coming soon"
        description="Soon you'll start a blank workout or pick a routine, log sets with a rest timer and plate calculator, and save it straight to your history. For now, import your existing notes to fill your log."
      />
    </div>
  );
}
