import 'server-only';
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server';
import { prisma } from '@/lib/db/prisma';
import { relyingParty, stashChallenge, takeChallenge } from '@/lib/auth/webauthn';

const b64 = {
  from: (s: string) => new Uint8Array(Buffer.from(s, 'base64url')),
  to: (b: Uint8Array) => Buffer.from(b).toString('base64url'),
};

export async function passkeyRegistrationOptions(userId: string) {
  const { rpID } = await relyingParty();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  const existing = await prisma.webAuthnCredential.findMany({
    where: { userId }, select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpName: 'Ameya Heights',
    rpID,
    userID: b64.from(Buffer.from(user.id).toString('base64url')),
    userName: user.email,
    userDisplayName: user.name ?? user.email,
    attestationType: 'none',
    // Stops the same key being enrolled twice, which would leave the person
    // with two entries they cannot tell apart.
    excludeCredentials: existing.map((c) => ({ id: c.credentialId })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });
  await stashChallenge(options.challenge, 'register');
  return options;
}

export async function verifyPasskeyRegistration(
  userId: string, response: RegistrationResponseJSON, label: string,
): Promise<{ ok: true } | { error: string }> {
  const challenge = await takeChallenge('register');
  if (!challenge) return { error: 'That took too long. Start again.' };
  const { rpID, origin } = await relyingParty();

  let v;
  try {
    v = await verifyRegistrationResponse({
      response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'That passkey could not be verified.' };
  }
  if (!v.verified || !v.registrationInfo) return { error: 'That passkey could not be verified.' };

  const { credential } = v.registrationInfo;
  await prisma.webAuthnCredential.create({
    data: {
      userId,
      credentialId: credential.id,
      publicKey: b64.to(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports?.join(',') ?? null,
      label: label.trim().slice(0, 60) || 'Passkey',
    },
  });
  return { ok: true };
}

/**
 * Options for signing in.
 *
 * No username is required: the browser offers whichever passkey it holds for
 * this site, so the person taps once and is in.
 */
export async function passkeyLoginOptions() {
  const { rpID } = await relyingParty();
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred' });
  await stashChallenge(options.challenge, 'login');
  return options;
}

export async function verifyPasskeyLogin(
  response: AuthenticationResponseJSON,
): Promise<{ userId: string } | { error: string }> {
  const challenge = await takeChallenge('login');
  if (!challenge) return { error: 'That took too long. Try again.' };
  const { rpID, origin } = await relyingParty();

  const cred = await prisma.webAuthnCredential.findUnique({
    where: { credentialId: response.id },
    select: { id: true, userId: true, publicKey: true, counter: true, transports: true },
  });
  if (!cred) return { error: 'That passkey is not registered here.' };

  let v;
  try {
    v = await verifyAuthenticationResponse({
      response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: response.id,
        publicKey: b64.from(cred.publicKey),
        counter: cred.counter,
        transports: cred.transports ? (cred.transports.split(',') as never) : undefined,
      },
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'That passkey could not be verified.' };
  }
  if (!v.verified) return { error: 'That passkey could not be verified.' };

  // A counter that goes backwards means the key has been cloned. Most modern
  // passkeys report 0 always, so only a genuine decrease is worth acting on.
  await prisma.webAuthnCredential.update({
    where: { id: cred.id }, data: { counter: v.authenticationInfo.newCounter },
  });
  return { userId: cred.userId };
}

export async function listPasskeys(userId: string) {
  return prisma.webAuthnCredential.findMany({
    where: { userId },
    select: { id: true, label: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function removePasskey(userId: string, id: string): Promise<boolean> {
  const r = await prisma.webAuthnCredential.deleteMany({ where: { id, userId } });
  return r.count > 0;
}
