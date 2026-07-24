import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field, FormGrid } from '@/components/ui/field';
import { StatTile, StatTileRow } from '@/components/ui/stat-tile';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ChipRow, ChipLink } from '@/components/ui/chip';
import { Landmark, Inbox } from 'lucide-react';

export const metadata: Metadata = { title: 'Component gallery' };

/**
 * The design-system gallery. It documents the shared component set by showing it,
 * so the next screen (or the next Claude session) builds the right way by copying
 * the right thing rather than re-declaring a local `Tile` and `inputCls`.
 */
export default async function ComponentGalleryPage() {
  await requirePermission('admin.setting.manage');

  return (
    <div className="space-y-8">
      <PageHeader
        title="Component gallery"
        description="The shared UI kit in src/components/ui. Build screens from these — do not re-declare a local Tile, Field or inputCls. This page is how the system stays consistent as it grows."
      />

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Stat tiles">
        <StatTileRow cols={4}>
          <StatTile icon={<Landmark className="h-4 w-4" />} label="Capital stack" value="₹4.2 Cr" sub="3 sources" />
          <StatTile label="Escrow balance" value="₹92 L" sub="₹8 L short" tone="bad" />
          <StatTile label="On track" value="12" sub="of 14 activities" tone="good" />
          <StatTile label="Covenants" value="0" sub="breached" />
        </StatTileRow>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">Approved</Badge>
          <Badge variant="warning">Near breach</Badge>
          <Badge variant="destructive">Breached</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </Section>

      <Section title="Form fields">
        <FormGrid cols={3}>
          <Field label="Name" required><Input placeholder="Ashok Cement" /></Field>
          <Field label="Kind"><Select defaultValue="EQUITY"><option value="EQUITY">equity</option><option value="DEBT">debt</option></Select></Field>
          <Field label="IFSC" error="IFSC is not 11 characters"><Input defaultValue="KKBK00008556" /></Field>
          <Field label="Amount" hint="Indian numbering, e.g. ₹1,50,000"><Input type="number" placeholder="150000" /></Field>
        </FormGrid>
      </Section>

      <Section title="Chips (filter row)">
        <ChipRow>
          <ChipLink href="#" active>All</ChipLink>
          <ChipLink href="#" active={false}>Four94</ChipLink>
          <ChipLink href="#" active={false}>Salavakkam</ChipLink>
        </ChipRow>
      </Section>

      <Section title="Card & empty state">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Card title</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Cards wrap grouped content with the standard border, radius and shadow.</CardContent>
          </Card>
          <EmptyState icon={Inbox} title="Nothing here yet" body="Empty states say what belongs here and offer the next step." />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
