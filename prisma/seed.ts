/**
 * Seed — idempotent. Run with `npm run db:seed`.
 * Populates permissions, role mappings, departments, the Ameya Heights project,
 * baseline users, and representative sample data for each module.
 *
 * NOTE: imports the pure RBAC data files only (no `server-only` modules), and
 * hashes passwords directly with bcrypt so it runs cleanly under tsx.
 */
import { PrismaClient, type RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PERMISSIONS, ALL_PERMISSION_KEYS, moduleOf } from '../src/lib/rbac/permissions';
import { ROLE_DEFAULTS, expandRolePermissions } from '../src/lib/rbac/roles';

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = 'Ameya@Heights2026';

const DEPARTMENTS = [
  'Architecture', 'Billing', 'Management', 'Marketing', 'Sales', 'NRI', 'Lease',
  'Administration', 'Site Operations', 'Legal', 'Accounts', 'Human Resources',
  'Document Control',
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function main() {
  console.log('▶ Seeding Ameya Heights CRM …');
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  // 1) Permissions
  for (const key of ALL_PERMISSION_KEYS) {
    await prisma.permission.upsert({
      where: { key },
      update: { description: PERMISSIONS[key], module: moduleOf(key) },
      create: { key, description: PERMISSIONS[key], module: moduleOf(key) },
    });
  }
  const permByKey = new Map((await prisma.permission.findMany()).map((p) => [p.key, p.id]));
  console.log(`  ✓ ${permByKey.size} permissions`);

  // 2) Role → permission mappings
  for (const role of Object.keys(ROLE_DEFAULTS) as RoleName[]) {
    const keys = role === 'SUPER_ADMIN' ? [] : expandRolePermissions(ROLE_DEFAULTS[role]);
    for (const key of keys) {
      const pid = permByKey.get(key);
      if (!pid) continue;
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId: pid } },
        update: { effect: 'ALLOW' },
        create: { role, permissionId: pid, effect: 'ALLOW' },
      });
    }
  }
  console.log('  ✓ role permissions mapped');

  // 3) Departments
  const deptByName = new Map<string, string>();
  for (const name of DEPARTMENTS) {
    const d = await prisma.department.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name) },
    });
    deptByName.set(name, d.id);
  }
  console.log(`  ✓ ${deptByName.size} departments`);

  // 4) Project + inventory
  const project = await prisma.project.upsert({
    where: { code: 'AH-01' },
    update: {},
    create: {
      name: 'Ameya Heights',
      code: 'AH-01',
      description: 'Premium residential development — flagship project.',
      city: 'Bangalore',
      reraNumber: null, // RERA in progress per brand kit
      startedAt: new Date('2025-01-15'),
    },
  });
  for (let f = 3; f <= 8; f++) {
    const code = `A-${f}01`;
    await prisma.unit.upsert({
      where: { projectId_code: { projectId: project.id, code } },
      update: {},
      create: {
        projectId: project.id, code, tower: 'A', floor: f, typology: f % 2 ? '3BHK' : '2BHK',
        carpetAreaSqft: f % 2 ? 1650 : 1240, price: f % 2 ? 21500000 : 15900000,
      },
    });
  }
  console.log('  ✓ project + sample units');

  // 5) Users
  type NewUser = { name: string; username: string; email: string; role: RoleName; dept: string; designation: string };
  const users: NewUser[] = [
    { name: 'Sahil Nahar', username: 'superadmin', email: 'admin@ameyaheights.com', role: 'SUPER_ADMIN', dept: 'Management', designation: 'Founder' },
    { name: 'IT Administrator', username: 'itadmin', email: 'it@ameyaheights.com', role: 'ADMIN', dept: 'Administration', designation: 'System Administrator' },
    { name: 'Priya Sales Head', username: 'priya.sales', email: 'priya@ameyaheights.com', role: 'DEPARTMENT_HEAD', dept: 'Sales', designation: 'Head of Sales' },
    { name: 'Rahul Manager', username: 'rahul.mgr', email: 'rahul@ameyaheights.com', role: 'MANAGER', dept: 'Sales', designation: 'Sales Manager' },
    { name: 'Anita Architect', username: 'anita.arch', email: 'anita@ameyaheights.com', role: 'DEPARTMENT_HEAD', dept: 'Architecture', designation: 'Principal Architect' },
    { name: 'Vikram Site', username: 'vikram.site', email: 'vikram@ameyaheights.com', role: 'EXECUTIVE', dept: 'Site Operations', designation: 'Site Engineer' },
    { name: 'Meena Accounts', username: 'meena.acc', email: 'meena@ameyaheights.com', role: 'MANAGER', dept: 'Billing', designation: 'Billing Manager' },
    { name: 'Sara NRI Desk', username: 'sara.nri', email: 'sara@ameyaheights.com', role: 'EXECUTIVE', dept: 'NRI', designation: 'NRI Relationship Manager' },
  ];
  const userByUsername = new Map<string, string>();
  for (const u of users) {
    const created = await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        name: u.name, username: u.username, email: u.email, role: u.role,
        designation: u.designation, passwordHash, status: 'ACTIVE',
        departmentId: deptByName.get(u.dept), joiningDate: new Date('2025-02-01'),
        employeeId: 'AH-' + (100 + userByUsername.size + 1),
      },
    });
    userByUsername.set(u.username, created.id);
  }
  // Department heads
  await prisma.department.update({ where: { id: deptByName.get('Sales')! }, data: { headId: userByUsername.get('priya.sales') } });
  await prisma.department.update({ where: { id: deptByName.get('Architecture')! }, data: { headId: userByUsername.get('anita.arch') } });
  console.log(`  ✓ ${userByUsername.size} users (default password: ${DEFAULT_PASSWORD})`);

  // 6) Task labels
  const labels = [
    { name: 'Urgent', color: '#9B111E' }, { name: 'Client', color: '#A07D34' },
    { name: 'Site', color: '#2E7D32' }, { name: 'Design', color: '#1B2A4A' },
    { name: 'Internal', color: '#8C6E2C' },
  ];
  for (const l of labels) await prisma.taskLabel.upsert({ where: { name: l.name }, update: {}, create: l });

  // 7) Sample tasks
  const existingTasks = await prisma.task.count();
  if (existingTasks === 0) {
    const t1 = await prisma.task.create({
      data: {
        reference: 'TSK-1001', title: 'Finalize Tower A elevation drawings',
        description: 'Incorporate consultant feedback and issue Rev-C for approval.',
        status: 'IN_PROGRESS', priority: 'HIGH', projectId: project.id,
        departmentId: deptByName.get('Architecture'), createdById: userByUsername.get('anita.arch')!,
        dueDate: new Date(Date.now() + 3 * 864e5),
        assignees: { create: [{ userId: userByUsername.get('vikram.site')!, state: 'ACCEPTED', progressPct: 40 }] },
        checklistItems: { create: [
          { text: 'Update north elevation', isDone: true, position: 0 },
          { text: 'Consultant sign-off', isMilestone: true, position: 1 },
        ]},
        activities: { create: { actorId: userByUsername.get('anita.arch')!, action: 'created' } },
      },
    });
    await prisma.task.create({
      data: {
        reference: 'TSK-1002', title: 'Prepare Q3 sales pipeline review deck',
        status: 'TODO', priority: 'MEDIUM', projectId: project.id,
        departmentId: deptByName.get('Sales'), createdById: userByUsername.get('priya.sales')!,
        dueDate: new Date(Date.now() + 7 * 864e5),
        assignees: { create: [{ userId: userByUsername.get('rahul.mgr')!, state: 'ASSIGNED' }] },
      },
    });
    console.log('  ✓ sample tasks', t1.reference);
  }

  // 8) Sample leads (incl. NRI)
  if ((await prisma.lead.count()) === 0) {
    await prisma.lead.createMany({
      data: [
        { reference: 'LEAD-2001', name: 'Ravi Kumar', email: 'ravi@example.com', phone: '+91 98800 11223', source: 'WEBSITE', status: 'QUALIFIED', projectId: project.id, ownerId: userByUsername.get('rahul.mgr'), budgetMin: 15000000, budgetMax: 20000000, requirement: '3BHK, high floor' },
        { reference: 'LEAD-2002', name: 'Deepa Menon', email: 'deepa@example.ae', phone: '+971 50 123 4567', source: 'NRI_DESK', status: 'CONTACTED', projectId: project.id, ownerId: userByUsername.get('sara.nri'), isNri: true, country: 'UAE', timezone: 'Asia/Dubai', requirement: 'Investment, 2BHK' },
      ],
    });
    console.log('  ✓ sample leads');
  }

  // 9) Email template + document folder + settings
  await prisma.emailTemplate.upsert({
    where: { key: 'material_request' },
    update: {},
    create: {
      key: 'material_request', name: 'Material Request',
      subject: '[{{priority}}] Material Request {{reference}} — {{project}}',
      body: 'Dear {{recipient}},\n\nPlease arrange the following materials for {{project}} ({{department}}), required by {{neededBy}}:\n\n{{items}}\n\nRaised by: {{requester}}\nNotes: {{notes}}\n\nRegards,\nAmeya Heights CRM',
    },
  });
  await prisma.folder.upsert({
    where: { id: 'root-ah' },
    update: {},
    create: { id: 'root-ah', name: 'Ameya Heights', projectId: project.id, visibility: 'ORGANIZATION', path: '/', createdById: userByUsername.get('superadmin') },
  });
  const settings: Array<[string, unknown]> = [
    ['branding.displayName', 'Ameya Heights'],
    ['branding.tagline', 'Building Spaces. Shaping Legacies.'],
    ['security.passwordExpiryDays', 90],
    ['security.maxFailedLogins', 5],
  ];
  for (const [key, value] of settings) {
    await prisma.setting.upsert({ where: { key }, update: { value: value as object }, create: { key, value: value as object } });
  }

  // 10) v1.1 modules — Marketing / Lease / Architecture sample data
  if ((await prisma.campaign.count()) === 0) {
    await prisma.campaign.create({ data: { name: 'Tower A Launch — Meta', channel: 'META', status: 'ACTIVE', objective: 'Drive qualified site visits', budget: 500000, spend: 180000, impressions: 240000, clicks: 5400, leadsCount: 62, ownerId: userByUsername.get('rahul.mgr'), projectId: project.id, startDate: new Date('2026-06-01') } });
    await prisma.socialPost.create({ data: { title: 'Skyline reveal reel', channel: 'META', status: 'SCHEDULED', scheduledAt: new Date(Date.now() + 2 * 864e5), createdById: userByUsername.get('rahul.mgr') } });
  }
  if ((await prisma.tenant.count()) === 0) {
    const tenant = await prisma.tenant.create({ data: { name: 'Nimbus Retail Pvt Ltd', email: 'ops@nimbus.example', phone: '+91 80 4000 1234', company: 'Nimbus Retail' } });
    await prisma.lease.create({ data: {
      reference: 'LSE-5001', tenantId: tenant.id, projectId: project.id, managerId: userByUsername.get('itadmin'),
      startDate: new Date('2026-04-01'), endDate: new Date('2028-03-31'), rentAmount: 185000, deposit: 1110000,
      escalationPct: 5, noticePeriodDays: 90, status: 'ACTIVE',
      rentSchedule: { create: Array.from({ length: 6 }).map((_, i) => ({ label: `Rent ${i + 1}`, dueDate: new Date(2026, 3 + i, 1), amount: 185000, status: 'PENDING' as const })) },
    } });
    await prisma.maintenanceRequest.create({ data: { reference: 'MNT-6001', title: 'HVAC servicing — retail block', priority: 'HIGH', status: 'OPEN', reportedById: userByUsername.get('vikram.site') } });
  }
  if ((await prisma.drawing.count()) === 0) {
    const consultant = await prisma.consultant.create({ data: { name: 'S. Rao', firm: 'RaoStruct Consultants', discipline: 'Structural', email: 'rao@example.com' } });
    await prisma.drawing.create({ data: {
      number: 'AR-101', title: 'Tower A — Typical Floor Plan', discipline: 'Architecture', status: 'FOR_REVIEW', currentRevision: 2,
      projectId: project.id, createdById: userByUsername.get('anita.arch'),
      revisions: { create: [
        { revision: 1, notes: 'Initial revision', createdById: userByUsername.get('anita.arch') },
        { revision: 2, notes: 'Consultant comments incorporated', createdById: userByUsername.get('anita.arch') },
      ] },
    } });
    await prisma.rFI.create({ data: { number: 'RFI-7001', subject: 'Beam depth at grid B3', question: 'Confirm beam depth given revised loading.', status: 'OPEN', projectId: project.id, raisedById: userByUsername.get('vikram.site'), consultantId: consultant.id, dueDate: new Date(Date.now() + 5 * 864e5) } });
    await prisma.issueLog.create({ data: { title: 'Waterproofing detail missing at podium', severity: 'HIGH', status: 'OPEN', projectId: project.id, raisedById: userByUsername.get('vikram.site'), assignedToId: userByUsername.get('anita.arch') } });
  }
  console.log('  ✓ v1.1 sample data (marketing, lease, architecture)');

  console.log('✅ Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
