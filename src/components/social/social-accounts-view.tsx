'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, ExternalLink, MessageCircle, Check } from 'lucide-react';
import { addSocialAccount, removeSocialAccount, setSocialAccountActive, setWhatsappNumber } from '@/server/actions/social-accounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const CHANNELS = ['WHATSAPP', 'INSTAGRAM', 'LINKEDIN', 'FACEBOOK', 'TWITTER', 'YOUTUBE', 'GOOGLE', 'WEBSITE', 'OTHER'] as const;
const LABEL: Record<string, string> = {
  WHATSAPP: 'WhatsApp', INSTAGRAM: 'Instagram', LINKEDIN: 'LinkedIn', FACEBOOK: 'Facebook',
  TWITTER: 'X', YOUTUBE: 'YouTube', GOOGLE: 'Google Business', WEBSITE: 'Website', OTHER: 'Other',
};
const PREFIX: Record<string, string> = {
  INSTAGRAM: 'https://instagram.com/', LINKEDIN: 'https://linkedin.com/in/',
  FACEBOOK: 'https://facebook.com/', TWITTER: 'https://x.com/', YOUTUBE: 'https://youtube.com/@',
};

interface Acc { id: string; channel: string; handle: string; profileUrl: string | null; displayName: string | null; isActive: boolean; notes: string | null }
interface Person { id: string; name: string; email: string; designation: string | null; departmentName: string | null; whatsappNumber: string | null; accounts: Acc[] }

export function SocialAccountsView({ people, meId, isAdmin }: { people: Person[]; meId: string; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [open, setOpen] = React.useState<string | null>(null);   // userId we are adding for
  const [wa, setWa] = React.useState<Record<string, string>>(() => Object.fromEntries(people.map((p) => [p.id, p.whatsappNumber ?? ''])));

  const run = (fn: () => Promise<{ ok?: true } | { error: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if ('error' in r && r.error) return toast.error(r.error);
      toast.success(ok); router.refresh(); setOpen(null);
    });

  const link = (a: Acc) => a.profileUrl || (PREFIX[a.channel] ? PREFIX[a.channel] + a.handle : null);

  return (
    <div className="space-y-4">
      <Card className="p-4 text-sm">
        <p className="font-medium">How this works</p>
        <p className="mt-1 text-muted-foreground">
          There is no Business API here — nothing is posted on your behalf and no passwords are stored.
          This records <em>which handle belongs to whom</em>, so an Instagram enquiry can be routed to the right
          person, and so the CRM opens WhatsApp from that person&rsquo;s own number rather than a shared one.
        </p>
      </Card>

      {people.map((p) => (
        <Card key={p.id} className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
            <div>
              <p className="font-medium">{p.name} {p.id === meId && <Badge variant="secondary" className="ml-1 text-[10px]">you</Badge>}</p>
              <p className="text-xs text-muted-foreground">{[p.designation, p.departmentName, p.email].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor={`wa-${p.id}`} className="text-xs">WhatsApp</Label>
              <Input id={`wa-${p.id}`} className="h-8 w-44" placeholder="9876543210"
                value={wa[p.id] ?? ''} onChange={(e) => setWa({ ...wa, [p.id]: e.target.value })}
                disabled={p.id !== meId && !isAdmin} />
              <Button size="sm" variant="outline" className="h-8" disabled={pending || (p.id !== meId && !isAdmin)}
                title="Save the number the CRM opens WhatsApp with for this person"
                onClick={() => run(() => setWhatsappNumber(p.id, wa[p.id] ?? ''), 'Number saved')}>
                <Check className="h-3.5 w-3.5" /> Save
              </Button>
              {p.whatsappNumber && (
                <a href={`https://wa.me/${p.whatsappNumber}`} target="_blank" rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs" title="Open a chat with this person">
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-600" /> Chat
                </a>
              )}
              {(p.id === meId || isAdmin) && (
                <Button size="sm" className="h-8" onClick={() => setOpen(p.id)}><Plus className="h-3.5 w-3.5" /> Add account</Button>
              )}
            </div>
          </div>

          {p.accounts.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No accounts linked yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="p-3">Platform</th><th className="p-3">Handle</th><th className="p-3">Shown as</th><th className="p-3">Notes</th><th className="p-3">Status</th><th className="p-3"></th></tr>
              </thead>
              <tbody>
                {p.accounts.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="p-3"><Badge variant="secondary">{LABEL[a.channel] ?? a.channel}</Badge></td>
                    <td className="p-3 font-medium">
                      {link(a) ? (
                        <a href={link(a)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                          @{a.handle} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : `@${a.handle}`}
                    </td>
                    <td className="p-3 text-muted-foreground">{a.displayName ?? '—'}</td>
                    <td className="p-3 text-xs text-muted-foreground">{a.notes ?? '—'}</td>
                    <td className="p-3">
                      <button className="text-xs underline" disabled={pending || (p.id !== meId && !isAdmin)}
                        title={a.isActive ? 'Stop routing enquiries from this handle' : 'Start routing enquiries from this handle again'}
                        onClick={() => run(() => setSocialAccountActive(a.id, !a.isActive), a.isActive ? 'Paused' : 'Active again')}>
                        <Badge variant={a.isActive ? 'success' : 'secondary'}>{a.isActive ? 'active' : 'paused'}</Badge>
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      {(p.id === meId || isAdmin) && (
                        <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs text-destructive" disabled={pending}
                          title="Unlink this account" onClick={() => run(() => removeSocialAccount(a.id), 'Unlinked')}>
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ))}

      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link a social account</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => addSocialAccount({ ...Object.fromEntries(fd), userId: open }), 'Account linked');
          }}>
            <div className="space-y-1.5"><Label htmlFor="channel">Platform</Label>
              <select id="channel" name="channel" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                {CHANNELS.map((c) => <option key={c} value={c}>{LABEL[c]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="handle">Handle or number</Label><Input id="handle" name="handle" required placeholder="ameyaheights" /></div>
            <div className="space-y-1.5"><Label htmlFor="profileUrl">Profile link <span className="font-normal opacity-70">(optional)</span></Label><Input id="profileUrl" name="profileUrl" placeholder="https://instagram.com/ameyaheights" /></div>
            <div className="space-y-1.5"><Label htmlFor="notes">Notes <span className="font-normal opacity-70">(optional)</span></Label><Input id="notes" name="notes" placeholder="Handles NRI enquiries" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(null)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Link it</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
