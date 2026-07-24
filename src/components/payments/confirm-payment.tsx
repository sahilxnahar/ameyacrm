'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { confirmPayment } from '@/server/actions/payment-requests';

export function ConfirmPayment({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  if (done) return (
    <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
      <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Thank you — we&apos;ll verify and confirm shortly.
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault(); setErr(null);
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await confirmPayment(token, String(fd.get('ref') || ''));
          if ('error' in r) return setErr(r.error);
          setDone(true); router.refresh();
        });
      }}
      className="space-y-2"
    >
      <label htmlFor="ref" className="block text-sm font-medium">Already paid? Enter your transaction / UTR reference</label>
      <div className="flex gap-2">
        <input id="ref" name="ref" required placeholder="e.g. UTR123456789"
          className="h-10 flex-1 rounded-md border border-[#D9D2C4] bg-white px-3 text-sm text-[#14120E] placeholder:text-[#A8A093] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A07D34]" />
        <button type="submit" disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-[#A07D34] px-4 text-sm font-medium text-white disabled:opacity-60">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}I&apos;ve paid
        </button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </form>
  );
}
