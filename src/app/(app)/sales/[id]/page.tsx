import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Mail, Phone, Globe2 } from 'lucide-react';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LeadActivityLogger } from '@/components/sales/lead-activity-logger';
import { LeadBookingPanel } from '@/components/sales/lead-booking-panel';
import { WhatsAppButton } from '@/components/sales/whatsapp-button';
import { formatCurrency, formatDateTime, titleCase } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Lead' };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission('lead.view');
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true } },
      project: { select: { name: true } },
      activities: { orderBy: { occurredAt: 'desc' }, include: { user: { select: { name: true } } } },
      bookings: { orderBy: { createdAt: 'desc' }, include: { payments: { orderBy: { dueDate: 'asc' } } } },
    },
  });
  if (!lead) notFound();

  const canBook = can(ctx.permissions, 'booking.manage');
  const units = lead.projectId
    ? await prisma.unit.findMany({ where: { projectId: lead.projectId, status: { in: ['AVAILABLE', 'HELD'] } }, select: { id: true, code: true }, orderBy: { code: 'asc' } })
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-semibold">{lead.name}</h1>
          {lead.isNri && <Badge variant="warning"><Globe2 className="mr-1 h-3 w-3" />NRI · {lead.country}</Badge>}
          <Badge>{titleCase(lead.status)}</Badge>
        </div>
        <p className="font-mono text-xs text-muted-foreground">{lead.reference}</p>
        {lead.requirement && <p className="text-sm text-muted-foreground">{lead.requirement}</p>}

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">Communication timeline</CardTitle>
            <LeadActivityLogger leadId={lead.id} />
          </CardHeader>
          <CardContent className="space-y-3">
            {lead.activities.length === 0 && <p className="text-sm text-muted-foreground">No activity logged.</p>}
            {lead.activities.map((a) => (
              <div key={a.id} className="border-l-2 border-primary/40 pl-3">
                <p className="text-sm"><Badge variant="secondary" className="mr-2">{titleCase(a.type)}</Badge>{a.subject}</p>
                {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
                <p className="mt-0.5 text-[10px] text-muted-foreground">{a.user?.name ?? '—'} · {formatDateTime(a.occurredAt)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {canBook && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Booking &amp; payments</CardTitle></CardHeader>
            <CardContent>
              <LeadBookingPanel
                leadId={lead.id}
                units={units.map((u) => ({ id: u.id, name: u.code }))}
                bookings={lead.bookings.map((b) => ({
                  id: b.id, reference: b.reference, status: b.status, paymentStatus: b.paymentStatus,
                  agreementValue: b.agreementValue ? Number(b.agreementValue) : null,
                  milestones: b.payments.map((m) => ({ id: m.id, label: m.label, amount: Number(m.amount), dueDate: m.dueDate ? m.dueDate.toISOString() : null, status: m.status })),
                }))}
              />
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {lead.email ?? '—'}</p>
          <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {lead.phone ?? '—'}</p>
          <WhatsAppButton phone={lead.phone} name={lead.name} />
          <p className="text-muted-foreground">Source: {titleCase(lead.source)}</p>
          <p className="text-muted-foreground">Owner: {lead.owner?.name ?? '—'}</p>
          <p className="text-muted-foreground">Project: {lead.project?.name ?? '—'}</p>
          <p className="text-muted-foreground">Budget: {formatCurrency(lead.budgetMin ? Number(lead.budgetMin) : null)} – {formatCurrency(lead.budgetMax ? Number(lead.budgetMax) : null)}</p>
          {lead.isNri && lead.timezone && <p className="text-muted-foreground">Time zone: {lead.timezone}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
