import { useParams } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

/**
 * Exercise detail — progression + PR history for one lift (route /exercise/:id).
 * Placeholder for Wave 2b; the exercise agent fills it in.
 */
export default function ExercisePage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <PageHeader
        eyebrow="Exercise"
        title={id ?? 'Exercise'}
        description="Top-set progression, est. 1RM over time, and your PR history."
      />
      <EmptyState
        icon={Dumbbell}
        title="Coming soon"
        description="The progression chart and PR history for this lift will live here once this page is built."
      />
    </div>
  );
}
