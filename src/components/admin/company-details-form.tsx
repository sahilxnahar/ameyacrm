'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import { saveCompanyDetails } from '@/server/actions/company';
import type { CompanyDetails } from '@/config/company';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

const GROUPS: Array<{ title: string; note?: string; fields: Array<[keyof CompanyDetails, string, string?]> }> = [
  { title: 'Identity', fields: [
    ['legalName', 'Legal name'],
    ['gstin', 'GSTIN', '15 characters — first two digits are the state'],
    ['pan', 'PAN'],
    ['cin', 'LLPIN / CIN'],
  ] },
  { title: 'Addresses', fields: [
    ['registeredAddress', 'Registered office'],
    ['siteName', 'Project / site name'],
    ['siteAddress', 'Site address'],
  ] },
  { title: 'Bank', note: 'Used on invoices, payment requests and the public payment page.', fields: [
    ['bankName', 'Bank'],
    ['bankAccountName', 'Account name'],
    ['bankAccountNumber', 'Account number'],
    ['bankIfsc', 'IFSC', 'Eleven characters: four letters, a zero, then six'],
    ['bankBranch', 'Branch'],
    ['upiId', 'UPI ID'],
  ] },
  { title: 'Contact', fields: [
    ['phone', 'Phone'],
    ['email', 'Email'],
    ['website', 'Website'],
  ] },
];

const LONG = new Set<keyof CompanyDetails>(['registeredAddress', 'siteAddress']);

export function CompanyDetailsForm({ details }: { details: CompanyDetails }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [warnings, setWarnings] = React.useState<string[]>([]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
        start(async () => {
          const r = await saveCompanyDetails(fd);
          if ('error' in r) return toast.error(r.error);
          setWarnings(r.warnings ?? []);
          toast.success(r.warnings?.length ? 'Saved — but please read the warnings' : 'Saved');
          router.refresh();
        });
      }}
    >
      {warnings.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5 p-3">
          <p className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className="h-4 w-4 text-destructive" /> Worth checking</p>
          <ul className="mt-1 list-disc space-y-1 pl-6 text-sm">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </Card>
      )}

      {GROUPS.map((g) => (
        <Card key={g.title} className="p-4">
          <p className="text-sm font-semibold">{g.title}</p>
          {g.note && <p className="mb-3 text-xs text-muted-foreground">{g.note}</p>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {g.fields.map(([key, label, hint]) => (
              <div key={key} className={LONG.has(key) ? 'space-y-1.5 sm:col-span-2' : 'space-y-1.5'}>
                <Label htmlFor={key}>{label}</Label>
                {LONG.has(key)
                  ? <Textarea id={key} name={key} rows={2} defaultValue={details[key]} />
                  : <Input id={key} name={key} defaultValue={details[key]} />}
                {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
              </div>
            ))}
          </div>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save details</Button>
      </div>
    </form>
  );
}
