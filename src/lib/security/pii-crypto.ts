import 'server-only';
import { encrypt, decryptSafe, looksEncrypted } from '@/lib/utils/crypto';

/**
 * Transparent at-rest encryption for the highest-risk personal / financial
 * identifiers. This runs inside the Prisma client extension (src/lib/db/prisma.ts)
 * so it applies to EVERY read and write, no matter which action, service, PDF or
 * view made the call — there is no call site to forget.
 *
 * What is protected: full bank account numbers and PAN (permanent account
 * number) — the fields that turn a database or backup leak into real fraud
 * material. Semi-public business identifiers (GSTIN, IFSC) and already-minimised
 * fields (BankAccount stores only the last four digits) are deliberately left in
 * the clear so they stay searchable and joinable.
 *
 * Backward compatibility: encryption is non-destructive. Rows written before this
 * shipped are still plain text; decryptSafe() returns them unchanged, and they
 * become encrypted the next time they are written. No bulk migration, no risk of
 * a value becoming unreadable.
 *
 * Note: values are encrypted with a random IV, so an encrypted column can no
 * longer be used in a WHERE filter or a unique constraint. None of the protected
 * fields are used that way.
 */

// Exact model.field pairs to protect. Model names are Prisma's delegate names
// (lower-camel), matching what the extension receives.
const PROTECTED: Record<string, Set<string>> = {
  Vendor: new Set(['bankAccountNumber', 'pan']),
  /*
   * AMH-022 — `bankDetails` was not here.
   *
   * ChannelPartner.panNumber was protected and the free-text bank field next to
   * it was not, so a broker's account number and IFSC sat in plaintext in the
   * same row as an encrypted PAN. Whatever the PAN was being protected FROM —
   * a leaked dump, a mis-scoped read replica, a support engineer with query
   * access — reached the bank details untouched, and those are the ones you can
   * actually send money with.
   */
  ChannelPartner: new Set(['panNumber', 'bankDetails']),
  /*
   * A passport number is the identity document Ameya holds for NRI buyers, and
   * it is worth more to whoever takes a copy of this table than the PAN beside
   * it. It was stored in the clear.
   */
  NriComplianceProfile: new Set(['passportNo']),
};

// Flat set of every protected field name, for fast result-tree walking where the
// owning model is not always known (nested includes).
const PROTECTED_FIELD_NAMES = new Set<string>(
  Object.values(PROTECTED).flatMap((s) => [...s]),
);

/** Is any field on this model protected? */
export function modelHasPII(model: string | undefined): boolean {
  return !!model && model in PROTECTED;
}

function encryptValue(v: unknown): unknown {
  if (typeof v !== 'string' || v.length === 0) return v;
  if (looksEncrypted(v)) return v; // already encrypted — don't double-wrap
  return encrypt(v);
}

/**
 * Encrypt protected fields inside a write payload in place. Handles both plain
 * assignments (`field: 'x'`) and update wrappers (`field: { set: 'x' }`), and
 * recurses into nested relation writes — but never into a `where` filter, since
 * an encrypted value cannot be matched by equality.
 */
function encryptData(data: unknown): void {
  if (!data || typeof data !== 'object') return;
  if (Array.isArray(data)) { for (const item of data) encryptData(item); return; }
  const obj = data as Record<string, unknown>;
  for (const [k, val] of Object.entries(obj)) {
    if (k === 'where') continue; // nested relation update filters — leave alone
    if (PROTECTED_FIELD_NAMES.has(k)) {
      if (val && typeof val === 'object' && !Array.isArray(val) && 'set' in (val as object)) {
        (val as { set: unknown }).set = encryptValue((val as { set: unknown }).set);
      } else {
        obj[k] = encryptValue(val);
      }
      continue;
    }
    if (val && typeof val === 'object') encryptData(val); // nested relation writes
  }
}

/** Encrypt protected fields across all the data holders an operation may carry. */
export function encryptWriteArgs(args: Record<string, unknown> | undefined): void {
  if (!args) return;
  if ('data' in args) encryptData(args.data);
  if ('create' in args) encryptData(args.create); // upsert
  if ('update' in args) encryptData(args.update); // upsert
}

/**
 * Decrypt protected fields anywhere in a query result. Walks the whole tree so
 * nested includes (e.g. a Bill with its Vendor) are covered too. decryptSafe is
 * idempotent on plain text, so a same-named field on unrelated data is harmless.
 */
export function decryptResult(value: unknown, depth = 0): unknown {
  if (value == null || depth > 8) return value;
  if (Array.isArray(value)) { for (let i = 0; i < value.length; i++) value[i] = decryptResult(value[i], depth + 1); return value; }
  if (typeof value !== 'object') return value;
  const obj = value as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if (PROTECTED_FIELD_NAMES.has(k) && typeof v === 'string') {
      obj[k] = decryptSafe(v);
    } else if (v && typeof v === 'object') {
      decryptResult(v, depth + 1);
    }
  }
  return obj;
}

const WRITE_OPS = new Set([
  'create', 'createMany', 'createManyAndReturn', 'update', 'updateMany',
  'updateManyAndReturn', 'upsert',
]);

export function isWriteOp(operation: string): boolean {
  return WRITE_OPS.has(operation);
}
