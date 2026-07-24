'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, FileText, Mail, MessageSquare, Phone, Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Template {
  id: string; key: string; name: string; channel: string; category: string | null;
  subject: string | null; header: string | null; body: string; footer: string | null;
  description: string | null; departmentName: string | null; usageCount: number;
}

const CHANNEL_ICON: Record<string, typeof Mail> = {
  EMAIL: Mail, WHATSAPP: MessageSquare, SMS: Phone, LETTER: FileText,
};

export function MyTemplatesView({
  templates, departments, seesEverything,
}: {
  templates: Template[];
  departments: Array<{ id: string; name: string; isPrimary: boolean }>;
  seesEverything: boolean;
}) {
  const [q, setQ] = useState('');
  const [channel, setChannel] = useState<string>('ALL');
  const [copied, setCopied] = useState<string | null>(null);

  const channels = useMemo(
    () => ['ALL', ...new Set(templates.map((t) => t.channel))],
    [templates],
  );

  const shown = templates.filter((t) => {
    if (channel !== 'ALL' && t.channel !== channel) return false;
    if (!q) return true;
    const hay = [t.name, t.description, t.body, t.subject, t.departmentName].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const copy = async (t: Template) => {
    const full = [t.subject && `Subject: ${t.subject}`, t.header, t.body, t.footer]
      .filter(Boolean).join('\n\n');
    try {
      await navigator.clipboard.writeText(full);
      setCopied(t.id);
      setTimeout(() => setCopied((c) => (c === t.id ? null : c)), 1800);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="space-y-4">
      {!seesEverything && (
        <p className="text-sm text-muted-foreground">
          You are seeing templates for{' '}
          {departments.length
            ? departments.map((d) => d.name).join(', ')
            : 'no department yet — ask an administrator to add you to one'}
          .
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search templates…"
            className="focus-ring w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm"
          />
        </label>
        <div className="chip-row">
          {channels.map((c) => (
            <button
              key={c} type="button" onClick={() => setChannel(c)}
              className={cn(
                'focus-ring shrink-0 rounded-full border px-3 py-1 text-xs font-medium',
                channel === c ? 'border-primary bg-primary/10 text-primary' : 'border-border',
              )}
            >
              {c === 'ALL' ? 'All' : c.charAt(0) + c.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {!shown.length && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {templates.length
            ? 'Nothing matches that search.'
            : 'No templates for your department yet. An administrator can add them under Admin → Templates.'}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((t) => {
          const Icon = CHANNEL_ICON[t.channel] ?? FileText;
          return (
            <article key={t.id} className="flex flex-col rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{t.name}</span>
                </h3>
                <button
                  type="button" onClick={() => copy(t)}
                  className="focus-ring shrink-0 rounded-md border border-input px-2 py-1 text-xs"
                  aria-label={`Copy ${t.name}`}
                >
                  {copied === t.id
                    ? <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" />Copied</span>
                    : <span className="flex items-center gap-1"><Copy className="h-3.5 w-3.5" />Copy</span>}
                </button>
              </div>

              {t.description && <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>}

              {t.subject && <p className="mt-2 text-xs"><span className="text-muted-foreground">Subject: </span>{t.subject}</p>}

              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-anywhere rounded-md bg-muted/50 p-2 font-sans text-xs leading-relaxed">
                {t.body}
              </pre>

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-3 text-[11px] text-muted-foreground">
                {t.departmentName && <span className="rounded-full bg-secondary px-2 py-0.5">{t.departmentName}</span>}
                {t.category && <span className="rounded-full bg-secondary px-2 py-0.5">{t.category}</span>}
                {t.usageCount > 0 && <span>Used {t.usageCount}×</span>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
