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

  /**
   * Move an item one place within its own group.
   *
   * Swapping inside one flat list across every group let an item jump from the
   * bottom of one section to the top of the next, so the swap happens within
   * the group and is then merged back into the saved order.
   */
  const move = (href: string, dir: -1 | 1, groupHrefs: string[]) => {
    const within = [...groupHrefs];
    const i = within.indexOf(href);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= within.length) return;
    [within[i], within[j]] = [within[j]!, within[i]!];

    // Keep every other group's order untouched.
    const others = prefs.order.filter((h) => !groupHrefs.includes(h));
    setPrefs({ ...prefs, order: [...others, ...within] });
  };

  const togglePin = (href: string) =>
    setPrefs({ ...prefs, pinned: prefs.pinned.includes(href) ? prefs.pinned.filter((h) => h !== href) : [...prefs.pinned, href] });

  const toggleHide = (href: string) =>
    setPrefs({ ...prefs, hidden: prefs.hidden.includes(href) ? prefs.hidden.filter((h) => h !== href) : [...prefs.hidden, href] });

  const save = () =>
    start(async () => {
      const r = await saveNavPrefs(prefs);
      if ('error' in r) { toast.error(r.error); return; }
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
        <div className="group flex flex-col">
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
            <span className="truncate">{item.label}</span>
            {!customising && isPinned && <Pin className="ml-auto h-3 w-3 shrink-0 text-[#A07D34]" />}
          </Link>

          {/* The controls get their own row. Squeezed next to the label they
              were clipped off the edge of the sidebar and unusable. */}
          {customising && (
            <span className="mb-1 ml-3 flex items-center gap-1">
              <CtrlButton onClick={() => move(item.href, -1, groupHrefs)} title="Move up"><ChevronUp className="h-3.5 w-3.5" /></CtrlButton>
              <CtrlButton onClick={() => move(item.href, 1, groupHrefs)} title="Move down"><ChevronDown className="h-3.5 w-3.5" /></CtrlButton>
              <CtrlButton onClick={() => togglePin(item.href)} title={isPinned ? 'Unpin from the top' : 'Pin to the top'}>
                {isPinned ? <PinOff className="h-3.5 w-3.5 text-[#A07D34]" /> : <Pin className="h-3.5 w-3.5" />}
              </CtrlButton>
              <CtrlButton onClick={() => toggleHide(item.href)} title={hidden ? 'Show this again' : 'Hide from my menu'}>
                {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </CtrlButton>
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
          'fixed inset-y-0 left-0 z-50 flex max-w-[92vw] flex-col border-r bg-card shadow-2xl transition-all duration-200 lg:max-w-none lg:shadow-none lg:translate-x-0',
          customising ? 'w-[19rem] lg:w-[19rem]' : 'w-[17rem] lg:w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="app-drawer-head flex items-center justify-between border-b px-4 py-3">
          <BrandLogo onClick={onClose} />
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
            // Order is applied while customising too. Showing the raw list
            // during customisation made the move arrows look like dead buttons:
            // they updated state, but nothing on screen moved.
            const items = applyOrder(raw, prefs, { keepHidden: customising });
            if (items.length === 0) return null;
            const groupHrefs = applyOrder(raw, prefs, { keepHidden: customising }).map((i) => i.href);
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
          <p className="mt-1.5 px-2 text-[10px] text-muted-foreground">Ameya Heights CRM · v13.1</p>
        </div>
      </aside>
    </>
  );
}

function CtrlButton({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
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
