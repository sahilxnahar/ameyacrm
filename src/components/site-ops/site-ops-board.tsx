'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { DailyLogForm } from './daily-log-form';
import { ProgressTimeline, type TimelineLog } from './progress-timeline';

/**
 * Site Ops board — mounts the chronological ProgressTimeline plus the entry
 * points to log a new day: a header button on desktop and a thumb-reachable FAB
 * on mobile. The form opens in a BottomSheet, which renders as a bottom sheet on
 * phones and a centred modal on wider screens (see <BottomSheet/>). The FAB sits
 * above the mobile dock and clears the iOS home indicator via safe-area insets.
 */
export function SiteOpsBoard({
  projects,
  activeProjectId,
  logs,
}: {
  projects: { id: string; name: string }[];
  activeProjectId: string | null;
  logs: TimelineLog[];
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  const onSaved = React.useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{logs.length} log{logs.length === 1 ? '' : 's'} on record</p>
        <Button onClick={() => setOpen(true)} className="hidden gap-1 md:inline-flex"><Plus className="h-4 w-4" /> New site log</Button>
      </div>

      <ProgressTimeline logs={logs} />

      {/* Mobile FAB — above the dock, above the home indicator, below any modal. */}
      <button
        type="button"
        aria-label="New site log"
        onClick={() => setOpen(true)}
        className="fixed right-4 z-dock inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 md:hidden"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        <Plus className="h-6 w-6" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="New site log">
        <div className="max-h-[78vh] overflow-y-auto pr-0.5">
          <DailyLogForm projects={projects} activeProjectId={activeProjectId} onSaved={onSaved} />
        </div>
      </BottomSheet>
    </div>
  );
}
