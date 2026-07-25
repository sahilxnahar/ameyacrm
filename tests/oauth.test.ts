import { describe, it, expect } from 'vitest';
import { signState, verifyState, buildAuthorizeUrl, redirectUriFor } from '@/lib/connectors/oauth';
import { oauthProvider, OAUTH_SLUGS } from '@/config/oauth-providers';

describe('OAuth connector scaffold (v15.31)', () => {
  const now = 1_800_000_000_000;

  it('round-trips a signed state and recovers the slug', () => {
    const state = signState('hubspot-crm', now);
    expect(verifyState(state, now + 1000)).toEqual({ slug: 'hubspot-crm' });
  });

  it('rejects a tampered or expired state', () => {
    const state = signState('slack', now);
    expect(verifyState(state + 'x', now)).toBeNull();
    expect(verifyState(state, now + 11 * 60 * 1000)).toBeNull(); // past TTL
  });

  it('builds a standards-compliant authorize URL', () => {
    const url = buildAuthorizeUrl('google-sheets', { clientId: 'cid', redirectUri: 'https://crm.x/cb', state: 'st' })!;
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('client_id')).toBe('cid');
    expect(u.searchParams.get('redirect_uri')).toBe('https://crm.x/cb');
    expect(u.searchParams.get('state')).toBe('st');
    expect(u.searchParams.get('access_type')).toBe('offline'); // google extra param
  });

  it('derives the callback URL and lists known providers', () => {
    expect(redirectUriFor('https://crm.x', 'zoho-crm')).toBe('https://crm.x/api/connectors/oauth/zoho-crm/callback');
    expect(OAUTH_SLUGS).toContain('salesforce');
    expect(oauthProvider('salesforce')?.tokenUrl).toContain('salesforce.com');
  });
});
