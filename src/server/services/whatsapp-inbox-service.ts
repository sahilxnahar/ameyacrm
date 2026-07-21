import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { decrypt } from '@/lib/utils/crypto';
import { toWaNumber, sendWhatsappText } from '@/server/services/whatsapp-service';
import { resolvePermissions } from '@/lib/rbac/can';
import { getFolderTree } from '@/server/services/folder-access-service';
import { inferMimeType } from '@/lib/files/mime';
import { writeAudit } from '@/lib/audit/log';
import type { AuthContext } from '@/types/auth';

const GRAPH = 'https://graph.facebook.com/v21.0';
const SESSION_MINUTES = 30;

export interface Incoming {
  externalId: string;
  from: string;
  kind: 'text' | 'document' | 'image' | 'other';
  text?: string;
  mediaId?: string;
  filename?: string;
  mimeType?: string;
}

/**
 * Handle one inbound WhatsApp message.
 *
 * The whole flow is: say hello → we list the folders you personally may write
 * to → you pick a number → you forward the file. Nobody types a folder path on
 * a phone, and nobody sees a folder they could not open in the CRM anyway.
 */
export async function handleIncoming(msg: Incoming): Promise<string | null> {
  // WhatsApp retries deliveries; the unique id makes that harmless.
  const seen = await prisma.whatsappMessage.findUnique({ where: { externalId: msg.externalId }, select: { id: true } });
  if (seen) return null;

  const phone = toWaNumber(msg.from) ?? msg.from.replace(/\D/g, '');
  const user = await findUserByPhone(phone);

  await prisma.whatsappMessage.create({
    data: {
      externalId: msg.externalId, phone, userId: user?.id ?? null,
      kind: msg.kind, body: msg.text?.slice(0, 2000) ?? null,
      mediaId: msg.mediaId ?? null, filename: msg.filename ?? null,
    },
  });

  if (!user) {
    return reply(phone, msg.externalId,
      'This number is not registered with the Ameya Heights CRM, so I cannot accept anything from it. ' +
      'Ask an administrator to add your WhatsApp number to your profile.');
  }

  const ctx = await contextFor(user.id);
  if (!ctx) return reply(phone, msg.externalId, 'Your account is not active. Please speak to an administrator.');

  const session = await getSession(phone, user.id);
  const text = (msg.text ?? '').trim();

  // A file, sent while a folder is chosen — the whole point of the thing.
  if (msg.kind === 'document' || msg.kind === 'image') {
    if (!session.folderId) {
      const list = await offerFolders(ctx, phone, user.id);
      return reply(phone, msg.externalId,
        `Thanks — I have your file, but I do not know where to put it.\n\n${list}\n\nReply with a number, then send the file again.`);
    }
    const out = await storeFile(ctx, session.folderId, msg);
    await prisma.whatsappSession.update({
      where: { phone },
      data: { uploads: { increment: out.ok ? 1 : 0 }, lastSeen: new Date(), expiresAt: expiry() },
    });
    return reply(phone, msg.externalId, out.message);
  }

  // A number, answering the folder list.
  const pick = Number(text);
  if (session.state === 'CHOOSING_FOLDER' && Number.isInteger(pick) && pick > 0) {
    const offered = (session.offered as Array<{ n: number; id: string; name: string }> | null) ?? [];
    const chosen = offered.find((o) => o.n === pick);
    if (!chosen) {
      return reply(phone, msg.externalId, `There is no option ${pick}. Send "hi" to see the list again.`);
    }
    await prisma.whatsappSession.update({
      where: { phone },
      data: { state: 'READY_FOR_FILE', folderId: chosen.id, lastSeen: new Date(), expiresAt: expiry() },
    });
    return reply(phone, msg.externalId,
      `Right — anything you send now goes into *${chosen.name}*.\n\nForward the PDF or photo whenever you are ready. Send "change" to pick somewhere else.`);
  }

  if (/^(change|folder|where|menu|start over)$/i.test(text)) {
    const list = await offerFolders(ctx, phone, user.id);
    return reply(phone, msg.externalId, list + '\n\nReply with a number.');
  }

  if (/^(hi|hello|hey|upload|help|start|namaste)/i.test(text) || !text) {
    const list = await offerFolders(ctx, phone, user.id);
    return reply(phone, msg.externalId,
      `Hello ${user.name.split(' ')[0]} — send me a bill, a drawing or a photo and I will file it in the CRM.\n\n${list}\n\nReply with a number to choose where.`);
  }

  const list = await offerFolders(ctx, phone, user.id);
  return reply(phone, msg.externalId,
    `I only handle uploads here.\n\n${list}\n\nReply with a number, then send the file.`);
}

/** Only folders this person may actually write to, numbered for a phone. */
async function offerFolders(ctx: AuthContext, phone: string, userId: string): Promise<string> {
  const tree = await getFolderTree(ctx);
  const open = tree.filter((f) => f.canOpen).slice(0, 9);

  if (!open.length) {
    return 'You do not have access to any folder yet. Ask an administrator to give you one.';
  }
  const offered = open.map((f, i) => ({ n: i + 1, id: f.id, name: f.name }));
  await prisma.whatsappSession.upsert({
    where: { phone },
    update: { userId, state: 'CHOOSING_FOLDER', offered: offered as object, lastSeen: new Date(), expiresAt: expiry() },
    create: { phone, userId, state: 'CHOOSING_FOLDER', offered: offered as object, expiresAt: expiry() },
  });
  return ['Where should it go?', ...offered.map((o) => `${o.n}. ${o.name}`)].join('\n');
}

/** Pull the file off WhatsApp and file it in the CRM. */
async function storeFile(ctx: AuthContext, folderId: string, msg: Incoming): Promise<{ ok: boolean; message: string }> {
  if (!msg.mediaId) return { ok: false, message: 'That came through without a file I could read. Please send it again.' };

  const conn = await prisma.integrationConnection.findUnique({ where: { provider: 'whatsapp' } });
  if (!conn?.accessToken) return { ok: false, message: 'WhatsApp is not connected properly at this end. Tell an administrator.' };
  const token = decrypt(conn.accessToken);

  try {
    // WhatsApp hands over a URL first, then the bytes — both need the token.
    const metaRes = await fetch(`${GRAPH}/${msg.mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!metaRes.ok) return { ok: false, message: 'I could not fetch that file from WhatsApp. Please send it again.' };
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string; file_size?: number };
    if (!meta.url) return { ok: false, message: 'WhatsApp did not give me a link to the file.' };
    if ((meta.file_size ?? 0) > 25 * 1024 * 1024) {
      return { ok: false, message: 'That file is over 25 MB. Please upload it from the CRM on a computer instead.' };
    }

    const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!fileRes.ok) return { ok: false, message: 'The download from WhatsApp failed. Please try once more.' };
    const buffer = Buffer.from(await fileRes.arrayBuffer());

    const filename = msg.filename || `whatsapp-${new Date().toISOString().slice(0, 10)}.${extFor(meta.mime_type ?? msg.mimeType ?? '')}`;
    const mimeType = inferMimeType(meta.mime_type ?? msg.mimeType ?? '', filename);

    const { putObject } = await import('@/lib/storage/storage');
    const key = `whatsapp/${ctx.user.id}/${Date.now()}-${filename.replace(/[^\w.\-]/g, '_')}`;
    const stored = await putObject(key, buffer, mimeType);

    const fileObj = await prisma.fileObject.create({
      data: {
        key: stored.key, bucket: stored.bucket, originalName: filename,
        mimeType, size: stored.size, uploadedById: ctx.user.id,
      },
    });
    await prisma.document.create({
      data: {
        title: filename.slice(0, 200), folderId, ownerId: ctx.user.id, currentVersion: 1,
        versions: { create: { version: 1, fileId: fileObj.id, createdById: ctx.user.id } },
      },
    });

    const folder = await prisma.folder.findUnique({ where: { id: folderId }, select: { name: true } });
    await writeAudit({
      actorId: ctx.user.id, action: 'CREATE', entityType: 'Document',
      summary: `Uploaded "${filename}" via WhatsApp into ${folder?.name ?? 'a folder'}`,
    });

    // Summarising and mirroring happen after the reply, so the person is not
    // left staring at a delivered tick while a model thinks.
    void import('@/server/services/file-sync-service')
      .then((m) => m.processFile(fileObj.id))
      .catch(() => undefined);

    return { ok: true, message: `Done — *${filename}* is filed under *${folder?.name ?? 'your folder'}*.\n\nSend another, or "change" to file somewhere else.` };
  } catch (e) {
    return { ok: false, message: `Something went wrong saving that: ${e instanceof Error ? e.message : 'unknown error'}` };
  }
}

async function findUserByPhone(phone: string): Promise<{ id: string; name: string } | null> {
  const last10 = phone.slice(-10);
  const users = await prisma.user.findMany({
    where: { deletedAt: null, status: 'ACTIVE', OR: [{ whatsappNumber: { not: null } }, { phone: { not: null } }] },
    select: { id: true, name: true, phone: true, whatsappNumber: true },
    take: 500,
  });
  // Compare on the last ten digits: the same person is stored as 98450 12345,
  // +91 98450 12345 and 09845012345 in different places.
  return users.find((u) =>
    [u.whatsappNumber, u.phone].some((n) => n && n.replace(/\D/g, '').slice(-10) === last10),
  ) ?? null;
}

async function contextFor(userId: string): Promise<AuthContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, username: true, role: true, status: true, departmentId: true },
  });
  if (!user || user.status !== 'ACTIVE') return null;
  const permissions = await resolvePermissions({ id: user.id, role: user.role });
  return { user, permissions } as unknown as AuthContext;
}

async function getSession(phone: string, userId: string) {
  const now = new Date();
  const existing = await prisma.whatsappSession.findUnique({ where: { phone } });
  if (existing && existing.expiresAt > now) return existing;
  return prisma.whatsappSession.upsert({
    where: { phone },
    update: { userId, state: 'IDLE', folderId: null, offered: undefined, lastSeen: now, expiresAt: expiry() },
    create: { phone, userId, state: 'IDLE', expiresAt: expiry() },
  });
}

const expiry = () => new Date(Date.now() + SESSION_MINUTES * 60000);

function extFor(mime: string): string {
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('sheet') || mime.includes('excel')) return 'xlsx';
  if (mime.includes('word')) return 'docx';
  return 'bin';
}

async function reply(phone: string, externalId: string, message: string): Promise<string> {
  await sendWhatsappText(phone, message).catch(() => undefined);
  await prisma.whatsappMessage.updateMany({
    where: { externalId },
    data: { handled: true, outcome: message.slice(0, 300) },
  });
  return message;
}
