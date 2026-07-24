'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Link2, Copy, Loader2 } from 'lucide-react';
import { generateVendorPortalToken } from '@/server/actions/vendor-portal';

/**
 * Create (and copy) a read-only portal link for a supplier — the same token-link
 * pattern as the buyer portal, no login needed. Generating again rotates the
 * link, which quietly revokes the old one.
 */
export function VendorPortalLink({ vendorId }: { vendorId: string }) {
  const [pending, start] = React.useTransition();
  const [made, setMade] = React.useState(false);

  const make = () =>
    start(async () => {
      const r = await generateVendorPortalToken(vendorId);
      if ('error' in r) { toast.error(r.error); return; }
      const url = `${window.location.origin}/vendor-portal/${r.token}`;
      setMade(true);
      try { await navigator.clipboard.writeText(url); toast.success('Portal link copied to clipboard'); }
      catch { toast.success('Portal link ready — copy it from the box'); window.prompt('Vendor portal link', url); }
    });

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); make(); }}
      disabled={pending}
      title="Create and copy a read-only portal link for this supplier"
      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-secondary disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : made ? <Copy className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
      {made ? 'Copy again' : 'Portal link'}
    </button>
  );
}
