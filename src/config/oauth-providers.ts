// Client-safe catalogue of OAuth2 endpoints, keyed by connector slug (v15.31).
// The authorize/token URLs are the providers' public, standard endpoints. Each
// org supplies its OWN client id/secret (from an app it registers with the
// provider) and registers our callback URL — then the standard authorization-code
// flow in /api/connectors/oauth/[slug]/* connects it.

export interface OAuthProvider {
  slug: string;
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  extraAuthParams?: Record<string, string>;
  docs?: string;
}

const GOOGLE = { authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth', tokenUrl: 'https://oauth2.googleapis.com/token', extra: { access_type: 'offline', prompt: 'consent' } };
const MS = { authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token' };

export const OAUTH_PROVIDERS: OAuthProvider[] = [
  // Note: Slack is offered via the webhook messaging driver (simpler, no OAuth app),
  // so it is intentionally not listed here to avoid a duplicate connector entry.
  { slug: 'google-sheets', label: 'Google Sheets', ...GOOGLE, scope: 'https://www.googleapis.com/auth/spreadsheets', extraAuthParams: GOOGLE.extra },
  { slug: 'google-drive', label: 'Google Drive', ...GOOGLE, scope: 'https://www.googleapis.com/auth/drive.file', extraAuthParams: GOOGLE.extra },
  { slug: 'google-calendar', label: 'Google Calendar', ...GOOGLE, scope: 'https://www.googleapis.com/auth/calendar.events', extraAuthParams: GOOGLE.extra },
  { slug: 'gmail', label: 'Gmail', ...GOOGLE, scope: 'https://www.googleapis.com/auth/gmail.send', extraAuthParams: GOOGLE.extra },
  { slug: 'hubspot-crm', label: 'HubSpot CRM', authorizeUrl: 'https://app.hubspot.com/oauth/authorize', tokenUrl: 'https://api.hubapi.com/oauth/v1/token', scope: 'crm.objects.contacts.read crm.objects.contacts.write' },
  { slug: 'zoho-crm', label: 'Zoho CRM', authorizeUrl: 'https://accounts.zoho.in/oauth/v2/auth', tokenUrl: 'https://accounts.zoho.in/oauth/v2/token', scope: 'ZohoCRM.modules.ALL', extraAuthParams: { access_type: 'offline' } },
  { slug: 'salesforce', label: 'Salesforce', authorizeUrl: 'https://login.salesforce.com/services/oauth2/authorize', tokenUrl: 'https://login.salesforce.com/services/oauth2/token', scope: 'api refresh_token' },
  { slug: 'microsoft-teams', label: 'Microsoft Teams', ...MS, scope: 'offline_access ChannelMessage.Send' },
  { slug: 'outlook', label: 'Outlook', ...MS, scope: 'offline_access Mail.Send' },
  { slug: 'onedrive', label: 'OneDrive', ...MS, scope: 'offline_access Files.ReadWrite' },
  { slug: 'zoom', label: 'Zoom', authorizeUrl: 'https://zoom.us/oauth/authorize', tokenUrl: 'https://zoom.us/oauth/token', scope: 'meeting:write' },
  { slug: 'dropbox', label: 'Dropbox', authorizeUrl: 'https://www.dropbox.com/oauth2/authorize', tokenUrl: 'https://api.dropboxapi.com/oauth2/token', scope: 'files.content.write', extraAuthParams: { token_access_type: 'offline' } },
  { slug: 'xero', label: 'Xero', authorizeUrl: 'https://login.xero.com/identity/connect/authorize', tokenUrl: 'https://identity.xero.com/connect/token', scope: 'offline_access accounting.transactions' },
  { slug: 'quickbooks', label: 'QuickBooks', authorizeUrl: 'https://appcenter.intuit.com/connect/oauth2', tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', scope: 'com.intuit.quickbooks.accounting' },
];

const BY_SLUG = new Map(OAUTH_PROVIDERS.map((p) => [p.slug, p]));
export function oauthProvider(slug: string): OAuthProvider | undefined { return BY_SLUG.get(slug); }
export const OAUTH_SLUGS = OAUTH_PROVIDERS.map((p) => p.slug);
