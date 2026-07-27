import { describe, it, expect } from 'vitest';
import { buildOpenApiSpec, API_ENDPOINTS, API_GROUPS } from '@/lib/api/openapi';

describe('OpenAPI + developer platform (v15.26)', () => {
  it('generates a valid-shaped OpenAPI 3.1 doc', () => {
    const spec = buildOpenApiSpec('https://crm.example.com') as any;
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.servers[0].url).toBe('https://crm.example.com');
    expect(spec.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
    // every catalogued endpoint has a path+method in the spec
    for (const e of API_ENDPOINTS) {
      expect(spec.paths[e.path]).toBeDefined();
      expect(spec.paths[e.path][e.method.toLowerCase()]).toBeDefined();
    }
  });

  it('marks write endpoints as unsafe and reads as safe', () => {
    const ping = API_ENDPOINTS.find((e) => e.id === 'ping')!;
    const create = API_ENDPOINTS.find((e) => e.id === 'leads-create')!;
    expect(ping.safe).toBe(true);
    expect(create.safe).toBe(false);
  });

  it('requires bearer auth on every operation', () => {
    const spec = buildOpenApiSpec('https://x') as any;
    for (const path of Object.values<any>(spec.paths)) {
      for (const op of Object.values<any>(path)) {
        expect(op.security).toEqual([{ bearerAuth: [] }]);
      }
    }
  });

  it('exposes endpoint groups', () => {
    expect(API_GROUPS).toContain('Leads');
    expect(API_GROUPS).toContain('Sandbox');
  });
});
