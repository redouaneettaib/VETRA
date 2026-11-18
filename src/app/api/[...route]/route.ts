import { Role } from '@prisma/client';
import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  currentUser,
  allowedServices,
  setSession,
  clearSession,
  fail,
} from '@/lib/auth';
import { CANEVAS, RUBRICS } from '@/lib/canevas';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import {
  calculate,
  calculatedCells,
  dynamicFields,
  enabledRubrics,
  numericCells,
  readNumber,
} from '@/lib/forms';
import { analyze, parseFilters } from '@/lib/analytics';
import { exportAnalysis } from '@/lib/reporting-export';
import { exportReport } from '@/lib/exports';
export const runtime = 'nodejs';
type Input = Record<string, any>;
const obj = (v: unknown): Input =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Input) : {};
const isAdmin = (role: string) => role === 'ADMIN_NATIONAL';
const mailConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
const recipientAddress = z.string().trim().max(254).email();

async function email(
  to: string,
  subject: string,
  text: string,
  attachment?: { filename: string; content: Buffer },
) {
  if (!mailConfigured()) throw Error('SMTP non configuré');
  const port = Number(process.env.SMTP_PORT || 587);
  const tr = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  const sent = await tr.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    attachments: attachment
      ? [{ ...attachment, contentType: 'application/pdf' }]
      : undefined,
  });
  if (!sent.accepted.length) throw Error('Destinataire refusé par SMTP');
}

async function sendReportEmail(
  recipient: string,
  title: string,
  pdf: Response,
) {
  const filename =
    pdf.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ??
    'VETRA.pdf';
  const content = Buffer.from(await pdf.arrayBuffer());
  if (!pdf.ok || content.subarray(0, 5).toString('ascii') !== '%PDF-')
    return fail('Le PDF n’a pas pu être généré.', 500);
  try {
    await email(
      recipient,
      'VETRA — ' + title,
      'Bonjour,\n\nVous trouverez en pièce jointe le rapport PDF généré depuis VETRA.\n\nONSSA / DPA — VETRA',
      { filename, content },
    );
    return Response.json({ sent: true });
  } catch {
    return fail(
      'Le serveur de messagerie n’a pas confirmé l’envoi du PDF. Vérifiez l’adresse et réessayez.',
      502,
    );
  }
}
async function otp(userId: string, purpose: string, to: string) {
  const code = String(crypto.randomInt(100000, 1000000));
  await db.otp.create({
    data: {
      userId,
      purpose,
      hash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });
  await email(
    to,
    'VETRA — Code de vérification',
    `Code à usage unique : ${code}. Expiration : 10 minutes.`,
  );
}
async function verifyOtp(userId: string, purpose: string, code: string) {
  const candidates = await db.otp.findMany({
    where: { userId, purpose, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  for (const x of candidates)
    if (await bcrypt.compare(code, x.hash)) {
      const used = await db.otp.updateMany({
        where: { id: x.id, consumed: false, expiresAt: { gt: new Date() } },
        data: { consumed: true },
      });
      return used.count === 1;
    }
  return false;
}
async function handle(
  req: NextRequest,
  method: 'GET' | 'POST',
  parts: string[],
) {
  const path = parts.join('/');
  const body: Input =
    method === 'POST' ? obj(await req.json().catch(() => ({}))) : {};
  const u = await currentUser();
  if (path === 'login' && method === 'POST') {
    const user = await db.user.findUnique({
      where: { email: String(body.email || '').toLowerCase() },
    });
    if (
      !user ||
      !user.active ||
      !(await bcrypt.compare(String(body.password || ''), user.passwordHash))
    )
      return fail('Identifiants incorrects', 401);
    if (process.env.REQUIRE_LOGIN_OTP !== 'false') {
      await otp(user.id, 'LOGIN', user.email);
      return Response.json({ otpRequired: true, email: user.email });
    }
    await setSession(user.id);
    return Response.json({ ok: true });
  }
  if (path === 'otp/verify' && method === 'POST') {
    const user = await db.user.findUnique({
      where: { email: String(body.email || '').toLowerCase() },
    });
    if (
      !user ||
      !user.active ||
      !(await verifyOtp(user.id, 'LOGIN', String(body.code || '')))
    )
      return fail('Code incorrect ou expiré', 401);
    await setSession(user.id);
    return Response.json({ ok: true });
  }
  if (path === 'password/request' && method === 'POST') {
    const user = await db.user.findUnique({
      where: { email: String(body.email || '').toLowerCase() },
    });
    if (user && user.active) await otp(user.id, 'RESET', user.email);
    return Response.json({ ok: true });
  }
  if (path === 'password/reset' && method === 'POST') {
    const user = await db.user.findUnique({
      where: { email: String(body.email || '').toLowerCase() },
    });
    if (
      !user ||
      !user.active ||
      String(body.password || '').length < 12 ||
      !(await verifyOtp(user.id, 'RESET', String(body.code || '')))
    )
      return fail('Code invalide ou mot de passe trop court');
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(body.password, 12) },
    });
    return Response.json({ ok: true });
  }
  if (!u || !u.active) return fail('Connexion requise', 401);
  if (path === 'logout' && method === 'POST') {
    await clearSession();
    return Response.json({ ok: true });
  }
  if (path === 'me')
    return Response.json({
      user: {
        id: u.id,
        name: u.name,
        firstName: u.firstName,
        role: u.role,
        serviceId: u.serviceId,
        divisionId: u.divisionId,
        regionId: u.regionId,
      },
      scope: await allowedServices(u),
    });
  if (path === 'canevas')
    return Response.json({ rubrics: RUBRICS, rows: CANEVAS });
  if (path === 'org') {
    const [regions, divisions, services, users] = await Promise.all([
      db.region.findMany({ orderBy: { name: 'asc' } }),
      db.division.findMany({ orderBy: { name: 'asc' } }),
      db.service.findMany({
        include: { rights: true, division: true },
        orderBy: { name: 'asc' },
      }),
      isAdmin(u.role)
        ? db.user.findMany({
            select: {
              id: true,
              name: true,
              firstName: true,
              email: true,
              role: true,
              serviceId: true,
              divisionId: true,
              regionId: true,
              active: true,
            },
          })
        : Promise.resolve([]),
    ]);
    const scope = await allowedServices(u);
    const visible = services.filter((s) => scope.includes(s.id));
    return Response.json({
      regions: isAdmin(u.role)
        ? regions
        : regions.filter((r) =>
            visible.some((s) => s.division.regionId === r.id),
          ),
      divisions: isAdmin(u.role)
        ? divisions
        : divisions.filter((d) => visible.some((s) => s.divisionId === d.id)),
      services: visible,
      users,
    });
  }
  if (path === 'admin' && method === 'POST') {
    if (!isAdmin(u.role)) return fail('Accès administrateur requis', 403);
    let result: any;
    if (body.action === 'service' || body.action === 'serviceUpdate') {
      const name = String(body.name ?? '').trim(),
        divisionId = String(body.divisionId ?? ''),
        kind = body.kind;
      if (
        !name ||
        !['PROVINCIAL', 'FRONTALIER'].includes(kind) ||
        !(await db.division.findUnique({ where: { id: divisionId } }))
      )
        return fail('Nom, type et division valides obligatoires');
      if (body.action === 'service') {
        result = await db.service.create({ data: { name, divisionId, kind } });
      } else {
        const existing = await db.service.findUnique({
          where: { id: String(body.id) },
        });
        if (!existing) return fail('Service introuvable', 404);
        if (existing.divisionId !== divisionId) {
          result = await db.$transaction(async (tx) => {
            const division = await tx.division.findUniqueOrThrow({
              where: { id: divisionId },
            });
            const updated = await tx.service.update({
              where: { id: existing.id },
              data: { name, divisionId, kind },
            });
            await tx.user.updateMany({
              where: { serviceId: existing.id, role: 'CHEF_SERVICE' },
              data: { divisionId, regionId: division.regionId },
            });
            return updated;
          });
        } else
          result = await db.service.update({
            where: { id: existing.id },
            data: { name, kind },
          });
      }
    } else if (body.action === 'region') {
      const name = String(body.name ?? '').trim();
      if (!name) return fail('Nom de région obligatoire');
      result = await db.region.create({ data: { name } });
    } else if (body.action === 'userUpdate' || body.action === 'disableUser') {
      const id = String(body.id ?? body.userId);
      const active = body.action === 'disableUser' ? false : body.active;
      if (typeof active !== 'boolean') return fail('État de compte invalide');
      if (id === u.id && !active) return fail('Votre compte doit rester actif');
      result = await db.user.update({
        where: { id },
        data: {
          active,
          ...(typeof body.phone === 'string'
            ? { phone: body.phone.trim() }
            : {}),
        },
      });
    } else if (body.action === 'user') {
      const email = String(body.email ?? '')
          .trim()
          .toLowerCase(),
        name = String(body.name ?? '').trim(),
        firstName = String(body.firstName ?? '').trim();
      const password = body.password,
        role = body.role as Role;
      if (
        !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
        !name ||
        !firstName ||
        typeof password !== 'string' ||
        password.length < 12 ||
        !Object.values(Role).includes(role)
      )
        return fail('Compte incomplet');
      const service =
        role === 'CHEF_SERVICE'
          ? await db.service.findUnique({
              where: { id: String(body.serviceId) },
              include: { division: true },
            })
          : null;
      const division =
        role === 'CHEF_DIVISION'
          ? await db.division.findUnique({
              where: { id: String(body.divisionId) },
            })
          : service?.division;
      const region =
        role === 'DIRECTEUR_REGIONAL'
          ? await db.region.findUnique({ where: { id: String(body.regionId) } })
          : null;
      if (
        (role === 'CHEF_SERVICE' && !service) ||
        (role === 'CHEF_DIVISION' && !division) ||
        (role === 'DIRECTEUR_REGIONAL' && !region)
      )
        return fail('Rattachement obligatoire pour ce profil');
      result = await db.user.create({
        data: {
          email,
          name,
          firstName,
          phone: String(body.phone ?? '').trim(),
          role,
          serviceId: service?.id,
          divisionId: division?.id,
          regionId: division?.regionId ?? region?.id,
          passwordHash: await bcrypt.hash(password, 12),
        },
      });
    } else if (body.action === 'rights') {
      if (
        !Array.isArray(body.enabled) ||
        body.enabled.some((id: unknown) => !RUBRICS.some((r) => r[0] === id))
      )
        return fail('Liste invalide');
      const serviceId = String(body.serviceId);
      if (!(await db.service.findUnique({ where: { id: serviceId } })))
        return fail('Service introuvable', 404);
      await db.$transaction(
        RUBRICS.map(([id]) =>
          db.rubricRight.upsert({
            where: { serviceId_rubricId: { serviceId, rubricId: id } },
            create: {
              serviceId,
              rubricId: id,
              enabled: body.enabled.includes(id),
            },
            update: { enabled: body.enabled.includes(id) },
          }),
        ),
      );
      result = { ok: true };
    } else return fail('Action inconnue');
    return Response.json({ ok: true, id: result?.id });
  }
  if (path === 'reports' && method === 'GET') {
    const scope = await allowedServices(u),
      year = Number(req.nextUrl.searchParams.get('year')),
      month = Number(req.nextUrl.searchParams.get('month'));
    const where: any = { serviceId: { in: scope } };
    if (year) where.year = year;
    if (month) where.month = month;
    return Response.json(
      await db.report.findMany({
        where,
        include: {
          service: { include: { division: { include: { region: true } } } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    );
  }
  if (path === 'report' && method === 'POST') {
    if (
      u.role !== 'CHEF_SERVICE' ||
      !u.serviceId ||
      u.serviceId !== body.serviceId
    )
      return fail('Chef de service requis', 403);
    const serviceId = u.serviceId,
      year = Number(body.year),
      month = Number(body.month);
    if (
      !Number.isInteger(year) ||
      year < 1900 ||
      year > 9999 ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    )
      return fail('Période incorrecte');
    if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data))
      return fail('Données invalides');
    const data = obj(body.data);
    const expected = enabledRubrics(
      await db.rubricRight.findMany({ where: { serviceId } }),
    );
    const completed = data.__completed ?? [];
    if (
      !Array.isArray(completed) ||
      new Set(completed).size !== completed.length ||
      !expected
        .slice(0, completed.length)
        .every((id) => completed.includes(id)) ||
      completed.length > expected.length
    )
      return fail('Complétez les rubriques dans l’ordre du canevas');
    const key = { serviceId_year_month: { serviceId, year, month } };
    const old = await db.report.findUnique({ where: key });
    if (old && !['BROUILLON', 'REVOQUE', 'CORRIGE'].includes(old.status))
      return fail('Rapport verrouillé', 409);
    if ((old?.updatedAt.toISOString() ?? null) !== (body.version ?? null))
      return fail(
        'Rapport modifié. Rechargez la période avant de réessayer.',
        409,
      );
    const previous = obj(old?.data);
    const next: Input = { ...previous, __completed: completed };
    for (const [cell, value] of Object.entries(data)) {
      if (cell === '__completed' || cell === '__tables') continue;
      if (Object.hasOwn(previous, cell) && previous[cell] === value) continue;
      const field = numericCells.get(cell);
      if (!field || !expected.some((id) => id === field.rubric)) {
        return fail('Cellule non habilitée : ' + cell, 403);
      }
      const number = readNumber(value);
      if (
        value !== '' &&
        (number === undefined ||
          (field.integer && !Number.isSafeInteger(number)) ||
          (field.percent && number > 100))
      )
        return fail('Valeur incorrecte pour « ' + field.label + ' »');
      if (value === '') delete next[cell];
      else next[cell] = number;
    }
    if (data.__tables !== undefined) {
      if (!Array.isArray(data.__tables) || data.__tables.length > 200)
        return fail('Tableau dynamique invalide');
      const previousRows = Array.isArray(previous.__tables)
        ? previous.__tables
        : [];
      const preserved = previousRows.filter(
        (row) => !expected.some((id) => id === row.rubric),
      );
      const active = [];
      for (const row of data.__tables) {
        const fields = dynamicFields[row?.rubric];
        if (
          !Array.isArray(fields) ||
          !Array.isArray(row.values) ||
          row.values.length > fields.length
        )
          return fail('Ligne dynamique invalide');
        if (!expected.some((id) => id === row.rubric)) {
          if (
            preserved.some(
              (item) => JSON.stringify(item) === JSON.stringify(row),
            )
          )
            continue;
          return fail('Rubrique non habilitée', 403);
        }
        if (
          previousRows.some(
            (item) => JSON.stringify(item) === JSON.stringify(row),
          )
        ) {
          active.push(row);
          continue;
        }
        const values = fields.map((_, index) => row.values[index] ?? '');
        if (
          values.some((value, index) => {
            if (value === '') return false;
            const kind = fields[index].kind;
            if (kind === 'number')
              return (
                readNumber(value) === undefined ||
                ((row.rubric === 'I.D' || index === 0) &&
                  !Number.isSafeInteger(readNumber(value)))
              );
            if (typeof value !== 'string' || value.length > 1000) return true;
            if (kind !== 'date') return false;
            const date = new Date(value + 'T00:00:00Z');
            return (
              !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
              isNaN(date.getTime()) ||
              date.toISOString().slice(0, 10) !== value
            );
          })
        )
          return fail('Valeur incorrecte dans une ligne de ' + row.rubric);
        if (values.some((value) => value !== ''))
          active.push({ rubric: row.rubric, values });
      }
      next.__tables = [...preserved, ...active];
    }
    const status =
      old?.status === 'REVOQUE' || old?.status === 'CORRIGE'
        ? 'CORRIGE'
        : 'BROUILLON';
    const saved = await db.$transaction(async (tx) => {
      if (old) {
        const result = await tx.report.updateMany({
          where: { id: old.id, status: old.status, updatedAt: old.updatedAt },
          data: { data: next, status },
        });
        if (result.count !== 1) return null;
      }
      const report = old
        ? await tx.report.findUniqueOrThrow({ where: { id: old.id } })
        : await tx.report.create({
            data: { serviceId, year, month, data: next, status },
          });
      await tx.event.create({
        data: {
          userId: u.id,
          reportId: report.id,
          action: old ? 'MODIFICATION' : 'CREATION',
          oldStatus: old?.status,
          newStatus: status,
        },
      });
      return report;
    });
    return saved
      ? Response.json(saved)
      : fail('Rapport modifié simultanément', 409);
  }
  if (path === 'workflow' && method === 'POST') {
    const report = await db.report.findUnique({
      where: { id: String(body.id) },
      include: { service: true },
    });
    if (!report) return fail('Rapport introuvable', 404);
    const action = String(body.action);
    let status: 'SOUMIS' | 'VALIDE' | 'REVOQUE';
    if (action === 'soumettre') {
      if (
        u.role !== 'CHEF_SERVICE' ||
        u.serviceId !== report.serviceId ||
        !['BROUILLON', 'CORRIGE'].includes(report.status)
      )
        return fail('Soumission non autorisée', 403);
      const rights = await db.rubricRight.findMany({
        where: { serviceId: report.serviceId },
      });
      const expected = RUBRICS.map(([id]) => id).filter(
        (id) =>
          !rights.length || rights.some((r) => r.rubricId === id && r.enabled),
      );
      const completed = obj(report.data).__completed;
      if (!expected.length) return fail('Aucune rubrique habilitée', 409);
      if (
        !Array.isArray(completed) ||
        expected.some((id) => !completed.includes(id))
      )
        return fail(
          'Rubriques incomplètes : ' +
            expected
              .filter(
                (id) => !Array.isArray(completed) || !completed.includes(id),
              )
              .join(', '),
          409,
        );
      status = 'SOUMIS';
    } else if (action === 'valider' || action === 'revoquer') {
      if (
        u.role !== 'CHEF_DIVISION' ||
        u.divisionId !== report.service.divisionId ||
        report.status !== 'SOUMIS'
      )
        return fail('Validation non autorisée', 403);
      status = action === 'valider' ? 'VALIDE' : 'REVOQUE';
      if (status === 'REVOQUE' && !String(body.reason || '').trim())
        return fail('Motif de révocation obligatoire');
    } else return fail('Action inconnue');
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.report.updateMany({
        where: {
          id: report.id,
          status: report.status,
          updatedAt: report.updatedAt,
        },
        data: {
          status,
          reason: status === 'REVOQUE' ? String(body.reason) : null,
        },
      });
      if (result.count !== 1) return null;
      await tx.event.create({
        data: {
          userId: u.id,
          reportId: report.id,
          action,
          oldStatus: report.status,
          newStatus: status,
          reason: status === 'REVOQUE' ? String(body.reason) : null,
        },
      });
      return tx.report.findUnique({ where: { id: report.id } });
    });
    return updated
      ? Response.json(updated)
      : fail('Rapport modifié simultanément', 409);
  }
  if (path === 'events') {
    const scope = await allowedServices(u);
    const id = String(req.nextUrl.searchParams.get('id') || '');
    const report = await db.report.findUnique({ where: { id } });
    if (!report || !scope.includes(report.serviceId))
      return fail('Accès refusé', 403);
    return Response.json(
      await db.event.findMany({
        where: { reportId: id },
        include: {
          user: { select: { name: true, firstName: true, role: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }
  const reportEmail =
    method === 'POST' &&
    (path === 'export/email' || path === 'analytics/email');
  const checkedRecipient = reportEmail
    ? recipientAddress.safeParse(body.recipient)
    : null;
  if (checkedRecipient && !checkedRecipient.success)
    return fail('Saisissez une seule adresse e-mail valide.');
  const recipient = checkedRecipient?.success ? checkedRecipient.data : null;
  if (
    (method === 'GET' &&
      (path === 'analytics' || path === 'analytics/export')) ||
    (reportEmail && path === 'analytics/email')
  ) {
    const params = req.nextUrl.searchParams;
    let filters;
    try {
      filters = parseFilters(params);
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Filtres invalides');
    }
    const scope = await allowedServices(u);
    const scoped = await db.service.findMany({
      where: { id: { in: scope } },
      select: {
        id: true,
        name: true,
        division: { select: { region: { select: { id: true, name: true } } } },
      },
    });
    const services = scoped.map(({ division, ...service }) => ({
      ...service,
      region: division.region,
    }));
    const eligible =
      filters.group === 'all'
        ? services
        : services.filter((service) =>
            filters.ids.includes(
              filters.group === 'region' ? service.region.id : service.id,
            ),
          );
    if (
      filters.group !== 'all' &&
      filters.ids.some(
        (id) =>
          !eligible.some(
            (service) =>
              (filters.group === 'region' ? service.region.id : service.id) ===
              id,
          ),
      )
    )
      return fail('Périmètre non autorisé', 403);
    if (recipient && !mailConfigured())
      return fail(
        'Le serveur de messagerie SMTP de VETRA n’est pas configuré.',
        503,
      );
    const reports = await db.report.findMany({
      where: {
        status: 'VALIDE',
        serviceId: { in: eligible.map((service) => service.id) },
        year: {
          gte: Math.max(
            1900,
            filters.year - (filters.trend === 'years' ? filters.span - 1 : 1),
          ),
          lte: filters.year,
        },
      },
      select: { serviceId: true, year: true, month: true, data: true },
    });
    const analysis = analyze(filters, eligible, reports);
    if (recipient)
      return sendReportEmail(
        recipient,
        `Reporting ${analysis.period}`,
        await exportAnalysis(analysis, 'pdf'),
      );
    if (path === 'analytics')
      return Response.json(analysis, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    const type = params.get('type');
    if (type !== 'xlsx' && type !== 'pdf') return fail('Format inconnu');
    return exportAnalysis(analysis, type);
  }
  if (path === 'reporting') {
    const scope = await allowedServices(u),
      year = Number(req.nextUrl.searchParams.get('year')),
      month = Number(req.nextUrl.searchParams.get('month'));
    const where: any = { serviceId: { in: scope }, status: 'VALIDE' };
    if (year) where.year = year;
    if (month) where.month = month;
    const rr = await db.report.findMany({
      where,
      include: {
        service: { include: { division: { include: { region: true } } } },
      },
    });
    const totals: Record<string, number> = {};
    for (const r of rr)
      for (const [key, field] of numericCells) {
        const value = readNumber(obj(r.data)[key]);
        if (!field.percent && value !== undefined)
          totals[key] = Number(((totals[key] ?? 0) + value).toPrecision(14));
      }
    for (const [key] of calculatedCells) {
      const value = calculate(key, totals);
      if (value !== undefined) totals[key] = value;
    }
    return Response.json({
      count: rr.length,
      totals,
      byRegion: Object.entries(
        rr.reduce((a: Record<string, number>, r) => {
          const name = r.service.division.region.name;
          a[name] = (a[name] || 0) + 1;
          return a;
        }, {}),
      ),
    });
  }
  if (
    (method === 'GET' && path === 'export') ||
    (reportEmail && path === 'export/email')
  ) {
    const id = req.nextUrl.searchParams.get('id');
    const report = await db.report.findUnique({
      where: { id: String(id) },
      include: { service: true },
    });
    if (
      !report ||
      (await allowedServices(u)).includes(report.serviceId) === false
    )
      return fail('Accès refusé', 403);
    if (recipient) {
      if (!mailConfigured())
        return fail(
          'Le serveur de messagerie SMTP de VETRA n’est pas configuré.',
          503,
        );
      return sendReportEmail(
        recipient,
        `Rapport ${report.month}/${report.year} · ${report.service.name}`,
        await exportReport(report, 'pdf'),
      );
    }
    const type = req.nextUrl.searchParams.get('type');
    if (type !== 'pdf' && type !== 'xlsx') return fail('Format inconnu');
    return exportReport(report, type);
  }
  return fail('Route inconnue', 404);
}
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ route: string[] }> },
) {
  try {
    return await handle(req, 'GET', (await ctx.params).route);
  } catch (e) {
    console.error(e);
    return e && typeof e === 'object' && 'code' in e && e.code === 'P2002'
      ? fail('Un enregistrement existe déjà ou vient d’être créé', 409)
      : fail('Erreur serveur', 500);
  }
}
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ route: string[] }> },
) {
  try {
    return await handle(req, 'POST', (await ctx.params).route);
  } catch (e) {
    console.error(e);
    return e && typeof e === 'object' && 'code' in e && e.code === 'P2002'
      ? fail('Un enregistrement existe déjà ou vient d’être créé', 409)
      : fail('Erreur serveur', 500);
  }
}
