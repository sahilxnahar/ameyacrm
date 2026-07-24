/**
 * Which optional subsystems are actually configured (I2). A feature that needs a
 * helper checks the capability first and adapts — showing "connect this to enable
 * it" — instead of calling something that isn't there and erroring. One honest
 * source of truth for "is this switched on".
 */
export type Capability = 'ai' | 'whatsapp' | 'email' | 'sms' | 'maps' | 'storage' | 'realtime';

function has(...vars: string[]): boolean {
  return vars.some((v) => Boolean(process.env[v] && process.env[v]!.trim()));
}

const CHECKS: Record<Capability, () => boolean> = {
  ai: () => has('GEMINI_API_KEY', 'GOOGLE_AI_API_KEY', 'OPENAI_API_KEY'),
  whatsapp: () => has('WHATSAPP_TOKEN', 'META_WHATSAPP_TOKEN', 'WHATSAPP_PHONE_ID', 'OPENWA_API_URL'),
  email: () => has('RESEND_API_KEY', 'SMTP_HOST', 'SMTP_URL', 'EMAIL_SERVER'),
  sms: () => has('TWILIO_AUTH_TOKEN', 'SMS_API_KEY'),
  // Maps use OpenStreetMap via MapLibre + Nominatim — no key, no billing, always
  // available. (A key is only relevant if you ever switch to Google/Mapbox.)
  maps: () => true,
  storage: () => has('BLOB_READ_WRITE_TOKEN', 'S3_BUCKET', 'AWS_S3_BUCKET'),
  realtime: () => has('REALTIME_PUBLISH_URL', 'NEXT_PUBLIC_REALTIME_SSE_URL'),
};

/** True when the named capability has the configuration it needs to work. */
export function isConfigured(cap: Capability): boolean {
  try {
    return CHECKS[cap]?.() ?? false;
  } catch {
    return false;
  }
}

/** A map of every capability's state — handy for the settings / health views. */
export function capabilityStatus(): Record<Capability, boolean> {
  return (Object.keys(CHECKS) as Capability[]).reduce((acc, cap) => {
    acc[cap] = isConfigured(cap);
    return acc;
  }, {} as Record<Capability, boolean>);
}
