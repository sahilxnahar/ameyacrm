'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X, Pin, PinOff, ChevronUp, ChevronDown, EyeOff, Eye, SlidersHorizontal, RotateCcw, Check, ChevronRight, PanelLeftClose, PanelLeftOpen, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { NAVIGATION, type NavItem } from '@/config/navigation';
import { saveNavPrefs, resetNavPrefs, saveNavCollapsed } from '@/server/actions/nav-prefs';
import { applyOrder, applyGroupOrder, type NavPrefs } from '@/lib/nav/prefs';
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

  // Drag-and-drop reordering (customise mode). Groups reorder as whole sections;
  // items reorder within their own section.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onGroupDragEnd = (e: DragEndEvent, labels: string[]) => {
    const { active, over } = e; if (!over || active.id === over.id) return;
    setPrefs({ ...prefs, groups: arrayMove(labels, labels.indexOf(String(active.id)), labels.indexOf(String(over.id))) });
  };
  const onItemDragEnd = (e: DragEndEvent, groupHrefs: string[]) => {
    const { active, over } = e; if (!over || active.id === over.id) return;
    const within = arrayMove(groupHrefs, groupHrefs.indexOf(String(active.id)), groupHrefs.indexOf(String(over.id)));
    const others = prefs.order.filter((h) => !groupHrefs.includes(h));
    setPrefs({ ...prefs, order: [...others, ...within] });
  };

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
      setPrefs({ pinned: [], order: [], hidden: [], collapsed: [], groups: [] });
      setCollapsedGroups([]);
      toast.success('Back to the standard menu');
      router.refresh();
    });

  const renderItem = (item: (typeof allItems)[number], groupHrefs: string[], isPinnedRow = false) => {
    const active = pathname === item.href || pathname.startsWith(item.href + '/');
    const Icon = item.icon;
    const hidden = prefs.hidden.includes(item.href);
    const isPinned = prefs.pinned.includes(item.href);
    // Show the plain-language description beneath the label in the full menu.
    // Not on the icon rail (no room) and not while customising (the reorder
    // controls need the space and a compact row).
    const showBlurb = !rail && !customising && !!item.blurb;

    return (
      <li key={(isPinnedRow ? 'p:' : '') + item.href} className={cn(customising && hidden && 'opacity-40')}>
        <div className="group flex flex-col">
          <Link
            href={item.href}
            onClick={customising ? (e) => e.preventDefault() : onClose}
            title={rail ? item.label : item.blurb}
            aria-label={item.label}
            className={cn(
              'flex flex-1 items-center gap-3 rounded-md px-3 font-medium transition-colors active:bg-secondary',
              // A little bigger overall, and taller when a description sits under it.
              showBlurb ? 'min-h-[52px] py-2 text-[15px]' : 'min-h-[44px] py-2 text-[15px]',
              active ? 'bg-primary/10 font-semibold' : 'gold-solid hover:bg-primary/5',
              customising && 'cursor-default',
              // Icon-only on the desktop rail; full on mobile.
              rail && 'lg:justify-center lg:gap-0 lg:px-0',
            )}
          >
            <Icon className={cn('shrink-0', showBlurb ? 'h-[18px] w-[18px]' : 'h-[18px] w-[18px]', active ? 'text-[#A07D34]' : 'text-[#6B6459]')} />
            <span className={cn('flex min-w-0 flex-1 flex-col', rail && 'lg:hidden')}>
              <span className="truncate leading-tight">{item.label}</span>
              {showBlurb && (
                <span className="mt-0.5 line-clamp-2 text-[11px] font-normal leading-snug text-muted-foreground">{item.blurb}</span>
              )}
            </span>
            {!customising && isPinned && <Pin className={cn('h-3 w-3 shrink-0 text-[#A07D34]', rail && 'lg:hidden')} />}
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
          customising ? 'w-[19rem] lg:w-[19rem]' : rail ? 'w-[17rem] lg:w-[4.5rem]' : 'w-[18rem] lg:w-72',
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

          {(() => {
            const orderedGroups = applyGroupOrder(NAVIGATION, prefs).filter((g) => g.items.filter((i) => canSee(i.permission)).length > 0);

            // Customise mode: drag whole sections to reorder them, and drag items
            // within a section. A grip handle starts the drag; keyboard works too.
            if (customising) {
              const groupLabels = orderedGroups.map((g) => g.label);
              return (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onGroupDragEnd(e, groupLabels)}>
                  <SortableContext items={groupLabels} strategy={verticalListSortingStrategy}>
                    {orderedGroups.map((group) => {
                      const items = applyOrder(group.items.filter((i) => canSee(i.permission)), prefs, { keepHidden: true });
                      const groupHrefs = items.map((i) => i.href);
                      return (
                        <SortableGroup key={group.label} id={group.label} label={t(group.label)}>
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onItemDragEnd(e, groupHrefs)}>
                            <SortableContext items={groupHrefs} strategy={verticalListSortingStrategy}>
                              <ul className="space-y-0.5">
                                {items.map((item) => (
                                  <SortableRow key={item.href} item={item} hidden={prefs.hidden.includes(item.href)} isPinned={prefs.pinned.includes(item.href)} onTogglePin={() => togglePin(item.href)} onToggleHide={() => toggleHide(item.href)} />
                                ))}
                              </ul>
                            </SortableContext>
                          </DndContext>
                        </SortableGroup>
                      );
                    })}
                  </SortableContext>
                </DndContext>
              );
            }

            // Normal mode — sections in the person's saved order, foldable.
            return orderedGroups.map((group) => {
              const items = applyOrder(group.items.filter((i) => canSee(i.permission)), prefs, { keepHidden: false });
              if (items.length === 0) return null;
              const groupHrefs = items.map((i) => i.href);
              const isCollapsedGroup = !rail && collapsedGroups.includes(group.label);
              const showItems = rail || !isCollapsedGroup;
              return (
                <div key={group.label} className={cn(rail && 'lg:border-t lg:border-border/50 lg:pt-3 lg:first:border-t-0 lg:first:pt-0')}>
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
                  {showItems && <ul className="space-y-0.5">{items.map((item) => renderItem(item, groupHrefs))}</ul>}
                </div>
              );
            });
          })()}
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
          <p className={cn('mt-1.5 px-2 text-[10px] text-muted-foreground', rail && 'lg:hidden')}>Ameya Heights CRM · v15.8</p>
        </div>
      </aside>
    </>
  );
}

function SortableGroup({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 20 : undefined };
  return (
    <div ref={setNodeRef} style={style} className="rounded-md">
      <div className="mb-1 flex items-center gap-1">
        <button type="button" {...attributes} {...listeners} className="flex h-6 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing" title="Drag to move this whole section" aria-label={`Drag section ${label}`}>
          <GripVertical className="h-4 w-4" />
        </button>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B6459] dark:text-[#A8A093]">{label}</p>
      </div>
      {children}
    </div>
  );
}

function SortableRow({ item, hidden, isPinned, onTogglePin, onToggleHide }: { item: NavItem; hidden: boolean; isPinned: boolean; onTogglePin: () => void; onToggleHide: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.href });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : hidden ? 0.4 : 1, zIndex: isDragging ? 20 : undefined };
  const Icon = item.icon;
  return (
    <li ref={setNodeRef} style={style}>
      <div className="flex items-center gap-1 rounded-md border border-transparent px-1 py-1 hover:border-border hover:bg-secondary/40">
        <button type="button" {...attributes} {...listeners} className="flex h-7 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing" title="Drag to reorder" aria-label={`Drag ${item.label}`}>
          <GripVertical className="h-4 w-4" />
        </button>
        <Icon className="h-[18px] w-[18px] shrink-0 text-[#6B6459]" />
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{item.label}</span>
        <CtrlButton onClick={onTogglePin} title={isPinned ? 'Unpin from the top' : 'Pin to the top'}>{isPinned ? <PinOff className="h-3.5 w-3.5 text-[#A07D34]" /> : <Pin className="h-3.5 w-3.5" />}</CtrlButton>
        <CtrlButton onClick={onToggleHide} title={hidden ? 'Show this again' : 'Hide from my menu'}>{hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</CtrlButton>
      </div>
    </li>
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
