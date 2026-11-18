import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';

const target = new URL(process.env.VETRA_TEST_URL || 'http://127.0.0.1:3100');
const database = new URL(process.env.DATABASE_URL || 'postgresql://127.0.0.1');
assert.equal(target.hostname, '127.0.0.1', 'Serveur de test local requis');
assert.equal(database.hostname, '127.0.0.1', 'PostgreSQL de test local requis');
assert.equal(
  database.pathname,
  '/vetra_test',
  'Base jetable vetra_test requise',
);
const db = new PrismaClient();
const password = 'VetraTest-local-2026';
const tag = Date.now().toString();
const identities = {};
const users = [];

async function provision(region, division, role, name, serviceId) {
  const email = `${name}-${tag}@example.invalid`;
  const user = await db.user.create({
    data: {
      email,
      name,
      firstName: 'Test',
      role,
      serviceId,
      divisionId: division.id,
      regionId: region.id,
      passwordHash: await bcrypt.hash(password, 4),
    },
  });
  users.push(user.id);
  identities[name] = { email, password };
}

async function call(identity, route, body, status = 200) {
  const response = await fetch(new URL('/api/' + route, target), {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      cookie: identity?.cookie || '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status !== status)
    throw Error(
      `${route} : ${response.status} au lieu de ${status} – ${await response.text()}`,
    );
  return response;
}

let region, division, service, otherRegion, otherDivision, otherService;
try {
  region = await db.region.create({ data: { name: 'Région test ' + tag } });
  division = await db.division.create({
    data: { name: 'Division test', regionId: region.id },
  });
  service = await db.service.create({
    data: {
      name: 'Service provincial test',
      kind: 'PROVINCIAL',
      divisionId: division.id,
    },
  });
  otherRegion = await db.region.create({
    data: { name: 'Autre région test ' + tag },
  });
  otherDivision = await db.division.create({
    data: { name: 'Autre division test', regionId: otherRegion.id },
  });
  otherService = await db.service.create({
    data: {
      name: 'Poste frontalier test',
      kind: 'FRONTALIER',
      divisionId: otherDivision.id,
    },
  });
  for (const [role, name] of [
    ['CHEF_SERVICE', 'provincial'],
    ['CHEF_DIVISION', 'division'],
    ['DIRECTEUR_REGIONAL', 'regional'],
    ['DIRECTION_CENTRALE', 'central'],
    ['ADMIN_NATIONAL', 'admin'],
  ]) {
    await provision(
      region,
      division,
      role,
      name,
      role === 'CHEF_SERVICE' ? service.id : undefined,
    );
  }
  await provision(
    otherRegion,
    otherDivision,
    'CHEF_SERVICE',
    'frontalier',
    otherService.id,
  );
  await call(null, 'me', undefined, 401);
  for (const identity of Object.values(identities)) {
    const response = await call(null, 'login', identity);
    identity.cookie = response.headers.get('set-cookie')?.split(';')[0];
    assert.ok(identity.cookie);
  }
  const {
    provincial,
    frontalier,
    admin,
    division: chef,
    regional,
    central,
  } = identities;
  const rubrics = ['I.A.1', 'I.B.1', 'I.D', 'II.A', 'II.C', 'VI.B'];
  await call(
    provincial,
    'admin',
    { action: 'rights', serviceId: service.id, enabled: rubrics },
    403,
  );
  await call(admin, 'admin', {
    action: 'rights',
    serviceId: service.id,
    enabled: rubrics,
  });
  await call(admin, 'admin', {
    action: 'rights',
    serviceId: otherService.id,
    enabled: ['IV', 'V'],
  });
  const period = { year: 2026, month: 11, serviceId: service.id };
  await call(frontalier, 'report', { ...period, data: {} }, 403);
  await call(provincial, 'report', { ...period, data: { B17: 3 } }, 403);
  await call(provincial, 'report', { ...period, data: { H9: 3 } }, 403);
  await call(provincial, 'report', { ...period, data: { K297: 101 } }, 400);
  await call(
    provincial,
    'report',
    { ...period, data: { __completed: ['I.D'] } },
    400,
  );
  const details = [
    { rubric: 'I.D', values: [1, 5, 1, 'Casablanca'] },
    {
      rubric: 'II.C',
      values: [
        1,
        'Société témoin',
        1.5,
        '2026-11-02',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'Retrait',
      ],
    },
  ];
  const data = {
    B9: 9,
    C9: 3,
    A68: 2,
    B68: 1,
    G69: 1.7,
    B152: 4,
    K297: 22,
    __tables: details,
  };
  let report = await (
    await call(provincial, 'report', {
      ...period,
      data: { ...data, __completed: ['I.A.1'] },
    })
  ).json();
  const action = (actor, action, status = 200, reason = '') =>
    call(actor, 'workflow', { id: report.id, action, reason }, status);
  await action(provincial, 'soumettre', 409);
  await call(provincial, 'report', { ...period, data }, 409);
  report = await (
    await call(provincial, 'report', {
      ...period,
      version: report.updatedAt,
      data: { ...data, __completed: rubrics },
    })
  ).json();
  await action(provincial, 'soumettre');
  await call(provincial, 'report', { ...period, data }, 409);
  await action(admin, 'valider', 403);
  await action(regional, 'valider', 403);
  await action(central, 'valider', 403);
  await action(chef, 'revoquer', 400);
  report = await (
    await action(chef, 'revoquer', 200, 'Corriger le nombre de sorties')
  ).json();
  report = await (
    await call(provincial, 'report', {
      ...period,
      version: report.updatedAt,
      data: { B68: 2, __completed: rubrics },
    })
  ).json();
  assert.equal(report.status, 'CORRIGE');
  assert.equal(report.data.G69, 1.7);
  report = await (
    await call(provincial, 'report', {
      ...period,
      version: report.updatedAt,
      data: { B68: 3, __completed: rubrics },
    })
  ).json();
  assert.equal(report.status, 'CORRIGE');
  await action(provincial, 'soumettre');
  await action(chef, 'valider');
  await call(
    frontalier,
    'export?id=' + report.id + '&type=xlsx',
    undefined,
    403,
  );
  const results = await (
    await call(central, 'reporting?year=2026&month=11')
  ).json();
  assert.equal(results.count, 1);
  assert.equal(results.totals.H9, 12);
  assert.equal(results.totals.C68, 5);
  assert.equal(results.totals.B153, 4);
  assert.equal(results.totals.K297, undefined);
  const unauthorized = await (
    await call(frontalier, 'reports?year=2026&month=11')
  ).json();
  assert.deepEqual(unauthorized, []);
  const frontierPeriod = { ...period, serviceId: otherService.id };
  await call(
    frontalier,
    'report',
    { ...frontierPeriod, data: { C199: 1.5 } },
    400,
  );
  const frontierReport = await (
    await call(frontalier, 'report', {
      ...frontierPeriod,
      data: { C199: 12, C200: 1.5, __completed: ['IV'] },
    })
  ).json();
  assert.equal(frontierReport.data.C199, 12);
  assert.equal(frontierReport.data.C200, 1.5);
  const frontierTotals = await (
    await call(central, 'reporting?year=2026&month=11')
  ).json();
  assert.equal(frontierTotals.count, 1);
  assert.equal(frontierTotals.totals.C199, undefined);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    await (
      await call(regional, 'export?id=' + report.id + '&type=xlsx')
    ).arrayBuffer(),
  );
  const sheet = workbook.getWorksheet('CASA');
  assert.equal(sheet.getCell('H9').result, 12);
  assert.equal(sheet.getCell('C68').result, 5);
  assert.equal(sheet.getCell('D120').value, 'Casablanca');
  assert.equal(sheet.getCell('N167').value, 'Retrait');
  assert.equal(sheet.getCell('B10').value, null);
  const pdf = await PDFDocument.load(
    await (
      await call(chef, 'export?id=' + report.id + '&type=pdf')
    ).arrayBuffer(),
  );
  assert.ok(pdf.getPageCount());
  const events = await (await call(chef, 'events?id=' + report.id)).json();
  assert.deepEqual(
    events.map((event) => event.newStatus),
    [
      'BROUILLON',
      'BROUILLON',
      'SOUMIS',
      'REVOQUE',
      'CORRIGE',
      'CORRIGE',
      'SOUMIS',
      'VALIDE',
    ],
  );
  await call(admin, 'admin', {
    action: 'userUpdate',
    id: users[0],
    active: false,
  });
  await call(provincial, 'me', undefined, 401);
  await call(admin, 'admin', {
    action: 'userUpdate',
    id: users[0],
    active: true,
  });
  await call(provincial, 'logout', {});
  console.log(
    'VETRA : parcours PostgreSQL, cinq profils, deux services, workflow, droits, audit et exports validés.',
  );
} finally {
  const serviceIds = [service?.id, otherService?.id].filter(Boolean);
  await db.event.deleteMany({ where: { userId: { in: users } } });
  await db.report.deleteMany({ where: { serviceId: { in: serviceIds } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.service.deleteMany({ where: { id: { in: serviceIds } } });
  await db.division.deleteMany({
    where: { id: { in: [division?.id, otherDivision?.id].filter(Boolean) } },
  });
  await db.region.deleteMany({
    where: { id: { in: [region?.id, otherRegion?.id].filter(Boolean) } },
  });
  await db.$disconnect();
}
