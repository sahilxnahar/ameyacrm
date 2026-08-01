import { NextResponse, type NextRequest } from 'next/server';
import { requireHeaderSecret } from '@/lib/security/require-secret';
import { fetchWithTimeout } from '@/lib/utils/fetch-timeout';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { analyzeCallRecording } from '@/lib/ai/gemini';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Provider-agnostic call webhook (Exotel / Knowlarity / Twilio). Matches the caller number to a
 *  lead and logs a CALL activity with the recording URL. Auth: `x-telephony-key` header or `?key=`.
 *  Accepts JSON or form-encoded bodies (providers vary). */
export async function POST(req: NextRequest) {
  const denied = requireHeaderSecret(req, 'x-telephony-key', env.TELEPHONY_SECRET);
  if (denied) return denied;

  let b: Record<string, unknown> = {};
  try {
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) b = (await req.json()) as Record<string, unknown>;
    else { const form = await req.formData(); b = Object.fromEntries(form.entries()) as Record<string, unknown>; }
  } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }); }

  const last10 = (v: unknown) => String(v ?? '').replace(/\D/g, '').slice(-10);
  const from = last10(b.from ?? b.From ?? b.caller ?? b.CallFrom);
  const to = last10(b.to ?? b.To ?? b.called ?? b.CallTo);
  const direction = String(b.direction ?? b.Direction ?? 'inbound').toLowerCase();
  const customerNo = direction.includes('out') ? to : from;
  if (!customerNo) return NextResponse.json({ error: 'no phone in payload' }, { status: 400 });

  let lead = await prisma.lead.findFirst({ where: { deletedAt: null, phone: { contains: customerNo } }, orderBy: { updatedAt: 'desc' }, select: { id: true } });
  let createdLead = false;

  if (!lead) {
    // An INBOUND call from a number we do not know is a first touch — somebody
    // ringing the number on a hoarding or an ad. Acknowledging and discarding
    // it, as this used to, threw away the enquiry entirely: no record of the
    // number, no callback, nothing. Capture it as a lead so it enters the
    // pipeline like any other enquiry.
    if (direction.includes('out')) {
      return NextResponse.json({ ok: true, matched: false });
    }
    try {
      const { nextReference } = await import('@/lib/utils/reference');
      const fresh = await prisma.lead.create({
        data: {
          reference: await nextReference('LEAD'),
          name: `Caller ${customerNo}`,
          phone: customerNo,
          source: 'OTHER',
          requirement: 'Called in — nobody has spoken to them yet.',
          nextFollowUp: new Date(),
        },
        select: { id: true, name: true, status: true, score: true },
      });
      lead = { id: fresh.id };
      createdLead = true;

      const { runAutomations } = await import('@/lib/automation/engine');
      await runAutomations('LEAD_CREATED', {
        entityType: 'Lead', entityId: fresh.id,
        data: { name: fresh.name, email: null, phone: customerNo, source: 'OTHER', status: fresh.status, score: fresh.score },
      }).catch(() => undefined);

      const managers = await prisma.user.findMany({
        where: { status: 'ACTIVE', deletedAt: null, role: { in: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'MANAGER'] } },
        select: { id: true }, take: 10,
      }).catch(() => []);
      const { notifyMany } = await import('@/lib/notifications/notify');
      await notifyMany(managers.map((m) => m.id), {
        type: 'SYSTEM',
        title: `Missed enquiry — incoming call from ${customerNo}`,
        body: 'A number we did not recognise called in. A lead has been created so somebody can ring them back.',
        link: `/sales/${fresh.id}`,
      }).catch(() => undefined);
    } catch {
      // Even if lead creation fails, do not tell the provider everything is
      // fine and lose the call — report it so it is retried.
      return NextResponse.json({ error: 'could not record the call' }, { status: 500 });
    }
  }

  const recordingUrl = (b.recordingUrl ?? b.RecordingUrl ?? b.recording_url ?? null) as string | null;
  const duration = b.duration ?? b.Duration ?? b.CallDuration ?? null;
  const status = String(b.status ?? b.Status ?? b.DialCallStatus ?? 'completed');
  const notes = [`${direction} call`, duration ? `${duration}s` : null, `status ${status}`, recordingUrl ? `Recording: ${recordingUrl}` : null].filter(Boolean).join(' · ');

  await prisma.leadActivity.create({ data: { leadId: lead.id, type: 'CALL', subject: direction.includes('out') ? 'Outbound call' : `Inbound call${createdLead ? ' (new caller)' : ''}`, notes, outcome: status } });

  // AI call analysis — transcribe the recording and extract budget / typology / timeline / sentiment.
  let analysed = false;
  if (recordingUrl) {
    try {
      const audioRes = await fetchWithTimeout(recordingUrl);
      if (audioRes.ok) {
        const buf = Buffer.from(await audioRes.arrayBuffer());
        const mime = audioRes.headers.get('content-type')?.split(';')[0] || 'audio/mpeg';
        const a = await analyzeCallRecording(buf, mime);
        if (a && !('error' in a)) {
          const detail = [
            a.summary,
            a.budget ? `Budget: ${a.budget}` : null,
            a.typology ? `Typology: ${a.typology}` : null,
            a.timeline ? `Timeline: ${a.timeline}` : null,
            `Sentiment: ${a.sentiment}`,
            `Next: ${a.nextAction}`,
            '',
            '--- Transcript ---',
            a.transcript,
          ].filter((x) => x !== null).join('\n');
          await prisma.leadActivity.create({ data: { leadId: lead.id, type: 'NOTE', subject: `AI call analysis (${a.sentiment})`, notes: detail.slice(0, 6000), outcome: a.sentiment } });
          const patch: Record<string, unknown> = {};
          if (a.typology || a.timeline) {
            const existing = (await prisma.lead.findUnique({ where: { id: lead.id }, select: { requirement: true } }))?.requirement;
            if (!existing) patch.requirement = [a.typology, a.timeline].filter(Boolean).join(' · ').slice(0, 300);
          }
          if (Object.keys(patch).length) await prisma.lead.update({ where: { id: lead.id }, data: patch });
          analysed = true;
        }
      }
    } catch { /* analysis is best-effort */ }
  }
  return NextResponse.json({ ok: true, matched: true, leadId: lead.id, analysed });
}
