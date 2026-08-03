'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { createCalendarEvent } from '@/server/actions/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const selectCls = 'flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm';

const TYPES: Array<[string, string]> = [
  ['MEETING', 'Meeting'],
  ['SITE_VISIT', 'Site visit'],
  ['DEADLINE', 'Deadline'],
  ['MILESTONE', 'Milestone'],
  ['HOLIDAY', 'Holiday'],
  ['REMINDER', 'Reminder'],
];

/**
 * Put a meeting in the calendar.
 *
 * The month grid drew events from day one and there was no way to add one — the
 * only things it could ever show were tasks and follow-ups created elsewhere.
 */
export function NewEventDialog({ projects, users }: {
  projects: { id: string; name: string }[];
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [attendeeIds, setAttendeeIds] = React.useState<string[]>([]);
  const [allDay, setAllDay] = React.useState(false);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createCalendarEvent({
        title: fd.get('title'),
        description: fd.get('description'),
        type: fd.get('type'),
        projectId: fd.get('projectId') || null,
        location: fd.get('location'),
        startAt: fd.get('startAt'),
        endAt: fd.get('endAt') || null,
        allDay,
        attendeeIds,
      });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Added to the calendar');
      setOpen(false); setAttendeeIds([]); setAllDay(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><CalendarPlus className="h-4 w-4" /> New event</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>New calendar event</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="evtitle">Title</Label><Input id="evtitle" name="title" required placeholder="Slab pour review — Tower B" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="evtype">Type</Label>
                <select id="evtype" name="type" className={selectCls} defaultValue="MEETING">
                  {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="evproject">Project</Label>
                <select id="evproject" name="projectId" className={selectCls} defaultValue="">
                  <option value="">—</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-[hsl(var(--primary))]" />
              All day
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="evstart">Starts</Label>
                <Input id="evstart" name="startAt" type={allDay ? 'date' : 'datetime-local'} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evend">Ends (optional)</Label>
                <Input id="evend" name="endAt" type={allDay ? 'date' : 'datetime-local'} />
              </div>
            </div>

            <div className="space-y-2"><Label htmlFor="evloc">Where</Label><Input id="evloc" name="location" placeholder="Site office / Google Meet" /></div>
            <div className="space-y-2"><Label htmlFor="evdesc">Notes</Label><Input id="evdesc" name="description" placeholder="What it is about" /></div>

            {users.length > 0 && (
              <div className="space-y-2">
                <Label>Who is coming</Label>
                <div className="flex flex-wrap gap-2">
                  {users.map((u) => (
                    <label key={u.id} className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${attendeeIds.includes(u.id) ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
                      <input
                        type="checkbox" className="hidden"
                        checked={attendeeIds.includes(u.id)}
                        onChange={(e) => setAttendeeIds((p) => e.target.checked ? [...p, u.id] : p.filter((id) => id !== u.id))}
                      />
                      {u.name}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">You are added automatically as the organiser.</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Add to calendar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
