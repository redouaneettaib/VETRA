import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
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

const otpMailbox = process.env.VETRA_TEST_OTP_MAILBOX;

async function readVerificationCode(email) {
  const names = (await readdir(otpMailbox))
    .filter((name) => /^\d+\.eml$/.test(name))
    .sort((a, b) => parseInt(b) - parseInt(a));
  for (const name of names) {
    const mail = (await readFile(join(otpMailbox, name), 'utf8')).replace(
      /=\r?\n/g,
      '',
    );
    const destination = /^To: (.+)$/im.exec(mail)?.[1]?.trim();
    const code = /Code [^:]+ : (\d{6})/.exec(mail)?.[1];
    if (destination === email && code) return code;
  }
  throw Error('Aucun OTP capturé pour le compte de test');
}

async function loginWithTestAccount(identity) {
  const response = await call(null, 'login', identity);
  if (!otpMailbox) return response;
  assert.equal((await response.json()).otpRequired, true);
  assert.equal(response.headers.get('set-cookie'), null);
  const code = await readVerificationCode(identity.email);
  const confirmed = await call(null, 'otp/verify', {
    email: identity.email,
    code,
  });
  await call(null, 'otp/verify', { email: identity.email, code }, 401);
  return confirmed;
}

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
    const response = await loginWithTestAccount(identity);
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
  await db.report.createMany({
    data: [
      {
        serviceId: service.id,
        year: 2025,
        month: 11,
        status: 'VALIDE',
        data: { B9: 5 },
      },
      {
        serviceId: otherService.id,
        year: 2026,
        month: 10,
        status: 'VALIDE',
        data: { B9: 19 },
      },
    ],
  });
  const comparisons = `year=2026&month=11&mode=year&trend=years&group=region&id=${region.id}&id=${otherRegion.id}&rubric=I.A.1&metric=H9`;
  const comparison = await (
    await call(central, 'analytics?' + comparisons)
  ).json();
  const selected = comparison.results.find((group) => group.id === region.id);
  assert.equal(selected.current.values.H9, 12);
  assert.equal(selected.previous.values.H9, 5);
  assert.equal(
    comparison.results.find((group) => group.id === otherRegion.id).current
      .values.H9,
    19,
  );
  assert.equal(
    comparison.results.find((group) => group.id === otherRegion.id).current
      .count,
    1,
  );
  await call(provincial, 'analytics?' + comparisons, undefined, 403);
  await call(
    provincial,
    'analytics/export?' + comparisons + '&type=pdf',
    undefined,
    403,
  );
  const scoped = await (
    await call(provincial, 'analytics?year=2026&month=11&rubric=I.A.1')
  ).json();
  assert.equal(scoped.results[0].services, 1);
  assert.equal(scoped.results[0].current.values.H9, 12);
  const reportingBook = new ExcelJS.Workbook();
  await reportingBook.xlsx.load(
    await (
      await call(central, 'analytics/export?' + comparisons + '&type=xlsx')
    ).arrayBuffer(),
  );
  assert.ok(reportingBook.getWorksheet('I.A.1'));
  assert.ok(!reportingBook.getWorksheet('VI.B'));
  const reportingPdf = await PDFDocument.load(
    await (
      await call(central, 'analytics/export?' + comparisons + '&type=pdf')
    ).arrayBuffer(),
  );
  assert.ok(reportingPdf.getPageCount());
  await call(
    provincial,
    'export/email?id=' + report.id,
    { recipient: 'first@example.invalid,second@example.invalid' },
    400,
  );
  await call(
    frontalier,
    'export/email?id=' + report.id,
    { recipient: 'vetra-test@example.invalid' },
    403,
  );
  await call(
    provincial,
    'analytics/email?' + comparisons,
    { recipient: 'vetra-test@example.invalid' },
    403,
  );
  await call(
    null,
    'export/email?id=' + report.id,
    { recipient: 'vetra-test@example.invalid' },
    401,
  );
  if (process.env.VETRA_TEST_SMTP_CAPTURE === 'true') {
    const monthly = await (
      await call(provincial, 'export/email?id=' + report.id, {
        recipient: 'vetra-test@example.invalid',
      })
    ).json();
    assert.equal(monthly.sent, true);
    const analytics = await (
      await call(central, 'analytics/email?' + comparisons, {
        recipient: 'vetra-test@example.invalid',
      })
    ).json();
    assert.equal(analytics.sent, true);
  }
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
  if (otpMailbox) {
    const email = provincial.email;
    const replacement = 'Vetra-Nouveau-Mot-De-Passe-2026';
    await call(null, 'password/request', { email });
    const code = await readVerificationCode(email);
    await call(null, 'password/reset', { email, code, password: 'court' }, 400);
    const reset = await call(null, 'password/reset', {
      email,
      code,
      password: replacement,
    });
    assert.equal(reset.headers.get('set-cookie'), null);
    await call(
      null,
      'password/reset',
      { email, code, password: replacement },
      400,
    );
    await call(null, 'login', { email, password: provincial.password }, 401);
    const confirmed = await loginWithTestAccount({
      email,
      password: replacement,
    });
    assert.ok(confirmed.headers.get('set-cookie'));
    console.log(
      'OTP par SMTP, Réinitialisation et rejet des codes réutilisés vérifiés.',
    );
  }
  await call(provincial, 'logout', {});
  console.log(
    'VETRA : parcours PostgreSQL, cinq profils, deux services, workflow, droits, audit et exports validés.',
  );
} finally {
  const serviceIds = [service?.id, otherService?.id].filter(Boolean);
  await db.event.deleteMany({ where: { userId: { in: users } } });
  await db.report.deleteMany({ where: { serviceId: { in: serviceIds } } });
  await db.otp.deleteMany({ where: { userId: { in: users } } });
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
