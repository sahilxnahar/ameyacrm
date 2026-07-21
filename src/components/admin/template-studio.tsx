'use client';

import { useMemo, useState, useTransition } from 'react';
import { MessageSquare, Mail, Smartphone, FileText, Plus, Trash2, Send, Loader2, AlertTriangle, Info, Copy, Check } from 'lucide-react';
import { saveTemplate, deleteTemplate, submitToMeta } from '@/server/actions/templates';
import { validate, preview, smsSegments, type Issue } from '@/lib/templates/engine';
import { MERGE_FIELDS, CHANNELS, WA_CATEGORIES } from '@/config/merge-fields';

export interface TemplateRow {
  id: string; key: string; name: string; channel: string; category: string | null;
  language: string; subject: string | null; header: string | null; body: string; footer: string | null;
  buttons: Array<{ type: 'QUICK_REPLY' | 'URL'; text: string; url?: string }>;
  description: string | null; metaStatus: string | null; metaRejection: string | null; usageCount: number;
}

const ICON: Record<string, typeof Mail> = { WHATSAPP: MessageSquare, EMAIL: Mail, SMS: Smartphone, LETTER: FileText };
const META_BADGE: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PENDING: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-500',
  APPROVED: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400',
  REJECTED: 'bg-destructive/10 text-destructive',
};
const BLANK: TemplateRow = {
  id: '', key: '', name: '', channel: 'WHATSAPP', category: 'UTILITY', language: 'en',
  subject: '', header: '', body: '', footer: '', buttons: [], description: '',
  metaStatus: null, metaRejection: null, usageCount: 0,
};

export function TemplateStudio({ templates, whatsappConnected }: { templates: TemplateRow[]; whatsappConnected: boolean }) {
  const [rows, setRows] = useState(templates);
  const [draft, setDraft] = useState<TemplateRow | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [payload, setPayload] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const issues: Issue[] = useMemo(() => (draft ? validate(draft) : []), [draft]);
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  const shown = useMemo(() => (draft ? preview(draft) : null), [draft]);

  const set = <K extends keyof TemplateRow>(k: K, v: TemplateRow[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const insert = (token: string) => setDraft((d) => (d ? { ...d, body: `${d.body}{{${token}}}` } : d));

  const save = () => start(async () => {
    if (!draft) return;
    setPayload(null);
    const res = await saveTemplate({ ...draft, id: draft.id || undefined });
    if ('error' in res) { setMsg({ kind: 'err', text: res.error }); return; }
    setMsg({ kind: 'ok', text: res.message });
    setRows((rs) => { const next = { ...draft, id: res.id }; return rs.some((r) => r.id === res.id) ? rs.map((r) => (r.id === res.id ? next : r)) : [...rs, next]; });
    setDraft(null);
  });

  const remove = (t: TemplateRow) => start(async () => {
    const res = await deleteTemplate(t.id);
    if ('error' in res) { setMsg({ kind: 'err', text: res.error }); return; }
    setRows((rs) => rs.filter((r) => r.id !== t.id));
    setMsg({ kind: 'ok', text: res.message });
    setDraft(null);
  });

  const submit = (t: TemplateRow) => start(async () => {
    setPayload(null);
    const res = await submitToMeta(t.id);
    if ('error' in res) { setMsg({ kind: 'err', text: res.error }); if (res.payload) setPayload(res.payload); return; }
    setMsg({ kind: 'ok', text: res.message });
    setRows((rs) => rs.map((r) => (r.id === t.id ? { ...r, metaStatus: 'PENDING' } : r)));
  });

  const grouped = CHANNELS.map((c) => ({ ...c, items: rows.filter((r) => r.channel === c.key) }));
  const seg = draft?.channel === 'SMS' ? smsSegments(draft.body) : null;

  return (
    <div className="space-y-5">
      {msg && (
        <div className={`rounded-md p-3 text-sm ${msg.kind === 'ok' ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'}`}>{msg.text}</div>
      )}

      {payload && (
        <div className="card-elevated p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Paste this into Meta Business Manager</p>
            <button type="button" onClick={() => { navigator.clipboard.writeText(payload); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="focus-ring inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-muted">
              {copied ? <><Check className="h-3.5 w-3.5" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
            </button>
          </div>
          <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">{payload}</pre>
        </div>
      )}

      {!draft && (
        <>
          <button type="button" onClick={() => { setDraft(BLANK); setMsg(null); setPayload(null); }} className="focus-ring inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            <Plus className="h-4 w-4" />New template
          </button>
          {grouped.map((g) => {
            const Icon = ICON[g.key] ?? Mail;
            return (
              <section key={g.key} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-lg">{g.label}</h2>
                  <span className="text-xs text-muted-foreground">{g.hint}</span>
                </div>
                {g.items.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nothing here yet.</p>
                ) : (
                  <div className="card-elevated divide-y">
                    {g.items.map((t) => (
                      <button key={t.id} type="button" onClick={() => { setDraft(t); setMsg(null); setPayload(null); }} className="focus-ring flex w-full items-start gap-3 p-4 text-left hover:bg-muted/50">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{t.name}</p>
                            {t.metaStatus && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${META_BADGE[t.metaStatus] ?? META_BADGE.DRAFT}`}>{t.metaStatus === 'DRAFT' ? 'Not submitted' : t.metaStatus.toLowerCase()}</span>}
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.body}</p>
                          {t.metaRejection && <p className="mt-1 text-xs text-destructive">Meta said: {t.metaRejection}</p>}
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">used {t.usageCount}x</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}

      {draft && (
        <div className="grid gap-4 lg:grid-cols-[1fr,360px]">
          <div className="card-elevated space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">What is it called</span>
                <input value={draft.name} onChange={(e) => { const name = e.target.value; setDraft((d) => d ? { ...d, name, key: d.id ? d.key : name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) } : d); }} placeholder="Payment reminder" className="focus-ring mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Channel</span>
                <select value={draft.channel} onChange={(e) => set('channel', e.target.value)} className="focus-ring mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                  {CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </label>
            </div>

            {draft.channel === 'WHATSAPP' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">Name Meta will see</span>
                  <input value={draft.key} onChange={(e) => set('key', e.target.value)} className="focus-ring mt-1 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">Category</span>
                  <select value={draft.category ?? ''} onChange={(e) => set('category', e.target.value)} className="focus-ring mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                    {WA_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <span className="mt-1 block text-xs text-muted-foreground">{WA_CATEGORIES.find((c) => c.key === draft.category)?.hint}</span>
                </label>
              </div>
            )}

            {draft.channel === 'EMAIL' && (
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Subject</span>
                <input value={draft.subject ?? ''} onChange={(e) => set('subject', e.target.value)} className="focus-ring mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
              </label>
            )}

            {(draft.channel === 'WHATSAPP' || draft.channel === 'LETTER') && (
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">{draft.channel === 'LETTER' ? 'Letter title' : 'Header (optional)'}</span>
                <input value={draft.header ?? ''} onChange={(e) => set('header', e.target.value)} maxLength={draft.channel === 'WHATSAPP' ? 60 : 200} className="focus-ring mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
              </label>
            )}

            <label className="block">
              <span className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Message</span>
                <span className="tabular-nums">{draft.body.length}{draft.channel === 'WHATSAPP' ? ' / 1024' : ''}{seg ? ` · ${seg.segments} SMS` : ''}</span>
              </span>
              <textarea value={draft.body} onChange={(e) => set('body', e.target.value)} rows={8} placeholder="Hello {{buyer.firstName}}, an instalment of Rs {{payment.amount}} is due on {{payment.dueDate}}. Please ignore if already paid." className="focus-ring mt-1 w-full rounded-md border bg-background p-3 text-sm" />
            </label>

            {draft.channel !== 'LETTER' && (
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Footer (optional)</span>
                <input value={draft.footer ?? ''} onChange={(e) => set('footer', e.target.value)} maxLength={draft.channel === 'WHATSAPP' ? 60 : 200} placeholder="Ameya Heights LLP" className="focus-ring mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
              </label>
            )}

            {draft.channel === 'WHATSAPP' && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">Buttons (up to 3)</span>
                <div className="mt-1 space-y-2">
                  {draft.buttons.map((b, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <select value={b.type} onChange={(e) => set('buttons', draft.buttons.map((x, j) => (j === i ? { ...x, type: e.target.value as 'URL' | 'QUICK_REPLY' } : x)))} className="focus-ring rounded-md border bg-background px-2 py-1.5 text-xs">
                        <option value="QUICK_REPLY">Quick reply</option>
                        <option value="URL">Link</option>
                      </select>
                      <input value={b.text} maxLength={25} onChange={(e) => set('buttons', draft.buttons.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder="Button text" className="focus-ring w-36 rounded-md border bg-background px-2 py-1.5 text-xs" />
                      {b.type === 'URL' && <input value={b.url ?? ''} onChange={(e) => set('buttons', draft.buttons.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://crm.ameyaheights.com/portal" className="focus-ring min-w-[180px] flex-1 rounded-md border bg-background px-2 py-1.5 text-xs" />}
                      <button type="button" onClick={() => set('buttons', draft.buttons.filter((_, j) => j !== i))} className="focus-ring rounded-md border p-1.5 hover:bg-muted" aria-label="Remove button"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                  {draft.buttons.length < 3 && (
                    <button type="button" onClick={() => set('buttons', [...draft.buttons, { type: 'QUICK_REPLY', text: '' }])} className="focus-ring rounded-md border px-2.5 py-1 text-xs hover:bg-muted"><Plus className="mr-1 inline h-3 w-3" />Add a button</button>
                  )}
                </div>
              </div>
            )}

            {errors.length > 0 && (
              <ul className="space-y-1 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {errors.map((i, n) => <li key={n} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{i.message}</li>)}
              </ul>
            )}
            {warnings.length > 0 && (
              <ul className="space-y-1 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
                {warnings.map((i, n) => <li key={n} className="flex gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0" />{i.message}</li>)}
              </ul>
            )}

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <button type="button" onClick={save} disabled={pending || errors.length > 0 || !draft.name.trim()} className="focus-ring rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </button>
              {draft.channel === 'WHATSAPP' && draft.id && (
                <button type="button" onClick={() => submit(draft)} disabled={pending || errors.length > 0} className="focus-ring inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
                  <Send className="h-4 w-4" />{whatsappConnected ? 'Submit to Meta' : 'Get the JSON for Meta'}
                </button>
              )}
              <button type="button" onClick={() => { setDraft(null); setPayload(null); }} className="focus-ring rounded-md border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
              {draft.id && (
                <button type="button" onClick={() => remove(draft)} disabled={pending} className="focus-ring ml-auto rounded-md border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10"><Trash2 className="mr-1 inline h-4 w-4" />Delete</button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="card-elevated p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">How it will look</p>
              <div className="mt-3 rounded-lg bg-[#e7ffdb] p-3 text-sm text-[#111b21] shadow-sm dark:bg-emerald-950/40 dark:text-emerald-50">
                {shown?.subject && <p className="mb-1 font-semibold">{shown.subject}</p>}
                {shown?.header && <p className="mb-1 font-semibold">{shown.header}</p>}
                <p className="whitespace-pre-wrap">{shown?.body || 'Your message will appear here.'}</p>
                {shown?.footer && <p className="mt-2 text-xs opacity-60">{shown.footer}</p>}
              </div>
              {draft.buttons.length > 0 && (
                <div className="mt-1 space-y-1">
                  {draft.buttons.map((b, i) => <div key={i} className="rounded-lg border bg-background py-1.5 text-center text-sm text-primary">{b.text || 'Button'}</div>)}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Filled with sample data so you can see the real wording.</p>
            </div>

            <div className="card-elevated p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fields you can drop in</p>
              <div className="mt-2 max-h-80 space-y-3 overflow-auto">
                {[...new Set(MERGE_FIELDS.map((f) => f.group))].map((g) => (
                  <div key={g}>
                    <p className="text-xs font-medium">{g}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {MERGE_FIELDS.filter((f) => f.group === g).map((f) => (
                        <button key={f.token} type="button" onClick={() => insert(f.token)} title={`Example: ${f.sample}`} className="focus-ring rounded border bg-background px-1.5 py-0.5 text-xs hover:bg-muted">{f.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
