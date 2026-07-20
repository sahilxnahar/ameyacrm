'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { COMPANY_DEFAULTS, type CompanyDetails } from '@/config/company';

export type CoResult = { ok: true; warnings?: string[] } | { error: string };

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const STATE: Record<string, string> = {
  '27': 'Maharashtra', '29': 'Karnataka', '33': 'Tamil Nadu', '07': 'Delhi',
  '24': 'Gujarat', '36': 'Telangana', '32': 'Kerala', '19': 'West Bengal',
};

/**
 * Save the statutory details. Format problems are reported as warnings rather
 * than blocking the save — the numbers are yours, but a wrong GSTIN or IFSC on
 * an invoice is worth being told about.
 */
export async function saveCompanyDetails(input: Record<string, string>): Promise<CoResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const clean: CompanyDetails = { ...COMPANY_DEFAULTS };
    for (const k of Object.keys(COMPANY_DEFAULTS) as (keyof CompanyDetails)[]) {
      if (input[k] !== undefined) clean[k] = String(input[k]).trim();
    }
    clean.gstin = clean.gstin.toUpperCase();
    clean.bankIfsc = clean.bankIfsc.toUpperCase();

    const warnings: string[] = [];
    if (clean.gstin && !GSTIN_RE.test(clean.gstin)) {
      warnings.push('That GSTIN does not match the standard 15-character format. Double-check it before issuing invoices.');
    } else if (clean.gstin) {
      const st = STATE[clean.gstin.slice(0, 2)];
      if (st) clean.gstState = `${st} (${clean.gstin.slice(0, 2)})`;
    }
    if (clean.bankIfsc && !IFSC_RE.test(clean.bankIfsc)) {
      warnings.push(`"${clean.bankIfsc}" is not a valid IFSC. It must be 11 characters: four letters, a zero, then six more. Money sent to a wrong IFSC will bounce.`);
    }
    if (clean.bankAccountNumber && !/^\d{9,18}$/.test(clean.bankAccountNumber)) {
      warnings.push('The account number should be 9 to 18 digits.');
    }

    await prisma.setting.upsert({
      where: { key: 'company.details' },
      update: { value: clean as unknown as object },
      create: { key: 'company.details', value: clean as unknown as object },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Setting', summary: 'Updated company statutory details' });
    revalidatePath('/admin/company');
    revalidatePath('/billing');
    return { ok: true, warnings };
  } catch (err) { return toActionError(err); }
}
