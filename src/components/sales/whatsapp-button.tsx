'use client';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Free WhatsApp click-to-chat (wa.me) — no paid API. Opens WhatsApp with a pre-filled message. */
export function WhatsAppButton({ phone, name }: { phone: string | null; name: string }) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  const num = digits.length === 10 ? `91${digits}` : digits;
  const text = `Hello ${name}, thank you for your interest in Ameya Heights. Here are the project details you requested:`;
  return (
    <Button asChild size="sm" variant="outline" className="mt-2 border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10">
      <a href={`https://wa.me/${num}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
    </Button>
  );
}
