import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';

/**
 * Is the database behind the code?
 *
 * Deploying without running the migration is the single most confusing failure
 * this app has: a dozen unrelated screens start saying "something went wrong",
 * the app appears to hang, and nothing points at the cause. This checks once
 * per request and says so plainly.
 */
const REQUIRED: Array<[string, string]> = [
  // ── Read by the signed-in layout on EVERY route ──────────────────────────
  //
  // These four are the fatal ones. The layout reads them before anything it
  // wraps renders, so if one is missing every screen in the CRM fails at once
  // rather than one screen failing — and this warning, which lives inside that
  // layout, is exactly what does not get shown. They are listed first because
  // they are the drift worth naming before any other.
  ['User', 'navPrefs'],
  ['User', 'topNavPrefs'],
  ['User', 'activeProjectId'],
  ['Project', 'isActive'],

  // v16.4 — MSME clock on the vendor master
  ['Vendor', 'isMsme'],
  ['Vendor', 'udyamNumber'],
  ['Vendor', 'msmeHasAgreement'],
  // v16.5 — money withheld from a contractor payment, and bill settlement
  ['Voucher', 'vendorBillId'],
  ['Voucher', 'cessAmount'],
  ['Voucher', 'deductionAmount'],

  ['Task', 'repeatEvery'],
  ['Voucher', 'utr'],
  ['Vendor', 'bankIfsc'],
  ['DocChunk', 'requiredPermission'],
  ['TrustedDevice', 'lastSeenAt'],
  ['MailThreadMessage', 'vendorId'],
  ['MessageTemplate', 'departmentId'],
];
const REQUIRED_TABLES = [
  'Voucher', 'MessageTemplate', 'IntegrationConnection',
  'UserOnboarding', 'MarketingAudit', 'WhatsappSession',
  // Batch 13 — land, title and approvals
  'LandParcel', 'ApprovalSanction', 'LitigationMatter',
  // Batch 4 — cash flow and treasury
  'BankAccount', 'BankStatementLine', 'LoanFacility',
  // Batch 5 — programme and progress
  'ProgrammeActivity', 'ActivityDependency', 'DelayEntry',
  // Batch 14 — quality and safety
  'Inspection', 'NonConformance', 'SafetyRecord', 'WorkPermit',
  // Batch 16 — capital, investors & RERA escrow
  'Investor', 'EscrowMovement', 'LoanCovenant',
  // Batch 7 — sales pricing & commission
  'UnitPricing', 'CommissionPayout',
  // Seven-batch pass (v14.12)
  'FeasibilityModel', 'StatutoryObligation', 'GoodsReceipt', 'RiskEntry',
  'ContractRecord', 'SecurityIncident', 'Sop', 'EnvClearanceCondition',
  // Six-batch pass (v14.13)
  'VariationOrder', 'ExpenseClaim', 'MaintenanceCharge', 'DrawingTransmittal',
  'WalkIn', 'CommercialTenancy',
  // Batch 10 — report builder
  'SavedReport',
  // UX-12 — in-app feedback
  'Feedback',
  // C3 — inter-department work requests
  'WorkRequest', 'WorkRequestEvent', 'WorkRequestComment',
  // I4 — universal record linking
  'RecordLink',
  // 31-plan #26 — vendor portal
  'VendorPortalAccess',
  // 31-plan #27 — site telemetry
  'TelemetryDevice', 'SiteReading',
  // Internal chat / direct messaging
  'Conversation', 'ConversationMember', 'ChatMessage', 'ChatAttachment',
  // Contractor running-account billing — the whole module, and it was absent
  // from a live database while this check happily reported "up to date".
  'RaBill', 'RaBillLine',
  // v16.4 — scheduled payment reminders
  'TallyPartyReminder', 'TallyPartyReminderSend',
  // Multi-company Tally, guest sandbox, atomic counters, outbound webhooks
  'TallyCompany', 'TallyImportBatch', 'TallyBill', 'TallyBillAllocation', 'TallyVoucherAudit',
  'GuestSandbox', 'SandboxLead', 'SandboxUnit', 'SandboxTask', 'SandboxNote', 'SandboxLedgerEntry',
  'NumberSequence', 'Webhook', 'MsmePaymentClock',
];

// NOTE: this list is hand-maintained and therefore always at risk of lagging —
// which is exactly what happened: it reported "up to date" while RaBill,
// RaBillLine, Webhook and both reminder tables were missing from production.
// `DB-DRIFT-CHECK.sql` is generated from prisma/schema.prisma and is the
// authoritative answer; this is the cheap in-app approximation of it.

export interface SchemaState { behind: boolean; missing: string[] }

export const checkSchema = cache(async (): Promise<SchemaState> => {
  try {
    const cols = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'
    `;
    const have = new Set(cols.map((c) => `${c.table_name}.${c.column_name}`));
    const tables = new Set(cols.map((c) => c.table_name));

    const missing = [
      ...REQUIRED_TABLES.filter((t) => !tables.has(t)).map((t) => `table ${t}`),
      ...REQUIRED.filter(([t, c]) => tables.has(t) && !have.has(`${t}.${c}`)).map(([t, c]) => `${t}.${c}`),
    ];
    return { behind: missing.length > 0, missing };
  } catch {
    // If the check itself cannot run, say nothing rather than cry wolf.
    return { behind: false, missing: [] };
  }
});
