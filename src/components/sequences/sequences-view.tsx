'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2, Plus, Play, Pause, Trash2, Mail, MailOpen, MessageSquareReply, AlertTriangle, X } from 'lucide-react';
import { createSequence, addStep, deleteStep, setSequenceStatus, stopEnrollment } from '@/server/actions/sequences';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils/cn';

interface Step { id: string; ordinal: number; dayOffset: number; subject: string; body: string }
interface Seq {
  id: string; name: string; description: string | null; status: string;
  stopOnReply: boolean; stopOnStage: string | null;
  steps: Step[]; running: number; replied: number; finished: number;
}
interface Enrol { id: string; sequenceName: string; leadName: string; status: string; stepsSent: number; nextStepAt: string | null; endReason: string | null }

const TONE: Record<string, 'success' | 'secondary' | 'warning' | 'destructive'> = {
  RUNNING: 'warning', REPLIED: 'success', FINISHED: 'secondary', STOPPED: 'destructive',
};

export function SequencesView({
  sequences, recent, canManage, emailWorking, sent, opened,
}: {
  sequences: Seq[]; recent: Enrol[]; canManage: boolean; emailWorking: boolean; sent: number; opened: number;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [newOpen, setNewOpen] = React.useState(false);
  const [stepFor, setStepFor] = React.useState<string | null>(null);

  const run = (fn: () => Promise<{ ok?: true; message?: string } | { error: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if ('error' in r && r.error) { toast.error(r.error); return; }
      toast.success(('message' in r && r.message) || ok);
      router.refresh(); setNewOpen(false); setStepFor(null);
    });

  const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;

  return (
    <div className="space-y-5">
      {!emailWorking && (
        <Card className="flex items-start gap-2 border-warning/40 bg-warning/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>Outbound email is not configured, so nothing will actually send. Set <code className="text-xs">EMAIL_PROVIDER=smtp</code> in Vercel first.</span>
        </Card>
      )}

      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat icon={Mail} label="Sent by sequences" value={String(sent)} />
        <Stat icon={MailOpen} label="Opened" value={`${openRate}%`} hint={`${opened} of ${sent}`} />
        <Stat icon={MessageSquareReply} label="Replied and exited" value={String(sequences.reduce((n, s) => n + s.replied, 0))} />
        <Stat icon={Play} label="Currently running" value={String(sequences.reduce((n, s) => n + s.running, 0))} />
      </div>

      {canManage && (
        <div><Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New sequence</Button></div>
      )}

      {sequences.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No sequences yet. A good first one: three emails over ten days for enquiries that went quiet.
        </Card>
      ) : (
        <div className="space-y-3">
          {sequences.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {s.name}
                    <Badge variant={s.status === 'ACTIVE' ? 'success' : 'secondary'}>{s.status.toLowerCase()}</Badge>
                    {s.stopOnReply && <Badge variant="outline" className="text-[10px]">stops on reply</Badge>}
                    {s.stopOnStage && <Badge variant="outline" className="text-[10px]">stops at {s.stopOnStage.toLowerCase()}</Badge>}
                  </p>
                  {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
                  <p className="mt-1 text-xs text-muted-foreground tabular">
                    {s.steps.length} step{s.steps.length === 1 ? '' : 's'} · {s.running} running · {s.replied} replied · {s.finished} finished
                  </p>
                </div>
                {canManage && (
                  <span className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pending} onClick={() => setStepFor(s.id)}>
                      <Plus className="h-3.5 w-3.5" /> Add step
                    </Button>
                    <Button size="sm" variant={s.status === 'ACTIVE' ? 'outline' : 'default'} className="h-7 px-2 text-xs" disabled={pending}
                      title={s.status === 'ACTIVE' ? 'Stop sending — enrolments are kept' : 'Start sending'}
                      onClick={() => run(() => setSequenceStatus(s.id, s.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'), 'Updated')}>
                      {s.status === 'ACTIVE' ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Switch on</>}
                    </Button>
                  </span>
                )}
              </div>

              {s.steps.length > 0 && (
                <ol className="mt-3 space-y-2 border-t pt-3">
                  {s.steps.map((t) => (
                    <li key={t.id} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-medium tabular">
                        {t.dayOffset === 0 ? 'D0' : `D${t.dayOffset}`}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{t.subject}</span>
                        <span className="block truncate text-xs text-muted-foreground">{t.body.slice(0, 110)}</span>
                      </span>
                      {canManage && (
                        <button className="shrink-0 rounded p-1 text-destructive hover:bg-secondary" title="Remove this step"
                          onClick={() => run(() => deleteStep(t.id), 'Step removed')}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">Who is in a sequence</p>
          <Card className="table-scroll">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="p-3">Person</th><th className="p-3">Sequence</th><th className="p-3 text-right">Sent</th><th className="p-3">Next</th><th className="p-3">Status</th><th className="p-3"></th></tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{r.leadName}</td>
                    <td className="p-3 text-muted-foreground">{r.sequenceName}</td>
                    <td className="p-3 text-right tabular">{r.stepsSent}</td>
                    <td className="p-3 text-xs text-muted-foreground">{r.nextStepAt ? format(new Date(r.nextStepAt), 'd MMM') : '—'}</td>
                    <td className="p-3">
                      <Badge variant={TONE[r.status] ?? 'secondary'}>{r.status.toLowerCase()}</Badge>
                      {r.endReason && <span className="block text-[11px] text-muted-foreground">{r.endReason}</span>}
                    </td>
                    <td className="p-3 text-right">
                      {canManage && r.status === 'RUNNING' && (
                        <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs" disabled={pending}
                          title="Take this person out of the sequence" onClick={() => run(() => stopEnrollment(r.id), 'Stopped')}>
                          <X className="h-3.5 w-3.5" /> Stop
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New sequence</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault(); const fd = new FormData(e.currentTarget);
            run(() => createSequence({
              name: fd.get('name'), description: fd.get('description'),
              stopOnReply: fd.get('stopOnReply') === 'on',
              stopOnStage: fd.get('stopOnStage'),
            }), 'Sequence created — now add its steps');
          }}>
            <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" name="name" required placeholder="Quiet enquiry — 3 emails over 10 days" /></div>
            <div className="space-y-1.5"><Label htmlFor="description">What is it for?</Label><Input id="description" name="description" placeholder="Enquiries that went cold after a site visit" /></div>
            <div className="space-y-1.5"><Label htmlFor="stopOnStage">Also stop when the lead reaches</Label>
              <select id="stopOnStage" name="stopOnStage" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">— nothing —</option>
                {['SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'WON'].map((x) => <option key={x} value={x}>{x.replace(/_/g, ' ').toLowerCase()}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="stopOnReply" defaultChecked /> Stop the moment they reply</label>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Create</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={stepFor !== null} onOpenChange={(v) => !v && setStepFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a step</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault(); const fd = new FormData(e.currentTarget);
            run(() => addStep({ sequenceId: stepFor, dayOffset: fd.get('dayOffset'), subject: fd.get('subject'), body: fd.get('body') }), 'Step added');
          }}>
            <div className="space-y-1.5"><Label htmlFor="dayOffset">Send how many days after enrolment?</Label>
              <Input id="dayOffset" name="dayOffset" type="number" min={0} max={180} defaultValue={0} required />
              <p className="text-xs text-muted-foreground">0 means the same day.</p>
            </div>
            <div className="space-y-1.5"><Label htmlFor="subject">Subject</Label><Input id="subject" name="subject" required placeholder="Still thinking about {{project}}?" /></div>
            <div className="space-y-1.5"><Label htmlFor="body">Message</Label>
              <Textarea id="body" name="body" rows={7} required placeholder={'Dear {{firstName}},\n\nJust following up on your visit to {{project}}...'} />
              <p className="text-xs text-muted-foreground">
                You can use <code>{'{{firstName}}'}</code>, <code>{'{{name}}'}</code>, <code>{'{{project}}'}</code>, <code>{'{{companyName}}'}</code>, <code>{'{{website}}'}</code>.
              </p>
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setStepFor(null)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Add step</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: string; hint?: string }) {
  return (
    <Card className="p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</p>
      <p className={cn('font-display text-2xl font-semibold tabular')}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}
