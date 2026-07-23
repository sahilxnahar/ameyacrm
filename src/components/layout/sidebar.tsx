'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X, Pin, PinOff, ChevronUp, ChevronDown, EyeOff, Eye, SlidersHorizontal, RotateCcw, Check, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NAVIGATION } from '@/config/navigation';
import { saveNavPrefs, resetNavPrefs, saveNavCollapsed } from '@/server/actions/nav-prefs';
import { applyOrder, type NavPrefs } from '@/lib/nav/prefs';
import { RecentNav } from './recent-nav';
import { BrandLogo } from './brand-logo';
import { useT } from '@/components/i18n/language-provider';
import { cn } from '@/lib/utils/cn';

export function Sidebar({
  allowed,
  isSuperAdmin,
  mobileOpen,
  navPrefs,
  collapsed = false,
  onToggleRail,
  onClose,
}: {
  allowed: Set<string>;
  isSuperAdmin: boolean;
  mobileOpen: boolean;
  navPrefs: NavPrefs;
  /** Desktop icon-rail is collapsed. A per-device preference from the shell. */
  collapsed?: boolean;
  /** Collapse/expand the desktop rail. Pass a boolean to force a state. */
  onToggleRail?: (v?: boolean) => void;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();
  const [pending, start] = React.useTransition();
  const [customising, setCustomising] = React.useState(false);
  const [prefs, setPrefs] = React.useState<NavPrefs>(navPrefs);

  React.useEffect(() => setPrefs(navPrefs), [navPrefs]);

  // While customising, the rail is always shown expanded so the reorder controls
  // and labels are usable — the icon-only rail has no room for them.
  const rail = collapsed && !customising;

  const canSee = (perm?: string) => !perm || isSuperAdmin || allowed.has(perm);
  const allItems = NAVIGATION.flatMap((g) => g.items).filter((i) => canSee(i.permission));
  const byHref = new Map(allItems.map((i) => [i.href, i]));

  // Which groups are folded shut. Seeded from the saved prefs; toggling records
  // it (fire-and-forget) so it is remembered next time without a page reload.
  const [collapsedGroups, setCollapsedGroups] = React.useState<string[]>(navPrefs.collapsed ?? []);
  React.useEffect(() => setCollapsedGroups(navPrefs.collapsed ?? []), [navPrefs.collapsed]);
  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label];
      void saveNavCollapsed(next);
      return next;
    });
  };

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
      setPrefs({ pinned: [], order: [], hidden: [], collapsed: [] });
      setCollapsedGroups([]);
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
            title={rail ? item.label : item.blurb}
            aria-label={item.label}
            className={cn(
              'flex min-h-[40px] flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors active:bg-secondary',
              active ? 'bg-primary/10 font-semibold' : 'gold-solid hover:bg-primary/5',
              customising && 'cursor-default',
              // Icon-only on the desktop rail; full on mobile.
              rail && 'lg:justify-center lg:gap-0 lg:px-0',
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-[#A07D34]' : 'text-[#6B6459]')} />
            <span className={cn('truncate', rail && 'lg:hidden')}>{item.label}</span>
            {!customising && isPinned && <Pin className={cn('ml-auto h-3 w-3 shrink-0 text-[#A07D34]', rail && 'lg:hidden')} />}
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
          'fixed inset-y-0 left-0 z-50 flex max-w-[92vw] flex-col border-r bg-card shadow-2xl transition-[width,transform] duration-200 lg:max-w-none lg:shadow-none lg:translate-x-0',
          customising ? 'w-[19rem] lg:w-[19rem]' : rail ? 'w-[17rem] lg:w-[4.5rem]' : 'w-[17rem] lg:w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className={cn('app-drawer-head flex items-center gap-1 border-b px-4 py-3', rail ? 'lg:justify-center lg:px-2' : 'justify-between')}>
          {/* Mobile keeps the full wordmark; the desktop rail shows just the mark. */}
          <span className={cn(rail && 'lg:hidden')}><BrandLogo onClick={onClose} /></span>
          {rail && <span className="hidden lg:block"><BrandLogo collapsed onClick={onClose} href="/dashboard" /></span>}

          {/* Desktop-only collapse toggle. */}
          <button
            type="button"
            onClick={() => onToggleRail?.()}
            className={cn('hidden shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground lg:flex', rail && 'lg:hidden')}
            title="Collapse the menu to icons"
            aria-label="Collapse the menu"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>

          {/* Mobile close. */}
          <button className="lg:hidden" onClick={onClose} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* When collapsed, a slim expand button sits just under the mark. */}
        {rail && (
          <button
            type="button"
            onClick={() => onToggleRail?.(false)}
            className="mx-2 mt-2 hidden items-center justify-center rounded-md border py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground lg:flex"
            title="Expand the menu"
            aria-label="Expand the menu"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        <nav className={cn('flex-1 space-y-5 overflow-y-auto py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]', rail ? 'px-2' : 'px-3')}>
          {!customising && pinned.length > 0 && (
            <div>
              <p className={cn('mb-2 flex items-center gap-1 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B6459] dark:text-[#A8A093]', rail && 'lg:hidden')}>
                <Pin className="h-2.5 w-2.5" /> Pinned
              </p>
              <ul className="space-y-0.5">{pinned.map((i) => renderItem(i, [], true))}</ul>
            </div>
          )}

          {!customising && (
            <div className={cn(rail && 'lg:hidden')}>
              <RecentNav items={allItems.map((i) => ({ href: i.href, label: i.label, icon: i.icon }))} onNavigate={onClose} />
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
            // Groups fold shut only in normal use; while customising everything
            // stays open so you can reorder and un-hide. On the icon rail, groups
            // are always open (there is no header to fold), separated by a divider.
            const isCollapsedGroup = !customising && !rail && collapsedGroups.includes(group.label);
            // Keep a group open if the page you are on lives inside it, so the
            // active item is never hidden behind a folded header.
            const hasActive = items.some((i) => pathname === i.href || pathname.startsWith(i.href + '/'));
            const showItems = rail || !isCollapsedGroup || hasActive;
            return (
              <div key={group.label} className={cn(rail && 'lg:border-t lg:border-border/50 lg:pt-3 lg:first:border-t-0 lg:first:pt-0')}>
                {customising ? (
                  <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B6459] dark:text-[#A8A093]">{t(group.label)}</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    aria-expanded={showItems}
                    className={cn('mb-2 flex w-full items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B6459] hover:bg-secondary/60 dark:text-[#A8A093]', rail && 'lg:hidden')}
                    title={isCollapsedGroup ? 'Open this section' : 'Fold this section'}
                  >
                    <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform', showItems && 'rotate-90')} />
                    {t(group.label)}
                  </button>
                )}
                {showItems && <ul className="space-y-0.5">{items.map((item) => renderItem(item, groupHrefs))}</ul>}
              </div>
            );
          })}
        </nav>

        <div className={cn('border-t p-3', rail && 'lg:px-2')}>
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
              onClick={() => { onToggleRail?.(false); setCustomising(true); }}
              className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-secondary', rail && 'lg:justify-center lg:px-0')}
              title="Reorder, pin or hide items — only for you"
            >
              <SlidersHorizontal className="h-3 w-3 shrink-0" /> <span className={cn(rail && 'lg:hidden')}>Customise this menu</span>
            </button>
          )}
          <p className={cn('mt-1.5 px-2 text-[10px] text-muted-foreground', rail && 'lg:hidden')}>Ameya Heights CRM · v14.53</p>
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
