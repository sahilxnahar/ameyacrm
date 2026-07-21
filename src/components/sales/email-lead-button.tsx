'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Mail, Loader2 } from 'lucide-react';
import { sendLeadEmail } from '@/server/actions/comms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function EmailLeadButton({ leadId, email, name }: { leadId: string; email: string | null; name: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  if (!email) return null;
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await sendLeadEmail({ leadId, subject: fd.get('subject'), body: fd.get('body') });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Email sent'); setOpen(false); router.refresh();
    });
  };
  return (
    <>
      <Button size="sm" variant="outline" className="mt-2" onClick={() => setOpen(true)}><Mail className="h-4 w-4" /> Email</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Email {name}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <p className="text-xs text-muted-foreground">To: {email}</p>
            <div className="space-y-1"><Label htmlFor="subject">Subject</Label><Input id="subject" name="subject" required defaultValue="Ameya Heights — your enquiry" /></div>
            <div className="space-y-1"><Label htmlFor="body">Message</Label><Textarea id="body" name="body" rows={7} required defaultValue={`Dear ${name},\n\nThank you for your interest in Ameya Heights.\n\n`} /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Send</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
