import { Target } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

/**
 * Coach ("What's Lacking") — strength-imbalance findings + muscle coverage.
 * Placeholder for Wave 2b; the coach agent fills it in.
 */
export default function CoachPage() {
  return (
    <div>
      <PageHeader
        eyebrow="What's lacking"
        title="Coach"
        description="Where your lifts are out of balance, and the muscles that need attention."
      />
      <EmptyState
        icon={Target}
        title="Coming soon"
        description="Imbalance findings, the antagonist comparisons, and muscle coverage will live here once this page is built."
      />
    </div>
  );
}
