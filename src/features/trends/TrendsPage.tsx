import { TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { useWorkouts } from '@/data/hooks';
import { PrTimeline } from './PrTimeline';
import { BlockCompare } from './BlockCompare';

export default function TrendsPage() {
  const workouts = useWorkouts();

  if (workouts.length < 2) {
    return (
      <div>
        <PageHeader
          eyebrow="Progress"
          title="Trends"
          description="Personal records over time and side-by-side training block comparisons."
        />
        <EmptyState
          icon={TrendingUp}
          title="Not enough data yet"
          description="Import or log a few workouts to see trends."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Progress"
        title="Trends"
        description="Personal records over time and side-by-side training block comparisons."
      />

      <div className="space-y-12">
        <PrTimeline workouts={workouts} />
        <BlockCompare workouts={workouts} />
      </div>
    </div>
  );
}