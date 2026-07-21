import { NextResponse, type NextRequest } from 'next/server';
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
  const secret = env.TELEPHONY_SECRET;
  const key = req.headers.get('x-telephony-key') || req.nextUrl.searchParams.get('key');
  if (!secret || key !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

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

  const lead = await prisma.lead.findFirst({ where: { deletedAt: null, phone: { contains: customerNo } }, orderBy: { updatedAt: 'desc' }, select: { id: true } });
  if (!lead) return NextResponse.json({ ok: true, matched: false });

  const recordingUrl = (b.recordingUrl ?? b.RecordingUrl ?? b.recording_url ?? null) as string | null;
  const duration = b.duration ?? b.Duration ?? b.CallDuration ?? null;
  const status = String(b.status ?? b.Status ?? b.DialCallStatus ?? 'completed');
  const notes = [`${direction} call`, duration ? `${duration}s` : null, `status ${status}`, recordingUrl ? `Recording: ${recordingUrl}` : null].filter(Boolean).join(' · ');

  await prisma.leadActivity.create({ data: { leadId: lead.id, type: 'CALL', subject: direction.includes('out') ? 'Outbound call' : 'Inbound call', notes, outcome: status } });

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
