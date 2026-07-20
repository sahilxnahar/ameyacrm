'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { NAVIGATION } from '@/config/navigation';
import { BrandLogo } from './brand-logo';
import { cn } from '@/lib/utils/cn';

export function Sidebar({
  allowed,
  isSuperAdmin,
  mobileOpen,
  onClose,
}: {
  allowed: Set<string>;
  isSuperAdmin: boolean;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const canSee = (perm?: string) => !perm || isSuperAdmin || allowed.has(perm);

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-5">
          <BrandLogo />
          <button className="lg:hidden" onClick={onClose} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {NAVIGATION.map((group) => {
            const items = group.items.filter((i) => canSee(i.permission));
            if (items.length === 0) return null;
            return (
              <div key={group.label}>
                <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B6459] dark:text-[#A8A093]">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + '/');
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            active
                              ? 'bg-primary/10 font-semibold'
                              : 'gold-solid hover:bg-primary/5',
                          )}
                        >
                          <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-[#A07D34]' : 'text-[#6B6459]')} />
                          <span className={active ? 'font-semibold text-[#14120E] dark:text-[#F1EAD9]' : undefined}>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
        <div className="border-t p-4 text-[10px] text-muted-foreground">
          Ameya Heights CRM · v7.2
        </div>
      </aside>
    </>
  );
}
