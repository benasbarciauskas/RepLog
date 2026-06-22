import { ListChecks } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

/**
 * Placeholder for routines/templates (v1.1, next wave). Routines are reusable
 * workout templates you can start a session from; CRUD + "save session as
 * routine" arrive with the live logger.
 */
export default function RoutinesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Templates"
        title="Routines"
        description="Reusable workout templates — start a session from one, or save a session as a new routine."
      />
      <EmptyState
        icon={ListChecks}
        title="Routines are coming soon"
        description="Build a routine once and start future workouts from it in a tap. You'll be able to create, edit and reorder routines, and save any finished session as a new template."
      />
    </div>
  );
}
