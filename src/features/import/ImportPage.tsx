import { Upload } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

/**
 * Import — drop screenshots / screen recordings, or paste note text, then OCR
 * + parse. Placeholder for Wave 2b; the import agent fills it in.
 */
export default function ImportPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Step one"
        title="Import"
        description="Drop a screenshot of your notes, or paste the text. RepLog parses it on-device."
      />
      <EmptyState
        icon={Upload}
        title="Coming soon"
        description="The dropzone, paste box, and parse progress will live here once this page is built."
      />
    </div>
  );
}
