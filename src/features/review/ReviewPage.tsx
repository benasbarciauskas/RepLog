import { ClipboardCheck } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

/**
 * Review — editable parsed-workout cards before they are saved. Placeholder
 * for Wave 2b; the review agent fills it in.
 */
export default function ReviewPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Step two"
        title="Review"
        description="Check the parsed workouts, fix anything off, then confirm to save."
      />
      <EmptyState
        icon={ClipboardCheck}
        title="Coming soon"
        description="Editable workout cards and the confirm-to-save flow will live here once this page is built."
      />
    </div>
  );
}
