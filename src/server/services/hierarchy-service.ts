import 'server-only';
import { prisma } from '@/lib/db/prisma';

export interface OrgPerson {
  id: string;
  name: string;
  email: string;
  role: string;
  designation: string | null;
  status: string;
  managerId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  isDeptHead: boolean;
  reportCount: number;
  extraDepartmentIds: string[];
}

export interface OrgDivision {
  id: string;
  name: string;
  color: string | null;
  headId: string | null;
  parentId: string | null;
  memberIds: string[];
}

/**
 * Everything the org chart needs, in one pass. Deliberately returns flat lists
 * plus ids — the tree is assembled on the client so it can be re-rooted and
 * re-grouped without another round trip.
 */
export async function getOrgChart(): Promise<{
  people: OrgPerson[];
  departments: OrgDivision[];
  gaps: { noManager: number; noDepartment: number; deptNoHead: number };
}> {
  const [users, depts] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null, status: { in: ['ACTIVE', 'INVITED', 'PENDING'] } },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true, name: true, email: true, role: true, designation: true, status: true,
        managerId: true, departmentId: true,
        department: { select: { name: true } },
        extraDepartments: { select: { departmentId: true } },
      },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true, headId: true, parentId: true },
    }),
  ]);

  const reportCounts = new Map<string, number>();
  users.forEach((u) => {
    if (u.managerId) reportCounts.set(u.managerId, (reportCounts.get(u.managerId) ?? 0) + 1);
  });
  const heads = new Set(depts.map((d) => d.headId).filter(Boolean) as string[]);

  const people: OrgPerson[] = users.map((u) => ({
    id: u.id, name: u.name, email: u.email, role: u.role,
    designation: u.designation, status: u.status,
    managerId: u.managerId ?? null,
    departmentId: u.departmentId ?? null,
    departmentName: u.department?.name ?? null,
    isDeptHead: heads.has(u.id),
    reportCount: reportCounts.get(u.id) ?? 0,
    extraDepartmentIds: u.extraDepartments.map((e) => e.departmentId),
  }));

  const departments: OrgDivision[] = depts.map((d) => ({
    id: d.id, name: d.name, color: d.color, headId: d.headId, parentId: d.parentId,
    // Anyone whose main department this is, or who has been added to it.
    memberIds: people
      .filter((p) => p.departmentId === d.id || p.extraDepartmentIds.includes(d.id))
      .map((p) => p.id),
  }));

  return {
    people,
    departments,
    gaps: {
      noManager: people.filter((p) => !p.managerId).length,
      noDepartment: people.filter((p) => !p.departmentId).length,
      deptNoHead: departments.filter((d) => !d.headId).length,
    },
  };
}
