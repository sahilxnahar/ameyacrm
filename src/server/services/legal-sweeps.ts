import 'server-only';
import { prisma } from '@/lib/db/prisma';

/**
 * Read-only deadline sweeps for the dispute/compliance modules (83, 86, 90).
 * These don't mutate — they surface counts for the daily-cron result log and
 * keep the "what's due" numbers honest. The screens themselves sort by the due
 * date, so nothing is hidden; this is the heartbeat that proves the watch runs.
 */
export interface LegalDeadlines { hearings: number; femaDue: number }

export async function sweepLegalDeadlines(now = new Date(), hearingDays = 3, femaDays = 30): Promise<LegalDeadlines> {
  const soon = (d: number) => new Date(now.getTime() + d * 864e5);
  let hearings = 0, femaDue = 0;
  try {
    const [adr, lit] = await Promise.all([
      prisma.adrCase.count({ where: { nextHearingOn: { not: null, lte: soon(hearingDays) }, stage: { notIn: ['SETTLED', 'CLOSED'] } } }),
      prisma.litigationEscalation.count({ where: { nextHearingOn: { not: null, lte: soon(hearingDays) }, status: { not: 'DISPOSED' } } }),
    ]);
    hearings = adr + lit;
  } catch { hearings = 0; }
  try {
    femaDue = await prisma.foreignRemittance.count({ where: { reportedOn: null, reportDueOn: { not: null, lte: soon(femaDays) } } });
  } catch { femaDue = 0; }
  return { hearings, femaDue };
}
