import Link from 'next/link';
import type { Metadata } from 'next';
import { User, ShieldCheck, Bell } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  const items = [
    { href: '/settings/profile', icon: User, title: 'Profile', desc: 'Your personal information.' },
    { href: '/settings/security', icon: ShieldCheck, title: 'Security & 2FA', desc: 'Password, two-factor, sessions.' },
    { href: '/settings/notifications', icon: Bell, title: 'Notifications', desc: 'Channels, quiet hours, push devices.' },
  ];
  return (
    <div>
      <PageHeader title="Settings" description="Manage your account." />
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((i) => (
          <Link key={i.href} href={i.href}>
            <Card className="transition-colors hover:border-primary hover:bg-secondary/40">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary"><i.icon className="h-5 w-5" /></div>
                <div><p className="font-medium">{i.title}</p><p className="text-sm text-muted-foreground">{i.desc}</p></div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
