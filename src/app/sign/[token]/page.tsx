import type { Metadata } from 'next';
import { prisma } from '@/lib/db/prisma';
import { SignDocument } from '@/components/signatures/sign-document';

export const metadata: Metadata = { title: 'Sign document' };
export const dynamic = 'force-dynamic';

const SHELL = 'min-h-screen w-full';
const BG = 'linear-gradient(125deg, #04123A 0%, #0A2A6B 18%, #12409E 36%, #1E5FD6 52%, #6D9BEA 68%, #B9CFEF 82%, #F7F3EA 100%)';

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sr = await prisma.signatureRequest.findUnique({ where: { token } });

  const frame = (children: React.ReactNode) => (
    <div className={SHELL} style={{ background: BG }}>
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center p-4">
        <div className="w-full rounded-xl bg-[#FBF9F4] p-6 shadow-2xl">{children}</div>
      </div>
    </div>
  );

  if (!sr) return frame(<p className="text-center text-[#14120E]">This signing link is not valid. Please ask for a fresh one.</p>);
  if (sr.status === 'SIGNED') {
    return frame(
      <div className="space-y-2 text-center text-[#14120E]">
        <h1 className="font-display text-2xl font-semibold">Already signed</h1>
        <p className="text-sm">&ldquo;{sr.title}&rdquo; was signed on {sr.signedAt?.toLocaleString('en-IN')}. Nothing further is needed.</p>
      </div>,
    );
  }
  if (sr.status === 'DECLINED') return frame(<p className="text-center text-[#14120E]">This request was declined. Contact Ameya Heights if that was a mistake.</p>);
  if (sr.expiresAt && sr.expiresAt < new Date()) return frame(<p className="text-center text-[#14120E]">This signing link has expired. Please ask for a fresh one.</p>);

  if (!sr.viewedAt) await prisma.signatureRequest.update({ where: { id: sr.id }, data: { viewedAt: new Date(), status: 'VIEWED' } });

  return frame(
    <SignDocument
      token={token}
      title={sr.title}
      reference={sr.reference}
      fileUrl={sr.fileUrl}
      signerName={sr.signerName}
      requestedBy={sr.requestedByName}
      message={sr.message}
      expiresAt={sr.expiresAt?.toISOString() ?? null}
    />,
  );
}
