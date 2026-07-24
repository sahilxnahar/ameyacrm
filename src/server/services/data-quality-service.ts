import 'server-only';
import { prisma } from '@/lib/db/prisma';
import {
  scoreRecord, summariseQuality, ifscCheck, gstinCheck, panCheck, phoneCheck, emailCheck,
  type QualityResult, type QualitySummary, type ConsistencyCheck,
} from '@/lib/dataquality/score';
import { findDuplicates, type DuplicatePair, type DedupeRecord } from '@/lib/dataquality/dedupe';
import { DATA_DICTIONARY, requiredFields, type EntityDoc } from '@/config/data-dictionary';

/**
 * The data-platform read model. Everything here is read-only: it scores and
 * finds duplicates, and changes nothing. A destructive merge is deliberately
 * not part of this batch.
 */

const byKey = (k: string): EntityDoc => {
  const e = DATA_DICTIONARY.find((entity) => entity.key === k);
  if (!e) throw new Error(`Unknown data-quality entity "${k}".`);
  return e;
};

const CHECKS: Record<string, ConsistencyCheck[]> = {
  lead: [phoneCheck, emailCheck],
  vendor: [phoneCheck, emailCheck, gstinCheck, panCheck, ifscCheck],
  customer: [phoneCheck, emailCheck],
};

export interface EntityQuality {
  key: string;
  label: string;
  summary: QualitySummary;
  duplicates: DuplicatePair[];
}

async function loadRecords(key: string): Promise<Array<{ id: string; label: string; values: Record<string, unknown>; dedupe: DedupeRecord }>> {
  if (key === 'lead') {
    const rows = await prisma.lead.findMany({
      where: { deletedAt: null },
      select: { id: true, reference: true, name: true, phone: true, email: true, ownerId: true, requirement: true, projectId: true, consentAt: true, channelPartnerId: true },
      take: 5000,
    });
    return rows.map((r) => ({
      id: r.id, label: r.name || r.reference,
      values: r as unknown as Record<string, unknown>,
      dedupe: { id: r.id, name: r.name, phone: r.phone, email: r.email },
    }));
  }
  if (key === 'vendor') {
    const rows = await prisma.vendor.findMany({
      select: { id: true, name: true, phone: true, email: true, gstin: true, pan: true, bankAccountNumber: true, bankIfsc: true, address: true },
      take: 5000,
    });
    return rows.map((r) => ({
      id: r.id, label: r.name,
      values: r as unknown as Record<string, unknown>,
      dedupe: { id: r.id, name: r.name, phone: r.phone, email: r.email },
    }));
  }
  // customer
  const rows = await prisma.customer.findMany({
    select: { id: true, name: true, phone: true, email: true, bookingId: true, projectId: true },
    take: 5000,
  });
  return rows.map((r) => ({
    id: r.id, label: r.name,
    values: r as unknown as Record<string, unknown>,
    dedupe: { id: r.id, name: r.name, phone: r.phone, email: r.email },
  }));
}

export async function entityQuality(key: string): Promise<EntityQuality> {
  const entity = byKey(key);
  const records = await loadRecords(key);
  const required = requiredFields(entity);
  const checks = CHECKS[key] ?? [];

  const results: QualityResult[] = records.map((r) => scoreRecord(r.id, r.label, r.values, required, checks));
  const duplicates = findDuplicates(records.map((r) => r.dedupe));

  return {
    key,
    label: entity.label,
    summary: summariseQuality(results),
    duplicates,
  };
}

export async function dataQualityOverview(): Promise<EntityQuality[]> {
  return Promise.all(DATA_DICTIONARY.map((e) => entityQuality(e.key)));
}
