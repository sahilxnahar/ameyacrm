'use server';
import type { LeadSource } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { nextReference } from '@/lib/utils/reference';
import { findDuplicateLead } from '@/lib/leads/dedup';
import { ensure, toActionError } from './_helpers';

const SOURCE_MAP: Record<string, LeadSource> = {
  website: 'WEBSITE', referral: 'REFERRAL', 'walk-in': 'WALK_IN', walkin: 'WALK_IN', campaign: 'CAMPAIGN',
  portal: 'PORTAL', '99acres': 'PORTAL', magicbricks: 'PORTAL', housing: 'PORTAL', broker: 'BROKER', nri: 'NRI_DESK',
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

/** Bulk-import leads from CSV text. Dedupes on phone/email. Columns: name (required), email, phone, source, requirement, budget. */
export async function importLeadsCsv(csvText: string): Promise<{ ok: true; created: number; deduped: number; errors: number } | { error: string }> {
  try {
    const ctx = await ensure('lead.create');
    const rows = parseCsv(csvText);
    if (rows.length < 2) return { error: 'CSV needs a header row and at least one lead row.' };
    const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
    const idx = (k: string) => header.indexOf(k);
    const iName = idx('name'), iEmail = idx('email'), iPhone = idx('phone'), iSource = idx('source'), iReq = idx('requirement'), iBudget = idx('budget');
    if (iName < 0) return { error: 'CSV must include a "name" column.' };
    let created = 0, deduped = 0, errors = 0;
    for (const r of rows.slice(1)) {
      const name = (r[iName] || '').trim();
      if (!name) { errors++; continue; }
      const email = iEmail >= 0 ? (r[iEmail] || '').trim().toLowerCase() || null : null;
      const phone = iPhone >= 0 ? (r[iPhone] || '').trim() || null : null;
      try {
        if ((phone || email) && (await findDuplicateLead(phone, email))) { deduped++; continue; }
        const reference = await nextReference('LEAD');
        const src = SOURCE_MAP[(iSource >= 0 ? r[iSource] || '' : '').trim().toLowerCase()] || 'OTHER';
        const budget = iBudget >= 0 && r[iBudget] ? Number(String(r[iBudget]).replace(/[^\d.]/g, '')) || null : null;
        await prisma.lead.create({ data: { reference, name, email, phone, source: src, requirement: iReq >= 0 ? (r[iReq] || '').slice(0, 300) || null : null, budgetMax: budget, ownerId: ctx.user.id, activities: { create: { userId: ctx.user.id, type: 'NOTE', subject: 'Imported from CSV' } } } });
        created++;
      } catch { errors++; }
    }
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Lead', summary: `Imported ${created} leads from CSV (${deduped} duplicates skipped)` });
    revalidatePath('/sales');
    return { ok: true, created, deduped, errors };
  } catch (err) { return toActionError(err); }
}
