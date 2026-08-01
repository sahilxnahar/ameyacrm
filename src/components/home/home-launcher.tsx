import Link from 'next/link';
import { NAVIGATION } from '@/config/navigation';

/**
 * A visual map of the whole CRM on the home page — every section the person can
 * reach, as big icon tiles grouped the same way as the sidebar. One glance,
 * one click, no menu hunting. Permission-filtered so people only see what they
 * can open. Pure render (server component), reuses the navigation config.
 */
export function HomeLauncher({ allowed, isSuperAdmin }: { allowed: string[]; isSuperAdmin: boolean }) {
  const has = (perm?: string) => !perm || isSuperAdmin || allowed.includes(perm) || allowed.includes('*');
  const groups = NAVIGATION
    .map((g) => ({ ...g, items: g.items.filter((i) => has(i.permission)) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg">Jump to anything</h2>
        <p className="text-sm text-muted-foreground">Every part of the CRM, one tap away.</p>
      </div>

      {groups.map((g) => (
        <section key={g.label}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</h3>
          <div className="grid gap-3 auto-rows-fr [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
            {g.items.map((it) => {
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  title={it.blurb}
                  className="card-surface group flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-medium leading-tight">{it.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
