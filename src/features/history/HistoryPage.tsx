import { History } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

/**
 * Placeholder for the workout history list (v1.1, next wave). A reverse-chrono
 * list of every saved workout, each opening a workout-detail view. Data already
 * exists (all saved Workouts); the dedicated list + detail UI lands next.
 */
export default function HistoryPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Your log"
        title="History"
        description="Every workout you've logged, newest first — tap one to see the full session."
      />
      <EmptyState
        icon={History}
        title="The history view is coming soon"
        description="A full, scrollable record of every workout with per-session set detail. Your saved workouts already power the dashboard and exercise charts — this puts them all in one place."
      />
    </div>
  );
}
