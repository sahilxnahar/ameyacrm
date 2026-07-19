import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { readMfaTicket } from '@/lib/auth/mfa-ticket';
import { TwoFactorForm } from '@/components/auth/two-factor-form';

export const metadata: Metadata = { title: 'Two-factor verification' };

export default async function TwoFactorPage() {
  if (!(await readMfaTicket())) redirect('/login');
  return <TwoFactorForm />;
}
