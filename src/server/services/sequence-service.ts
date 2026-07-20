import 'server-only';
import { randomBytes } from 'node:crypto';
import { addDays, startOfDay } from 'date-fns';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { sendEmail } from '@/lib/email/email';
import { getCompanyDetails } from '@/server/services/company-service';
import { threadKeyFor } from '@/lib/mail/thread';

export interface SequenceRunResult { due: number; sent: number; stopped: number; finished: number; failed: number }

const appUrl = () => env.APP_URL.replace(/\/$/, '');

/** Fill {{placeholders}} from the lead and the company record. */
function merge(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? '');
}

/**
 * Send whatever is due, and exit anyone who no longer belongs in a sequence.
 *
 * Called from the hourly escalation pass. Deliberately conservative: it sends
 * one step per enrolment per run, and never sends outside 08:00–20:00 — a
 * marketing email at 3am reads as spam even when it is not.
 */
export async function runSequences(now = new Date()): Promise<SequenceRunResult> {
  const res: SequenceRunResult = { due: 0, sent: 0, stopped: 0, finished: 0, failed: 0 };

  const hour = now.getHours();
  if (hour < 8 || hour >= 20) return res;

  const enrolments = await prisma.sequenceEnrollment.findMany({
    where: { status: 'RUNNING', nextStepAt: { lte: now } },
    include: { sequence: { include: { steps: { orderBy: { ordinal: 'asc' } } } } },
    take: 100,
  });
  res.due = enrolments.length;
  if (!enrolments.length) return res;

  const company = await getCompanyDetails();

  for (const e of enrolments) {
    try {
      if (e.sequence.status !== 'ACTIVE') continue;

      const lead = await prisma.lead.findUnique({
        where: { id: e.leadId },
        select: { id: true, name: true, email: true, status: true, deletedAt: true, project: { select: { name: true } } },
      });

      // Exit conditions, checked every run rather than only at enrolment.
      let stopReason: string | null = null;
      if (!lead || lead.deletedAt) stopReason = 'Lead removed';
      else if (!lead.email) stopReason = 'No email address';
      else if (lead.status === 'LOST') stopReason = 'Lead marked lost';
      else if (e.sequence.stopOnStage && lead.status === e.sequence.stopOnStage) stopReason = `Reached ${lead.status}`;

      if (stopReason) {
        await prisma.sequenceEnrollment.update({
          where: { id: e.id },
          data: { status: 'STOPPED', endedAt: now, endReason: stopReason },
        });
        res.stopped++;
        continue;
      }

      const step = e.sequence.steps[e.stepsSent];
      if (!step) {
        await prisma.sequenceEnrollment.update({
          where: { id: e.id },
          data: { status: 'FINISHED', endedAt: now, endReason: 'All steps sent' },
        });
        res.finished++;
        continue;
      }

      const vars: Record<string, string> = {
        name: lead!.name,
        firstName: lead!.name.split(' ')[0] ?? lead!.name,
        project: lead!.project?.name ?? company.siteName,
        companyName: company.legalName,
        website: company.website,
        siteAddress: company.siteAddress,
      };

      const token = randomBytes(16).toString('hex');
      const subject = merge(step.subject, vars);
      const body = merge(step.body, vars);
      const html =
        `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.65;color:#14120E">` +
        body.split('\n').map((l) => `<p style="margin:0 0 12px">${l || '&nbsp;'}</p>`).join('') +
        `</div><img src="${appUrl()}/api/track/${token}" width="1" height="1" alt="" style="display:none">`;

      const sent = await sendEmail({ to: [lead!.email!], subject, text: body, html });
      if (!sent.ok) { res.failed++; continue; }

      await prisma.mailThreadMessage.create({
        data: {
          threadKey: threadKeyFor(subject, lead!.email!),
          direction: 'OUTBOUND',
          fromAddress: company.email,
          toAddresses: [lead!.email!],
          subject, bodyText: body, snippet: body.slice(0, 200),
          leadId: lead!.id, trackToken: token, enrollmentId: e.id,
        },
      });

      const nextStep = e.sequence.steps[e.stepsSent + 1];
      await prisma.sequenceEnrollment.update({
        where: { id: e.id },
        data: {
          stepsSent: { increment: 1 },
          nextStepAt: nextStep ? addDays(startOfDay(now), Math.max(1, nextStep.dayOffset - step.dayOffset)) : null,
          ...(nextStep ? {} : { status: 'FINISHED' as const, endedAt: now, endReason: 'All steps sent' }),
        },
      });

      await prisma.leadActivity.create({
        data: { leadId: lead!.id, type: 'EMAIL', subject: `Sequence: ${subject}`, notes: body.slice(0, 500) },
      });

      res.sent++;
      if (!nextStep) res.finished++;
    } catch {
      res.failed++;
    }
  }

  return res;
}
