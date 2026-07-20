import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

const TONES = {
  default: 'text-primary bg-primary/10',
  success: 'text-emerald-600 bg-emerald-500/10',
  warning: 'text-amber-600 bg-amber-500/10',
  danger: 'text-rose-600 bg-rose-500/10',
  info: 'text-blue-600 bg-blue-500/10',
} as const;

export function ActionCard({
  title, icon: Icon, value, caption, emptyCaption, cta, href, tone = 'default',
}: {
  title: string; icon: LucideIcon; value: string | number; caption: string; emptyCaption?: string;
  cta: string; href: string; tone?: keyof typeof TONES;
}) {
  const isEmpty = value === 0 || value === '0' || value === '—';
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-md', TONES[tone])}><Icon className="h-4 w-4" /></span>
        <p className="text-sm font-medium">{title}</p>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-7 text-center">
        <p className={cn('font-display text-4xl font-semibold tabular-nums', isEmpty ? 'text-muted-foreground/50' : '')}>{value}</p>
        <p className="mt-1.5 max-w-[220px] text-xs text-muted-foreground">{isEmpty ? (emptyCaption ?? caption) : caption}</p>
      </div>
      <div className="p-4 pt-0">
        <Button asChild className="w-full" variant={isEmpty ? 'outline' : 'default'}>
          <Link href={href}>{cta}</Link>
        </Button>
      </div>
    </Card>
  );
}
