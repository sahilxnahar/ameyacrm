import 'server-only';
import type { TaskStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { sendEmail } from '@/lib/email/email';
import { signTaskActionToken } from '@/lib/tasks/action-token';

/**
 * The daily "here are your open tasks" email — each row carries a one-tap
 * "Mark done" button (a signed link) so a task can be closed straight from the
 * inbox without signing in. Sent at most once a day per person; the guard lives
 * in the Setting table so running the cron twice never double-sends.
 */
const appUrl = () => env.APP_URL.replace(/\/$/, '');
const OPEN: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED'];

interface DigestTask { id: string; reference: string; title: string; dueDate: Date | null; priority: string }

export async function runTaskDigests(now = new Date()): Promise<{ users: number; emails: number }> {
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
  const today = now.toISOString().slice(0, 10);

  const tasks = await prisma.task.findMany({
    where: {
      status: { in: OPEN },
      OR: [{ dueDate: null }, { dueDate: { lte: endOfToday } }],
    },
    select: { id: true, reference: true, title: true, dueDate: true, priority: true, assignees: { select: { userId: true } } },
    take: 2000,
  });
  if (!tasks.length) return { users: 0, emails: 0 };

  const byUser = new Map<string, DigestTask[]>();
  for (const t of tasks) {
    for (const a of t.assignees) {
      const arr = byUser.get(a.userId) ?? [];
      arr.push({ id: t.id, reference: t.reference, title: t.title, dueDate: t.dueDate, priority: t.priority });
      byUser.set(a.userId, arr);
    }
  }

  const userIds = [...byUser.keys()];
  const users = new Map(
    (await prisma.user.findMany({ where: { id: { in: userIds }, status: 'ACTIVE' }, select: { id: true, name: true, email: true } }))
      .map((u) => [u.id, u]),
  );

  let emails = 0;
  for (const [uid, list] of byUser) {
    const u = users.get(uid);
    if (!u?.email) continue;

    const key = `taskdigest:${uid}`;
    const seen = await prisma.setting.findUnique({ where: { key } });
    if (seen?.value === today) continue; // already sent today

    const rows = list
      .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))
      .slice(0, 20);

    const items = await Promise.all(rows.map(async (t) => ({
      t,
      doneUrl: `${appUrl()}/api/tasks/act?token=${await signTaskActionToken({ taskId: t.id, uid, act: 'done' })}`,
    })));

    const mail = buildDigest(u.name, items, now, list.length);
    const r = await sendEmail({ to: [u.email], subject: mail.subject, text: mail.text, html: mail.html });
    if (r.ok) {
      emails++;
      await prisma.setting.upsert({ where: { key }, update: { value: today }, create: { key, value: today } }).catch(() => undefined);
    }
  }
  return { users: byUser.size, emails };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const fmtDue = (d: Date | null, now: Date) => {
  if (!d) return 'No due date';
  const days = Math.floor((d.getTime() - now.getTime()) / 864e5);
  if (days < 0) return `Overdue by ${Math.abs(days)}d`;
  if (days === 0) return 'Due today';
  return `Due in ${days}d`;
};

function buildDigest(name: string, items: { t: DigestTask; doneUrl: string }[], now: Date, total: number) {
  const first = name.split(' ')[0] || name;
  const rowsHtml = items.map(({ t, doneUrl }) => {
    const overdue = t.dueDate && t.dueDate.getTime() < now.getTime();
    return (
      `<tr>` +
      `<td style="padding:12px 0;border-bottom:1px solid #eee">` +
      `<div style="font-weight:600;color:#16140f">${escapeHtml(t.title)}</div>` +
      `<div style="font-size:12px;color:${overdue ? '#9B111E' : '#8a8579'}">${escapeHtml(t.reference)} · ${escapeHtml(fmtDue(t.dueDate, now))}</div>` +
      `</td>` +
      `<td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">` +
      `<a href="${doneUrl}" style="display:inline-block;background:#1B2A4A;color:#fff;text-decoration:none;padding:8px 14px;border-radius:7px;font-weight:600;font-size:13px">Mark done ✓</a>` +
      `</td></tr>`
    );
  }).join('');

  const html =
    `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#16140f">` +
    `<div style="height:4px;width:44px;background:#A07D34;border-radius:2px;margin-bottom:16px"></div>` +
    `<h2 style="margin:0 0 4px;color:#1B2A4A">Good morning, ${escapeHtml(first)}</h2>` +
    `<p style="margin:0 0 16px;color:#45423a">Here ${items.length === 1 ? 'is your open task' : `are your ${items.length} open tasks`}${total > items.length ? ` (of ${total})` : ''}. Tap “Mark done” on anything you’ve finished — no need to sign in.</p>` +
    `<table style="width:100%;border-collapse:collapse">${rowsHtml}</table>` +
    `<p style="margin:20px 0 0"><a href="${appUrl()}/tasks" style="color:#1B2A4A;font-weight:600">Open all tasks in the CRM →</a></p>` +
    `<p style="font-size:12px;color:#8a8579;margin-top:18px">You’re getting this because tasks are assigned to you. — Ameya Heights CRM</p>` +
    `</div>`;

  const text = [
    `Good morning ${first},`,
    '',
    `You have ${total} open task(s). Open them: ${appUrl()}/tasks`,
    '',
    ...items.map(({ t, doneUrl }) => `• ${t.title} (${t.reference}, ${fmtDue(t.dueDate, now)})\n  Mark done: ${doneUrl}`),
    '',
    '— Ameya Heights CRM',
  ].join('\n');

  return { subject: `Your tasks for today — ${items.length} open`, text, html };
}
