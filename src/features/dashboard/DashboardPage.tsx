import { TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

/**
 * Dashboard ("My Times") — all-time bests, PR timeline, bodyweight trend,
 * split history. Placeholder for Wave 2b; the data agent fills it in.
 */
export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Your numbers"
        title="Dashboard"
        description="All-time bests, PR timeline, and your training history at a glance."
      />
      <EmptyState
        icon={TrendingUp}
        title="Coming soon"
        description="Your all-time bests, est. 1RMs, and progression charts will live here once this page is built."
      />
    </div>
  );
}
