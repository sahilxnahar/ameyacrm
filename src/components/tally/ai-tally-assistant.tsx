'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Sparkles, Loader2, ArrowRight, CheckCircle2, AlertTriangle, Plus } from 'lucide-react';
import { GROUP_NAMES } from '@/config/tally-groups';
import { aiTallyCommand, type VoucherDraft } from '@/server/actions/ai-tally';
import { createTallyVoucher, createTallyLedger } from '@/server/actions/tally';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

const EXAMPLES = [
  'Paid ₹50,000 to ABC Cement by bank for cement',
  'Received ₹2,00,000 from Rakesh Kumar towards booking, in cash',
  'Transfer ₹1,00,000 from cash to HDFC bank',
];

export function AiTallyAssistant({ onPosted }: { onPosted?: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [prompt, setPrompt] = React.useState('');
  const [busy, setBusy] = React.useState<'draft' | 'post' | 'ledger' | null>(null);
  const [draft, setDraft] = React.useState<VoucherDraft | null>(null);
  const [groups, setGroups] = React.useState<Record<string, string>>({}); // ledgerName -> chosen group

  const reset = () => { setPrompt(''); setDraft(null); setGroups({}); setBusy(null); };
  const close = () => { setOpen(false); reset(); };

  const runDraft = async () => {
    if (!prompt.trim()) { toast.error('Type what you want to record.'); return; }
    setBusy('draft'); setDraft(null);
    const r = await aiTallyCommand(prompt);
    setBusy(null);
    if ('error' in r) { toast.error(r.error); return; }
    setDraft(r.draft);
    // Pre-pick a group guess for any missing ledger.
    const g: Record<string, string> = {};
    for (const name of r.draft.needLedgers) g[name] = guessGroup(name, r.draft);
    setGroups(g);
  };

  const createLedger = async (name: string) => {
    const group = groups[name];
    if (!group) { toast.error('Pick a group for this ledger.'); return; }
    setBusy('ledger');
    const r = await createTallyLedger({ name, group });
    setBusy(null);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success(`Ledger "${name}" created`);
    // Re-draft so the new ledger resolves into the entry.
    await runDraft();
  };

  const post = async () => {
    if (!draft) return;
    if (!draft.balanced) { toast.error('The entry does not balance yet.'); return; }
    if (draft.needLedgers.length) { toast.error('Create the missing ledgers first.'); return; }
    setBusy('post');
    const r = await createTallyVoucher({
      type: draft.type,
      date: draft.date,
      narration: draft.narration,
      reference: draft.reference,
      lines: draft.lines.map((l) => ({ ledgerId: l.ledgerId!, debit: l.debit, credit: l.credit })),
    });
    setBusy(null);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success(`${draft.type} voucher posted`);
    onPosted?.();
    close();
  };

  const canPost = Boolean(draft && draft.balanced && draft.needLedgers.length === 0 && draft.lines.length >= 2);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} title="Describe an entry in plain words and let AI draft the voucher">
        <Sparkles className="h-4 w-4" /> Ask AI
      </Button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Ask AI to make an entry</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Describe the payment or receipt in plain words. The AI drafts a balanced voucher; nothing is posted until you press <b>Post</b>.</p>

            <form onSubmit={(e) => { e.preventDefault(); void runDraft(); }} className="flex gap-2">
              <Input autoFocus value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Paid ₹50,000 to ABC Cement by bank" />
              <Button type="submit" disabled={busy !== null}>{busy === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Draft</Button>
            </form>

            {!draft && (
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button key={ex} onClick={() => setPrompt(ex)} className="rounded-full border border-input px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-secondary">{ex}</button>
                ))}
              </div>
            )}

            {draft?.clarification && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>{draft.clarification}</span>
              </div>
            )}

            {draft && draft.lines.length > 0 && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-md bg-[#1B2A4A]/10 px-2 py-0.5 font-medium text-[#1B2A4A] dark:text-foreground">{draft.type}</span>
                  <span className="text-muted-foreground">{draft.date}</span>
                  {draft.balanced
                    ? <span className="ml-auto flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Balances</span>
                    : <span className="ml-auto flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> Dr ₹{inr.format(draft.totalDr)} ≠ Cr ₹{inr.format(draft.totalCr)}</span>}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-[11px] uppercase text-muted-foreground"><th className="py-1 text-left font-medium">Ledger</th><th className="py-1 text-right font-medium">Debit</th><th className="py-1 text-right font-medium">Credit</th></tr></thead>
                    <tbody>
                      {draft.lines.map((l, i) => (
                        <tr key={i} className="border-t">
                          <td className="py-1.5">
                            {l.ledgerName}
                            {!l.ledgerId && <span className="ml-1 rounded bg-amber-500/15 px-1 text-[10px] text-amber-700">new</span>}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{l.debit ? `₹${inr.format(l.debit)}` : ''}</td>
                          <td className="py-1.5 text-right tabular-nums">{l.credit ? `₹${inr.format(l.credit)}` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {draft.narration && <p className="text-xs text-muted-foreground"><span className="font-medium">Narration:</span> {draft.narration}</p>}

                {draft.needLedgers.length > 0 && (
                  <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2">
                    <p className="text-xs font-medium">These ledgers don’t exist yet — pick a group and create them:</p>
                    {draft.needLedgers.map((name) => (
                      <div key={name} className="flex flex-wrap items-center gap-2">
                        <span className="text-sm">{name}</span>
                        <select value={groups[name] ?? ''} onChange={(e) => setGroups((g) => ({ ...g, [name]: e.target.value }))} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                          <option value="">Group…</option>
                          {GROUP_NAMES.map((gn) => <option key={gn} value={gn}>{gn}</option>)}
                        </select>
                        <Button size="sm" variant="outline" disabled={busy !== null || !groups[name]} onClick={() => void createLedger(name)}>
                          {busy === 'ledger' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t pt-2">
                  <Button variant="outline" size="sm" onClick={reset} disabled={busy !== null}>Start over</Button>
                  <Button size="sm" onClick={() => void post()} disabled={!canPost || busy !== null}>
                    {busy === 'post' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Post voucher
                  </Button>
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">The assistant only drafts — you always confirm before anything is written to the books, and every posted voucher is audited like any manual entry.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** A quick group guess for a missing ledger, from the words in its name. */
function guessGroup(name: string, draft: VoucherDraft): string {
  const n = name.toLowerCase();
  if (/bank|hdfc|icici|sbi|axis|kotak/.test(n)) return 'Bank Accounts';
  if (/cash/.test(n)) return 'Cash-in-Hand';
  if (/gst|tax|tds/.test(n)) return 'Duties & Taxes';
  if (/sales|revenue/.test(n)) return 'Sales Accounts';
  if (/purchase/.test(n)) return 'Purchase Accounts';
  // On a Payment the "new" ledger is usually what was paid for (an expense);
  // on a Receipt it's usually who paid (a debtor).
  if (draft.type === 'Receipt') return 'Sundry Debtors';
  if (draft.type === 'Payment') return 'Indirect Expenses';
  return 'Current Assets';
}
