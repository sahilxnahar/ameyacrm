// Client-safe API surface description + OpenAPI generator (v15.26).
// Used by the /developers playground (the catalogue) and /api/v1/openapi (the spec).

export interface ApiParam { name: string; in: 'query' | 'body'; type: string; required?: boolean; desc: string }
export interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;            // e.g. /api/v1/leads
  summary: string;
  group: string;
  params: ApiParam[];
  sampleBody?: Record<string, unknown>;
  safe: boolean;           // true = no writes (safe to call from the sandbox/playground freely)
}

export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    id: 'ping', method: 'GET', path: '/api/v1/ping', group: 'Sandbox', safe: true,
    summary: 'Verify your token and echo query params — writes nothing. Use this to test connectivity.',
    params: [{ name: 'echo', in: 'query', type: 'string', desc: 'Any text; it comes back in the response.' }],
  },
  {
    id: 'leads-list', method: 'GET', path: '/api/v1/leads', group: 'Leads', safe: true,
    summary: 'List leads, newest first.',
    params: [
      { name: 'limit', in: 'query', type: 'number', desc: 'Max rows (default 100, max 500).' },
      { name: 'status', in: 'query', type: 'string', desc: 'Filter by status (NEW, WON, LOST…).' },
    ],
  },
  {
    id: 'leads-create', method: 'POST', path: '/api/v1/leads', group: 'Leads', safe: false,
    summary: 'Create a lead (deduplicated on phone/email — an existing match is updated).',
    params: [
      { name: 'name', in: 'body', type: 'string', required: true, desc: 'Person or enquiry name.' },
      { name: 'phone', in: 'body', type: 'string', desc: 'Phone (used for dedupe).' },
      { name: 'email', in: 'body', type: 'string', desc: 'Email (used for dedupe).' },
      { name: 'source', in: 'body', type: 'string', desc: 'Where it came from.' },
      { name: 'budgetMax', in: 'body', type: 'number', desc: 'Max budget in rupees.' },
    ],
    sampleBody: { name: 'Test Enquiry', phone: '9800000000', source: 'API', budgetMax: 12000000 },
  },
  {
    id: 'leads-update', method: 'PATCH', path: '/api/v1/leads', group: 'Leads', safe: false,
    summary: 'Update a lead by id, reference, phone or email.',
    params: [
      { name: 'id', in: 'body', type: 'string', desc: 'Lead id (or use reference/phone/email).' },
      { name: 'status', in: 'body', type: 'string', desc: 'New status.' },
    ],
    sampleBody: { phone: '9800000000', status: 'QUALIFIED' },
  },
  {
    id: 'units-list', method: 'GET', path: '/api/v1/units', group: 'Inventory', safe: true,
    summary: 'List units and their availability.',
    params: [{ name: 'limit', in: 'query', type: 'number', desc: 'Max rows.' }],
  },
  {
    id: 'webhooks-list', method: 'GET', path: '/api/v1/webhooks', group: 'Webhooks', safe: true,
    summary: 'List your webhook subscriptions.',
    params: [],
  },
  {
    id: 'webhooks-create', method: 'POST', path: '/api/v1/webhooks', group: 'Webhooks', safe: false,
    summary: 'Subscribe a URL to events (the REST-hook endpoint Zapier/Make use). Returns a signing secret.',
    params: [
      { name: 'url', in: 'body', type: 'string', required: true, desc: 'HTTPS endpoint to POST events to.' },
      { name: 'events', in: 'body', type: 'string[]', desc: 'Events to receive; omit for all.' },
    ],
    sampleBody: { url: 'https://example.com/hook', events: ['lead.created'] },
  },
  {
    id: 'consent-create', method: 'POST', path: '/api/v1/consent', group: 'Privacy', safe: false,
    summary: 'Record a consent event (DPDPA) from a web form or another system.',
    params: [
      { name: 'email', in: 'body', type: 'string', desc: 'Email (or phone).' },
      { name: 'purpose', in: 'body', type: 'string', required: true, desc: 'MARKETING | WHATSAPP | CALLS | DATA_PROCESSING.' },
      { name: 'status', in: 'body', type: 'string', required: true, desc: 'GIVEN | WITHDRAWN.' },
    ],
    sampleBody: { email: 'buyer@example.com', purpose: 'MARKETING', status: 'GIVEN' },
  },
];

export const API_GROUPS = [...new Set(API_ENDPOINTS.map((e) => e.group))];

/** Build an OpenAPI 3.1 document from the endpoint catalogue. */
export function buildOpenApiSpec(baseUrl: string): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of API_ENDPOINTS) {
    const method = e.method.toLowerCase();
    const op: Record<string, unknown> = {
      summary: e.summary,
      tags: [e.group],
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Success' }, '401': { description: 'Unauthorized' } },
    };
    const queryParams = e.params.filter((p) => p.in === 'query');
    if (queryParams.length) {
      op.parameters = queryParams.map((p) => ({ name: p.name, in: 'query', required: !!p.required, schema: { type: p.type === 'number' ? 'integer' : 'string' }, description: p.desc }));
    }
    const bodyParams = e.params.filter((p) => p.in === 'body');
    if (bodyParams.length) {
      op.requestBody = {
        content: { 'application/json': {
          schema: {
            type: 'object',
            required: bodyParams.filter((p) => p.required).map((p) => p.name),
            properties: Object.fromEntries(bodyParams.map((p) => [p.name, { type: p.type.includes('[]') ? 'array' : p.type === 'number' ? 'number' : 'string', description: p.desc }])),
          },
          ...(e.sampleBody ? { example: e.sampleBody } : {}),
        } },
      };
    }
    paths[e.path] = { ...(paths[e.path] ?? {}), [method]: op };
  }
  return {
    openapi: '3.1.0',
    info: { title: 'Ameya Heights CRM API', version: '1.0.0', description: 'Public REST API. Authenticate with a Bearer API token from Admin → API Tokens.' },
    servers: [{ url: baseUrl }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
    tags: API_GROUPS.map((g) => ({ name: g })),
    paths,
  };
}
