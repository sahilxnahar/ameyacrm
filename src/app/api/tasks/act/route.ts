import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { notifyMany } from '@/lib/notifications/notify';
import { verifyTaskActionToken } from '@/lib/tasks/action-token';
import { env } from '@/config/env';

export const dynamic = 'force-dynamic';

const appUrl = () => env.APP_URL.replace(/\/$/, '');

/**
 * One-click task actions from an email — no sign-in needed. The link is a signed
 * token that names exactly one task and one action, so it cannot be tampered
 * with. Marking a task done here is the same as doing it in the app: it records
 * who did it and when, and tells the watchers.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const claim = await verifyTaskActionToken(token);
  if (!claim) return page('Link expired', 'This link is no longer valid. Please open the CRM and update the task there.', false);

  const task = await prisma.task.findUnique({
    where: { id: claim.taskId },
    include: { assignees: true, watchers: true },
  });
  if (!task) return page('Task not found', 'That task no longer exists — it may have been deleted.', false);

  const user = await prisma.user.findUnique({ where: { id: claim.uid }, select: { id: true, name: true } });
  const who = user?.name ?? 'Someone';

  if (task.status === 'DONE') {
    return page('Already done', `“${task.title}” is already marked as done. Nothing more to do.`, true);
  }

  await prisma.task.update({ where: { id: task.id }, data: { status: 'DONE', completedAt: new Date() } });
  await prisma.taskActivity.create({ data: { taskId: task.id, actorId: claim.uid, action: 'status_changed', meta: { status: 'DONE', via: 'email' } } });
  await writeAudit({ actorId: claim.uid, action: 'UPDATE', entityType: 'Task', entityId: task.id, summary: `Marked ${task.reference} done via email` });

  const watchers = [...task.assignees.map((a) => a.userId), ...task.watchers.map((w) => w.userId), task.createdById]
    .filter((id): id is string => Boolean(id) && id !== claim.uid);
  await notifyMany(watchers, { type: 'TASK_UPDATED', title: `${task.reference} marked done by ${who}`, link: `/tasks/${task.id}` }).catch(() => undefined);

  return page('Done ✓', `“${task.title}” is now marked as done. Thank you, ${who.split(' ')[0]}.`, true);
}

/** A small self-contained confirmation page in the house colours. */
function page(heading: string, message: string, ok: boolean): Response {
  const accent = ok ? '#1B2A4A' : '#9B111E';
  const html =
    `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>` +
    `<title>${escapeHtml(heading)} — Ameya Heights CRM</title></head>` +
    `<body style="margin:0;font-family:Inter,Arial,sans-serif;background:#f6f3ec;color:#16140f">` +
    `<div style="max-width:460px;margin:12vh auto;padding:32px;background:#fff;border-radius:16px;box-shadow:0 10px 40px rgba(16,15,13,.10);text-align:center">` +
    `<div style="width:44px;height:4px;background:#A07D34;border-radius:2px;margin:0 auto 20px"></div>` +
    `<h1 style="margin:0 0 8px;font-size:22px;color:${accent}">${escapeHtml(heading)}</h1>` +
    `<p style="margin:0 0 24px;color:#45423a;font-size:15px;line-height:1.5">${escapeHtml(message)}</p>` +
    `<a href="${appUrl()}/tasks" style="display:inline-block;background:#1B2A4A;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:14px">Open the CRM</a>` +
    `<p style="margin:22px 0 0;font-size:12px;color:#8a8579">Ameya Heights CRM</p>` +
    `</div></body></html>`;
  return new Response(html, { status: ok ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
