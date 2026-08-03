import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/current-user';
import { checkSchema } from '@/server/services/schema-check-service';

export const dynamic = 'force-dynamic';

/**
 * Bring the database up to date when the app itself will not render.
 *
 * The Repair button already existed, and it was unreachable in exactly the
 * situation it was built for. If the database is missing a column the signed-in
 * layout reads, that layout throws before anything inside it renders — so every
 * page becomes "Something went wrong", including every page carrying the button.
 * The recovery tool lived behind the failure it recovers from.
 *
 * This route does not render the app. It needs a valid session and the admin
 * permission, both resolved from the session cookie alone, so it works while
 * every screen is down.
 *
 *   GET  /api/admin/repair   → in a browser: a page with a button.
 *                              from a script: JSON describing what is missing.
 *   POST /api/admin/repair   → apply it. Every statement is idempotent.
 *
 * The GET answers in HTML when a browser asks for HTML, because the first
 * version of this only spoke JSON and told people to "POST to this URL" — which
 * you cannot do from an address bar. A recovery tool that requires opening the
 * developer console is only half a recovery tool.
 */

function page(body: string): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Repair the database · Ameya OS</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; margin: 0;
         min-height: 100vh; display: grid; place-items: center; background: #F7F3EA; color: #14120E; }
  @media (prefers-color-scheme: dark) { body { background: #14120E; color: #F2EEE6; } }
  main { max-width: 40rem; padding: 2rem 1.5rem; }
  h1 { font-size: 1.4rem; margin: 0 0 .5rem; }
  p { line-height: 1.6; color: #5E584C; margin: .5rem 0; }
  @media (prefers-color-scheme: dark) { p { color: #A9A296; } }
  code { background: rgba(128,128,128,.18); padding: .1rem .35rem; border-radius: .25rem; font-size: .9em; }
  ul { line-height: 1.7; }
  button { height: 2.6rem; padding: 0 1.2rem; border: 0; border-radius: .5rem; background: #A07D34;
           color: #fff; font-size: .95rem; cursor: pointer; }
  button:disabled { opacity: .6; cursor: default; }
  pre { background: rgba(128,128,128,.14); padding: .75rem; border-radius: .5rem; overflow: auto; font-size: .8rem; }
  .ok { color: #2F7D4F; font-weight: 600; }
  .bad { color: #B3261E; font-weight: 600; }
</style></head><body><main>${body}</main></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
}

export async function GET(req: Request) {
  await requirePermission('admin.setting.manage');
  const { behind, missing } = await checkSchema();

  const wantsHtml = (req.headers.get('accept') ?? '').includes('text/html');
  if (!wantsHtml) {
    return NextResponse.json({
      behind,
      missing,
      next: behind
        ? 'POST to this same URL to apply the missing pieces.'
        : 'Nothing missing from the list this build checks. DB-DRIFT-CHECK.sql is the authoritative answer.',
    });
  }

  return page(`
    <h1>Repair the database</h1>
    <p>This adds anything this build of Ameya OS needs and your database does not have —
       tables, columns, indexes and foreign keys. It only ever <strong>adds</strong>:
       nothing is dropped, no data is touched, and running it twice is safe.</p>
    ${
      behind
        ? `<p>The quick check found <strong>${missing.length}</strong> missing:</p>
           <ul>${missing.slice(0, 12).map((m) => `<li><code>${m}</code></li>`).join('')}
           ${missing.length > 12 ? `<li>… and ${missing.length - 12} more</li>` : ''}</ul>`
        : `<p>The quick check found nothing missing — but that check runs off a
             hand-maintained list, and a stale list is what let this drift build up in the
             first place. <code>DB-DRIFT-CHECK.sql</code> is generated from the schema and
             is the authoritative answer. Running the repair anyway costs nothing.</p>`
    }
    <p><button id="go">Repair now</button></p>
    <div id="out"></div>
    <script>
      const btn = document.getElementById('go');
      const out = document.getElementById('out');
      btn.addEventListener('click', async () => {
        btn.disabled = true; btn.textContent = 'Repairing…'; out.innerHTML = '';
        try {
          const res = await fetch(location.pathname, { method: 'POST', headers: { accept: 'application/json' } });
          const data = await res.json();
          const good = res.ok && data.failed === 0;
          out.innerHTML =
            '<p class="' + (good ? 'ok' : 'bad') + '">' +
            (good
              ? data.applied + ' statements applied to "' + data.database + '". Nothing failed.'
              : data.failed + ' statement(s) failed on "' + data.database + '".') +
            '</p><pre>' + JSON.stringify(data, null, 2) + '</pre>' +
            (good ? '<p>Now re-run DB-DRIFT-CHECK.sql, then MIGRATION_v16.5_all.sql. <a href="/dashboard">Back to the CRM</a></p>' : '');
        } catch (e) {
          out.innerHTML = '<p class="bad">The request failed: ' + (e && e.message ? e.message : e) + '</p>';
        }
        btn.disabled = false; btn.textContent = 'Repair again';
      });
    </script>
  `);
}

export async function POST() {
  const ctx = await requirePermission('admin.setting.manage');
  const { repairSchema } = await import('@/server/services/bootstrap');
  const r = await repairSchema();

  // Audited like the button is — a schema change made from an address bar is
  // still a schema change, and it must be attributable.
  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({
    actorId: ctx.user.id, action: 'UPDATE', entityType: 'Setting',
    summary: `Database repair via API: ${r.ran} statements applied, ${r.failed} failed on "${r.database}"`,
  }).catch(() => undefined);

  return NextResponse.json({
    applied: r.ran,
    failed: r.failed,
    database: r.database,
    usedDirectConnection: r.usedDirect,
    errors: r.errors,
    next: r.failed === 0
      ? 'Done. Re-run DB-DRIFT-CHECK.sql, then MIGRATION_v16.5_all.sql.'
      : 'Some statements failed — the messages above say why. Fix those and repair again.',
  }, { status: r.failed === 0 ? 200 : 500 });
}
