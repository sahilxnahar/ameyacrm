import 'server-only';
import { z } from 'zod';

/**
 * Validated, typed environment. Import from server code only.
 * Fails fast at boot if required secrets are missing/malformed.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  APP_NAME: z.string().default('Ameya Heights CRM'),

  DATABASE_URL: z.string().url(),

  // Session/crypto — must be >= 32 chars. Generate: openssl rand -base64 48
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be a 32-byte base64/hex key'),

  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(30),

  // Auth policy
  MAX_FAILED_LOGINS: z.coerce.number().int().positive().default(5),
  LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
  PASSWORD_EXPIRY_DAYS: z.coerce.number().int().nonnegative().default(90),

  // Storage (S3-compatible: MinIO / AWS S3 / R2)
  STORAGE_PROVIDER: z.enum(['s3', 'local', 'blob']).default('s3'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('ameya-crm'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.string().default('true').transform((v) => v === 'true' || v === '1'),
  BLOB_READ_WRITE_TOKEN: z.string().optional(), // Vercel Blob
  SETUP_SECRET: z.string().optional(), // guards /api/setup after first run

  // Email (pluggable): smtp | ses | resend | console
  EMAIL_PROVIDER: z.enum(['smtp', 'ses', 'resend', 'console']).default('console'),
  EMAIL_FROM: z.string().default('Ameya Heights CRM <no-reply@naharheights.com>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.string().default('false').transform((v) => v === 'true' || v === '1'),
  RESEND_API_KEY: z.string().optional(),
  AWS_SES_REGION: z.string().optional(),

  // Web Push (VAPID). Generate with: npx web-push generate-vapid-keys
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:admin@naharheights.com'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:\n', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration. See errors above.');
}

export const env = parsed.data;
export type Env = z.infer<typeof schema>;
