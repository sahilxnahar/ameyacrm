import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';

/**
 * Every department a person belongs to — their main one plus any extras.
 *
 * Always go through this rather than reading `user.departmentId` directly when
 * deciding what somebody may see, otherwise a person added to a second
 * department gets the badge but not the access, which is the sort of bug people
 * work around silently instead of reporting.
 */
export const departmentIdsFor = cache(async (userId: string): Promise<string[]> => {
  const [user, extras] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } }),
    prisma.departmentMember.findMany({ where: { userId }, select: { departmentId: true } }),
  ]);
  const ids = new Set<string>();
  if (user?.departmentId) ids.add(user.departmentId);
  for (const e of extras) ids.add(e.departmentId);
  return [...ids];
});

export const departmentsFor = cache(async (userId: string) => {
  const ids = await departmentIdsFor(userId);
  if (!ids.length) return [];
  const primary = (await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } }))?.departmentId ?? null;
  const rows = await prisma.department.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, color: true },
    orderBy: { name: 'asc' },
  });
  return rows.map((d) => ({ ...d, isPrimary: d.id === primary }));
});

/** Replace somebody's extra departments. The main one is set separately. */
export async function setExtraDepartments(userId: string, departmentIds: string[]): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
  // The main department is already implied; storing it twice would show it
  // twice on screen and let it survive a change of main department.
  const wanted = [...new Set(departmentIds)].filter((id) => id && id !== user?.departmentId);

  await prisma.$transaction([
    prisma.departmentMember.deleteMany({ where: { userId, departmentId: { notIn: wanted.length ? wanted : ['—none—'] } } }),
    ...wanted.map((departmentId) =>
      prisma.departmentMember.upsert({
        where: { userId_departmentId: { userId, departmentId } },
        create: { userId, departmentId },
        update: {},
      }),
    ),
  ]);
}
