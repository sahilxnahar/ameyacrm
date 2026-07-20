'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X, Pin, PinOff, ChevronUp, ChevronDown, EyeOff, Eye, SlidersHorizontal, RotateCcw, Check } from 'lucide-react';
import { NAVIGATION } from '@/config/navigation';
import { saveNavPrefs, resetNavPrefs } from '@/server/actions/nav-prefs';
import { applyOrder, type NavPrefs } from '@/lib/nav/prefs';
import { BrandLogo } from './brand-logo';
import { cn } from '@/lib/utils/cn';

export function Sidebar({
  allowed,
  isSuperAdmin,
  mobileOpen,
  navPrefs,
  onClose,
}: {
  allowed: Set<string>;
  isSuperAdmin: boolean;
  mobileOpen: boolean;
  navPrefs: NavPrefs;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [customising, setCustomising] = React.useState(false);
  const [prefs, setPrefs] = React.useState<NavPrefs>(navPrefs);

  React.useEffect(() => setPrefs(navPrefs), [navPrefs]);

  const canSee = (perm?: string) => !perm || isSuperAdmin || allowed.has(perm);
  const allItems = NAVIGATION.flatMap((g) => g.items).filter((i) => canSee(i.permission));
  const byHref = new Map(allItems.map((i) => [i.href, i]));

  const pinned = prefs.pinned.map((h) => byHref.get(h)).filter(Boolean) as typeof allItems;

  const move = (href: string, dir: -1 | 1, groupHrefs: string[]) => {
    // Seed the order from what is currently on screen, then swap two neighbours.
    const base = prefs.order.length ? [...prefs.order] : [];
    for (const h of groupHrefs) if (!base.includes(h)) base.push(h);
    const i = base.indexOf(href);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= base.length) return;
    [base[i], base[j]] = [base[j], base[i]];
    setPrefs({ ...prefs, order: base });
  };

  const togglePin = (href: string) =>
    setPrefs({ ...prefs, pinned: prefs.pinned.includes(href) ? prefs.pinned.filter((h) => h !== href) : [...prefs.pinned, href] });

  const toggleHide = (href: string) =>
    setPrefs({ ...prefs, hidden: prefs.hidden.includes(href) ? prefs.hidden.filter((h) => h !== href) : [...prefs.hidden, href] });

  const save = () =>
    start(async () => {
      const r = await saveNavPrefs(prefs);
      if ('error' in r) return toast.error(r.error);
      toast.success('Your menu is saved');
      setCustomising(false);
      router.refresh();
    });

  const reset = () =>
    start(async () => {
      await resetNavPrefs();
      setPrefs({ pinned: [], order: [], hidden: [] });
      toast.success('Back to the standard menu');
      router.refresh();
    });

  const renderItem = (item: (typeof allItems)[number], groupHrefs: string[], isPinnedRow = false) => {
    const active = pathname === item.href || pathname.startsWith(item.href + '/');
    const Icon = item.icon;
    const hidden = prefs.hidden.includes(item.href);
    const isPinned = prefs.pinned.includes(item.href);

    return (
      <li key={(isPinnedRow ? 'p:' : '') + item.href} className={cn(customising && hidden && 'opacity-40')}>
        <div className="group flex items-center gap-0.5">
          <Link
            href={item.href}
            onClick={customising ? (e) => e.preventDefault() : onClose}
            className={cn(
              'flex min-h-[40px] flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors active:bg-secondary',
              active ? 'bg-primary/10 font-semibold' : 'gold-solid hover:bg-primary/5',
              customising && 'cursor-default',
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-[#A07D34]' : 'text-[#6B6459]')} />
            <span className={cn('truncate', active && 'font-semibold text-[#14120E] dark:text-[#F1EAD9]')}>{item.label}</span>
            {!customising && isPinned && <Pin className="ml-auto h-3 w-3 shrink-0 text-[#A07D34]" />}
          </Link>

          {customising && (
            <span className="flex shrink-0 items-center">
              <button onClick={() => move(item.href, -1, groupHrefs)} title="Move up" className="rounded p-1 hover:bg-secondary"><ChevronUp className="h-3.5 w-3.5" /></button>
              <button onClick={() => move(item.href, 1, groupHrefs)} title="Move down" className="rounded p-1 hover:bg-secondary"><ChevronDown className="h-3.5 w-3.5" /></button>
              <button onClick={() => togglePin(item.href)} title={isPinned ? 'Unpin from the top' : 'Pin to the top'} className="rounded p-1 hover:bg-secondary">
                {isPinned ? <PinOff className="h-3.5 w-3.5 text-[#A07D34]" /> : <Pin className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => toggleHide(item.href)} title={hidden ? 'Show this again' : 'Hide from my menu'} className="rounded p-1 hover:bg-secondary">
                {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
            </span>
          )}
        </div>
      </li>
    );
  };

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[17rem] max-w-[85vw] flex-col border-r bg-card shadow-2xl transition-transform duration-200 lg:w-64 lg:max-w-none lg:shadow-none lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="app-drawer-head flex items-center justify-between border-b px-5">
          <BrandLogo />
          <button className="lg:hidden" onClick={onClose} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {!customising && pinned.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B6459] dark:text-[#A8A093]">
                <Pin className="h-2.5 w-2.5" /> Pinned
              </p>
              <ul className="space-y-0.5">{pinned.map((i) => renderItem(i, [], true))}</ul>
            </div>
          )}

          {NAVIGATION.map((group) => {
            const raw = group.items.filter((i) => canSee(i.permission));
            if (raw.length === 0) return null;
            const items = customising ? raw : applyOrder(raw, prefs);
            if (items.length === 0) return null;
            const groupHrefs = applyOrder(raw, prefs).map((i) => i.href);
            return (
              <div key={group.label}>
                <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B6459] dark:text-[#A8A093]">
                  {group.label}
                </p>
                <ul className="space-y-0.5">{items.map((item) => renderItem(item, groupHrefs))}</ul>
              </div>
            );
          })}
        </nav>

        <div className="border-t p-3">
          {customising ? (
            <div className="flex flex-wrap gap-1.5">
              <Button onClick={save} disabled={pending}><Check className="h-3.5 w-3.5" /> Save menu</Button>
              <Button variant="ghost" onClick={() => { setPrefs(navPrefs); setCustomising(false); }}>Cancel</Button>
              <Button variant="ghost" onClick={reset} disabled={pending} title="Put every item back where it started">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setCustomising(true)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-secondary"
              title="Reorder, pin or hide items — only for you"
            >
              <SlidersHorizontal className="h-3 w-3" /> Customise this menu
            </button>
          )}
          <p className="mt-1.5 px-2 text-[10px] text-muted-foreground">Ameya Heights CRM · v9.7</p>
        </div>
      </aside>
    </>
  );
}

function Button({ children, variant = 'default', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'ghost' }) {
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors disabled:opacity-60',
        variant === 'default' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'hover:bg-secondary',
      )}
    >
      {children}
    </button>
  );
}
