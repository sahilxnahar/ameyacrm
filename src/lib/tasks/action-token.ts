import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/config/env';

/**
 * A signed link that lets someone act on a task straight from an email — no
 * sign-in. It carries only the task id, the person it was sent to, and the one
 * action it permits, all signed with the app secret so it cannot be forged or
 * pointed at a different task. Long-lived (30 days) because a task email may sit
 * in an inbox for a while, and marking a task done is safely idempotent.
 */
const secret = new TextEncoder().encode(env.SESSION_SECRET);

export type TaskAction = 'done';

export async function signTaskActionToken(input: { taskId: string; uid: string; act: TaskAction }): Promise<string> {
  return new SignJWT({ t: input.taskId, u: input.uid, a: input.act })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}

export async function verifyTaskActionToken(token: string): Promise<{ taskId: string; uid: string; act: TaskAction } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.t !== 'string' || typeof payload.u !== 'string' || payload.a !== 'done') return null;
    return { taskId: payload.t, uid: payload.u, act: 'done' };
  } catch {
    return null;
  }
}
