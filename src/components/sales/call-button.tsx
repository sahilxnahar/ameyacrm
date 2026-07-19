'use client';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Click-to-call via the device dialer (tel:) — free, no telephony provider needed. */
export function CallButton({ phone }: { phone: string | null }) {
  if (!phone) return null;
  return (
    <Button asChild size="sm" variant="outline" className="mt-2">
      <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}><Phone className="h-4 w-4" /> Call</a>
    </Button>
  );
}
