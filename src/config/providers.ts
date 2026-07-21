/**
 * External accounts the CRM can connect to.
 *
 * Every one of these uses the same shape: you register an app once with the
 * vendor, put two values in Vercel, and from then on connecting is a login.
 * The prerequisites below are stated plainly because none of these vendors
 * allow a pure "just log in" flow without an app registered first — anyone
 * who tells you otherwise is hiding a setup step.
 */
export interface Provider {
  key: string;
  name: string;
  what: string;
  group: 'Messaging' | 'Advertising' | 'Pages';
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Extra things the vendor requires before the login will work at all. */
  prerequisites: string[];
  /** Honest note about cost. */
  cost: string;
  docs: string;
}

export const PROVIDERS: Provider[] = [
  {
    key: 'whatsapp',
    name: 'WhatsApp Business (WABA)',
    what: 'Send booking confirmations, payment reminders and site updates to buyers on WhatsApp, and receive their replies in the CRM.',
    group: 'Messaging',
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    scopes: ['whatsapp_business_messaging', 'whatsapp_business_management', 'business_management'],
    clientIdEnv: 'META_APP_ID',
    clientSecretEnv: 'META_APP_SECRET',
    prerequisites: [
      'A Meta app at developers.facebook.com with WhatsApp added',
      'A verified Meta Business account (business verification takes a few days)',
      'A phone number registered to the WABA that is not on the normal WhatsApp app',
      'Message templates approved by Meta before you can message anyone first',
    ],
    cost: 'Meta charges per 24-hour conversation. Utility templates to Indian numbers are a few paise each; there is no monthly fee.',
    docs: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
  },
  {
    key: 'meta_business',
    name: 'Meta Business',
    what: 'The umbrella account that owns your WhatsApp number, Facebook page, Instagram and ad accounts. Connect this first.',
    group: 'Pages',
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    scopes: ['business_management'],
    clientIdEnv: 'META_APP_ID',
    clientSecretEnv: 'META_APP_SECRET',
    prerequisites: ['A Meta app at developers.facebook.com', 'You must be an admin of the Business account'],
    cost: 'Free.',
    docs: 'https://developers.facebook.com/docs/marketing-api/business-manager',
  },
  {
    key: 'facebook_page',
    name: 'Facebook & Instagram Pages',
    what: 'Pull comments, messages and page enquiries into the CRM as leads, so nothing sits unanswered in an inbox nobody checks.',
    group: 'Pages',
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    scopes: ['pages_show_list', 'pages_read_engagement', 'pages_manage_metadata', 'instagram_basic', 'leads_retrieval'],
    clientIdEnv: 'META_APP_ID',
    clientSecretEnv: 'META_APP_SECRET',
    prerequisites: ['A Meta app', 'Page admin rights', 'App Review for leads_retrieval if you want Lead Ads forms'],
    cost: 'Free.',
    docs: 'https://developers.facebook.com/docs/pages-api',
  },
  {
    key: 'facebook_ads',
    name: 'Facebook / Instagram Ads',
    what: 'Read spend, cost per lead and campaign performance, and match ad leads to bookings so you know which campaign actually sold a flat.',
    group: 'Advertising',
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    scopes: ['ads_read', 'ads_management', 'business_management'],
    clientIdEnv: 'META_APP_ID',
    clientSecretEnv: 'META_APP_SECRET',
    prerequisites: ['A Meta app', 'Ad account admin rights', 'Advanced Access for ads_read via App Review to go beyond your own ad account'],
    cost: 'Free to read. You still pay Meta for the ads themselves.',
    docs: 'https://developers.facebook.com/docs/marketing-apis',
  },
  {
    key: 'google_ads',
    name: 'Google Ads',
    what: 'Read spend, keywords and cost per lead, and attribute bookings back to the search campaign that produced them.',
    group: 'Advertising',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/adwords'],
    clientIdEnv: 'GOOGLE_ADS_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_ADS_CLIENT_SECRET',
    prerequisites: [
      'A Google Cloud Console project with the Google Ads API enabled — this is the one you have been avoiding',
      'A developer token from your Google Ads manager account (basic access is free but must be applied for)',
      'OAuth consent screen configured',
    ],
    cost: 'The API is free. The Cloud project needs no billing card for Ads API access, but it does mean using Cloud Console.',
    docs: 'https://developers.google.com/google-ads/api/docs/start',
  },
];

export const PROVIDER_BY_KEY = Object.fromEntries(PROVIDERS.map((p) => [p.key, p])) as Record<string, Provider>;
