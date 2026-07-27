'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { renewalDueDate } from '@/lib/legal/trademark';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export interface TrademarkInput {
  mark: string;
  proprietor: string;
  niceClass?: number;
  applicationNo?: string | null;
  status?: string;
  projectId?: string | null;
  filedOn?: string | null;
  registeredOn?: string | null;
  objectionText?: string | null;
  deadlineOn?: string | null;
  agentName?: string | null;
}

const STATUSES = ['FILED', 'FORMALITIES_CHK', 'EXAMINATION', 'OBJECTED', 'OPPOSED', 'ACCEPTED_ADVERTISED', 'REGISTERED', 'ABANDONED', 'REFUSED', 'RENEWAL_DUE'] as const;
type TmStatus = (typeof STATUSES)[number];
function asStatus(s?: string): TmStatus { return (STATUSES as readonly string[]).includes(s ?? '') ? (s as TmStatus) : 'FILED'; }
function asDate(s?: string | null): Date | null { if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; }

export async function saveTrademark(input: TrademarkInput, id?: string): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    await ensure('document.create');
    const registeredOn = asDate(input.registeredOn);
    const status = asStatus(input.status);
    const data = {
      mark: input.mark.trim(),
      proprietor: input.proprietor.trim(),
      niceClass: Number.isFinite(input.niceClass) ? Number(input.niceClass) : 37,
      applicationNo: input.applicationNo?.trim() || null,
      status,
      projectId: input.projectId || null,
      filedOn: asDate(input.filedOn),
      registeredOn,
      // Auto-compute the 10-year renewal the moment a registration date is set.
      renewalDueOn: registeredOn ? renewalDueDate(registeredOn) : null,
      objectionText: input.objectionText?.trim() || null,
      deadlineOn: asDate(input.deadlineOn),
      agentName: input.agentName?.trim() || null,
    };
    if (!data.mark || !data.proprietor) return { error: 'Mark and proprietor are required.' };

    const row = id
      ? await prisma.trademark.update({ where: { id }, data })
      : await prisma.trademark.create({ data });
    await writeAudit({ action: id ? 'UPDATE' : 'CREATE', entityType: 'Trademark', entityId: row.id, summary: `${id ? 'Updated' : 'Registered'} trademark "${data.mark}" (class ${data.niceClass})` });
    revalidatePath('/ip-registry');
    return { ok: true, id: row.id };
  } catch (err) { return toActionError(err); }
}

export async function deleteTrademark(id: string): Promise<{ ok: true } | { error: string }> {
  try {
    await ensure('document.create');
    await prisma.trademark.delete({ where: { id } });
    await writeAudit({ action: 'DELETE', entityType: 'Trademark', entityId: id, summary: 'Deleted trademark' });
    revalidatePath('/ip-registry');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
