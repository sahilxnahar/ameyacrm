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
  GEMINI_API_KEY: z.string().optional(), // Google Gemini — AI document summaries
  CRON_SECRET: z.string().optional(), // guards Vercel Cron endpoints
  INGEST_SECRET: z.string().optional(), // guards the public lead-ingestion webhook
  TELEPHONY_SECRET: z.string().optional(), // guards the telephony (call-recording) webhook
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(), // Google Sheets sync
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_SHEETS_ID: z.string().optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(), // shared Drive folder for document copies
  GAS_WEBAPP_URL: z.string().optional(), // Google Apps Script web app (personal Drive/Sheets — no Cloud Console)
  GAS_SECRET: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),

  // A second AI provider, so a refusal by one account cannot take the whole
  // feature set down. Anything speaking the OpenAI chat-completions shape
  // works here: OpenRouter, Groq, OpenAI, Together, Mistral, DeepInfra.
  AI_BASE_URL: z.string().optional(),        // e.g. https://openrouter.ai/api/v1
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),           // e.g. meta-llama/llama-3.3-70b-instruct
  AI_EMBED_MODEL: z.string().optional(),     // e.g. text-embedding-3-small

  // WhatsApp inbound. The verify token is any string you choose; it just has
  // to match what you type into Meta's webhook screen.
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  META_APP_SECRET: z.string().optional(),

  // The simple way in. A System User token from Meta never expires and skips
  // the whole OAuth dance, which needs App Review for some permissions.
  // Set these three and WhatsApp works without Connected Accounts.
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_WABA_ID: z.string().optional(),

  // Email (pluggable): smtp | ses | resend | console
  EMAIL_PROVIDER: z.enum(['smtp', 'ses', 'resend', 'console']).default('console'),
  EMAIL_FROM: z.string().default('Ameya Heights CRM <no-reply@ameyaheights.com>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.string().default('false').transform((v) => v === 'true' || v === '1'),
  RESEND_API_KEY: z.string().optional(),

  // WhatsApp sending gateway (optional). Any endpoint accepting { to, message }.
  WHATSAPP_WEBHOOK_URL: z.string().optional(),
  WHATSAPP_WEBHOOK_TOKEN: z.string().optional(),
  AWS_SES_REGION: z.string().optional(),

  // Web Push (VAPID). Generate with: npx web-push generate-vapid-keys
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:admin@ameyaheights.com'),
});

export type Env = z.infer<typeof schema>;

const parsed = schema.safeParse(process.env);
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

if (!parsed.success) {
  console.error('❌ Invalid/missing environment variables:\n', parsed.error.flatten().fieldErrors);
  // Do NOT fail the production build on env — only enforce at runtime. This lets a
  // serverless host (Vercel) build the app without secrets present in the build step;
  // real requests still require valid config or fail with a clear message.
  if (!isBuildPhase) {
    throw new Error('Invalid environment configuration. Set the required variables (see DEPLOY.md / .env.example).');
  }
}

export const env: Env = parsed.success
  ? parsed.data
  : (schema.parse({
      ...process.env,
      SESSION_SECRET:
        process.env.SESSION_SECRET || 'build-time-placeholder-change-me-session-secret-0000000000',
      ENCRYPTION_KEY:
        process.env.ENCRYPTION_KEY || 'build-time-placeholder-change-me-encryption-key-000000000',
      DATABASE_URL:
        process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/placeholder',
    }) as Env);
