import type { Kind, Role, Status } from '@prisma/client';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { CANEVAS, RUBRICS } from './canevas';
import {
  calculate,
  calculatedCells,
  defaultRubricsForKind,
  effectiveRubrics,
  isValidCompletedProgression,
  numericCells,
  readNumber,
} from './forms';
import { analyze, parseFilters } from './analytics';
import { exportAnalysis } from './reporting-export';
import { exportReport } from './exports';
import {
  clearSession,
  currentUser,
  fail,
  setSession,
} from './auth';
import { mailStatus } from './mail';
import {
  getPreviewStore,
  PREVIEW_PASSWORD,
  previewAccounts,
  previewAllowedServices,
  previewFindUserByEmail,
  previewHydrateReport,
  previewHydrateService,
  previewNextId,
} from './preview-store';

type Input = Record<string, any>;
const obj = (v: unknown): Input =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Input) : {};

export async function handlePreviewRoute(
  req: NextRequest,
  method: 'GET' | 'POST',
  path: string,
  body: Input,
): Promise<Response> {
  if (path === 'preview-accounts' && method === 'GET') {
    return Response.json(
      {
        preview: true,
        password: PREVIEW_PASSWORD,
        accounts: previewAccounts(),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const resetCodes: Map<string, { code: string; expiresAt: number }> =
    ((globalThis as Record<string, unknown>).__vetraPreviewResetCodes as Map<
      string,
      { code: string; expiresAt: number }
    >) ??
    (((globalThis as Record<string, unknown>).__vetraPreviewResetCodes =
      new Map<string, { code: string; expiresAt: number }>()) as Map<
      string,
      { code: string; expiresAt: number }
    >);

  if (path === 'login' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = previewFindUserByEmail(email);
    const matchesPassword = user?.passwordHash
      ? password === user.passwordHash || password === PREVIEW_PASSWORD
      : password === PREVIEW_PASSWORD;
    if (!user || !user.active || !matchesPassword) {
      return fail(
        `Identifiants aperçu incorrects. Utilisez un compte d’aperçu (ex. direction@vetra.local) avec le mot de passe ${PREVIEW_PASSWORD}.`,
        401,
      );
    }
    await setSession(user.id);
    return Response.json({ ok: true });
  }

  if (path === 'logout' && method === 'POST') {
    await clearSession();
    return Response.json({ ok: true });
  }

  if (path === 'password/request' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const user = previewFindUserByEmail(email);
    if (user && user.active) {
      const store = getPreviewStore();
      store.events.push({
        id: previewNextId('evt'),
        userId: user.id,
        reportId: null,
        action: 'PASSWORD_RESET_REQUEST',
        oldStatus: null,
        newStatus: null,
        reason:
          typeof body.note === 'string' && body.note.trim()
            ? body.note.trim().slice(0, 200)
            : 'Demande depuis l’écran de connexion (aperçu)',
        createdAt: new Date(),
      });
    }
    return Response.json({ ok: true, mode: 'admin' });
  }

  if (path === 'password/reset' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();
    const password = String(body.password || '');
    const user = previewFindUserByEmail(email);
    const entry = user ? resetCodes.get(user.id) : undefined;
    if (
      !user ||
      !user.active ||
      password.length < 12 ||
      !entry ||
      entry.code !== code ||
      entry.expiresAt <= Date.now()
    ) {
      return fail('Code invalide ou mot de passe trop court');
    }
    user.passwordHash = password;
    resetCodes.delete(user.id);
    const store = getPreviewStore();
    store.events.push({
      id: previewNextId('evt'),
      userId: user.id,
      reportId: null,
      action: 'PASSWORD_RESET_RESOLVED',
      oldStatus: null,
      newStatus: null,
      reason: 'Mot de passe réinitialisé par code à usage unique (aperçu)',
      createdAt: new Date(),
    });
    return Response.json({ ok: true });
  }

  const u = await currentUser();
  if (!u || !u.active) return fail('Non authentifié', 401);

  const store = getPreviewStore();
  const isAdmin = u.role === 'ADMIN_NATIONAL';
  const scope = previewAllowedServices(u);

  if (path === 'me') {
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
      scope,
    });
  }

  if (path === 'canevas') {
    return Response.json({ rubrics: RUBRICS, rows: CANEVAS });
  }

  if (path === 'org') {
    const hydratedServices = store.services
      .map((s) => previewHydrateService(s))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const visible = hydratedServices.filter((s) => scope.includes(s.id));
    return Response.json({
      regions: isAdmin
        ? [...store.regions].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
        : store.regions.filter((r) =>
            visible.some((s) => s.division.regionId === r.id),
          ),
      divisions: isAdmin
        ? [...store.divisions].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
        : store.divisions.filter((d) =>
            visible.some((s) => s.divisionId === d.id),
          ),
      services: visible,
      users: isAdmin
        ? store.users.map((usr) => ({
            id: usr.id,
            name: usr.name,
            firstName: usr.firstName,
            email: usr.email,
            phone: usr.phone,
            role: usr.role,
            serviceId: usr.serviceId,
            divisionId: usr.divisionId,
            regionId: usr.regionId,
            active: usr.active,
          }))
        : [],
    });
  }

  if (path === 'admin/mail-status' && method === 'GET') {
    if (!isAdmin) return fail('Accès administrateur requis', 403);
    return Response.json(mailStatus(), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  if (path === 'admin/reset-requests' && method === 'GET') {
    if (!isAdmin) return fail('Accès administrateur requis', 403);
    const resetEvents = [...store.events]
      .filter(
        (e) =>
          e.action === 'PASSWORD_RESET_REQUEST' ||
          e.action === 'PASSWORD_RESET_RESOLVED',
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const seen = new Set<string>();
    const pending = [];
    for (const evt of resetEvents) {
      if (seen.has(evt.userId)) continue;
      seen.add(evt.userId);
      const usr = store.users.find((x) => x.id === evt.userId);
      if (evt.action === 'PASSWORD_RESET_REQUEST' && usr?.active) {
        const srv = store.services.find((s) => s.id === usr.serviceId);
        const reg = store.regions.find((r) => r.id === usr.regionId);
        pending.push({
          id: evt.id,
          userId: usr.id,
          name: usr.name,
          firstName: usr.firstName,
          email: usr.email,
          phone: usr.phone ?? '',
          role: usr.role,
          serviceName: srv?.name ?? '',
          regionName: reg?.name ?? '',
          note: evt.reason ?? '',
          createdAt: evt.createdAt,
        });
      }
    }
    return Response.json(pending, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  if (path === 'admin' && method === 'POST') {
    if (!isAdmin) return fail('Accès administrateur requis', 403);
    if (body.action === 'rights') {
      const srv = store.services.find((s) => s.id === String(body.serviceId));
      if (!srv) return fail('Service introuvable', 404);
      if (Array.isArray(body.enabled)) {
        if (
          body.enabled.some((id: unknown) => !RUBRICS.some((r) => r[0] === id))
        ) {
          return fail('Liste invalide');
        }
        const enabledSet = new Set(body.enabled.map(String));
        srv.rights = RUBRICS.map(([rubricId]) => ({
          serviceId: srv.id,
          rubricId,
          enabled: enabledSet.has(rubricId),
        }));
      } else if (Array.isArray(body.rights)) {
        srv.rights = body.rights.map((r: any) => ({
          serviceId: srv.id,
          rubricId: String(r.rubricId),
          enabled: Boolean(r.enabled),
        }));
      } else {
        return fail('Liste invalide');
      }
      return Response.json({ ok: true, id: srv.id });
    }
    if (body.action === 'service') {
      const name = String(body.name ?? '').trim();
      const divisionId = String(body.divisionId ?? '');
      const kind = body.kind as Kind;
      if (!name || !['PROVINCIAL', 'FRONTALIER'].includes(kind)) {
        return fail('Nom, type et division valides obligatoires');
      }
      const id = previewNextId('srv');
      const defaultEnabled = new Set(defaultRubricsForKind(kind));
      store.services.push({
        id,
        name,
        kind,
        divisionId,
        rights: RUBRICS.map(([rubricId]) => ({
          serviceId: id,
          rubricId,
          enabled: defaultEnabled.has(rubricId),
        })),
      });
      return Response.json({ ok: true, id });
    }
    if (body.action === 'serviceUpdate') {
      const srv = store.services.find((s) => s.id === String(body.id));
      if (!srv) return fail('Service introuvable', 404);
      srv.name = String(body.name ?? srv.name).trim();
      srv.kind = (body.kind as Kind) ?? srv.kind;
      srv.divisionId = String(body.divisionId ?? srv.divisionId);
      return Response.json({ ok: true, id: srv.id });
    }
    if (body.action === 'dismissResetRequest') {
      const id = String(body.id ?? '').trim();
      store.events.push({
        id: previewNextId('evt'),
        userId: id,
        reportId: null,
        action: 'PASSWORD_RESET_RESOLVED',
        oldStatus: null,
        newStatus: null,
        reason: `Demande clôturée par ${u.firstName} ${u.name}`,
        createdAt: new Date(),
      });
      return Response.json({ ok: true, id });
    }
    if (
      body.action === 'userGenerateResetCode' ||
      body.action === 'generateResetCode'
    ) {
      const id = String(body.id ?? '').trim();
      const target = store.users.find((x) => x.id === id);
      if (!target) return fail('Compte introuvable', 404);
      if (!target.active)
        return fail(
          'Réactivez d’abord ce compte avant de générer un code.',
          409,
        );
      const code = String(crypto.randomInt(100000, 1000000));
      const expiresAt = Date.now() + 24 * 3600_000;
      resetCodes.set(target.id, { code, expiresAt });
      store.events.push({
        id: previewNextId('evt'),
        userId: id,
        reportId: null,
        action: 'PASSWORD_RESET_RESOLVED',
        oldStatus: null,
        newStatus: null,
        reason: `Code temporaire 24h généré par ${u.firstName} ${u.name}`,
        createdAt: new Date(),
      });
      return Response.json(
        {
          ok: true,
          id,
          code,
          expiresAt: new Date(expiresAt).toISOString(),
          emailed: false,
          mailConfigured: mailStatus().configured,
        },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }
    if (body.action === 'userResetPassword') {
      const id = String(body.id ?? '').trim();
      const rawPassword =
        typeof body.password === 'string' ? body.password : '';
      const autoGenerate = body.generate === true || rawPassword.length === 0;
      const groups = [
        'ABCDEFGHJKLMNPQRSTUVWXYZ',
        'abcdefghijkmnopqrstuvwxyz',
        '23456789',
        '!@#$%&*-_',
      ];
      const all = groups.join('');
      const chars = groups.map((g) => g[crypto.randomInt(0, g.length)]);
      for (let i = groups.length; i < 16; i++) {
        chars.push(all[crypto.randomInt(0, all.length)]);
      }
      for (let i = chars.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      const password = autoGenerate ? chars.join('') : rawPassword;
      if (!id || password.length < 12) {
        return fail('Le mot de passe doit contenir au moins 12 caractères.');
      }
      const target = store.users.find((x) => x.id === id);
      if (!target) return fail('Compte introuvable', 404);
      target.passwordHash = password;
      resetCodes.delete(target.id);
      store.events.push({
        id: previewNextId('evt'),
        userId: target.id,
        reportId: null,
        action: 'PASSWORD_RESET_RESOLVED',
        oldStatus: null,
        newStatus: null,
        reason: `Mot de passe réinitialisé par ${u.firstName} ${u.name}`,
        createdAt: new Date(),
      });
      return Response.json(
        {
          ok: true,
          id: target.id,
          password,
          emailed: false,
          notified: false,
          mailConfigured: mailStatus().configured,
        },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }
    if (body.action === 'userUpdate' || body.action === 'disableUser') {
      const id = String(body.id ?? body.userId);
      const usr = store.users.find((x) => x.id === id);
      if (!usr) return fail('Utilisateur introuvable', 404);
      usr.active =
        body.action === 'disableUser' ? false : Boolean(body.active);
      return Response.json({ ok: true, id: usr.id });
    }
    if (body.action === 'user') {
      const id = previewNextId('usr');
      store.users.push({
        id,
        name: String(body.name || '').trim(),
        firstName: String(body.firstName || '').trim(),
        email: String(body.email || '').trim().toLowerCase(),
        phone: String(body.phone || '').trim() || null,
        role: body.role as Role,
        passwordHash: '',
        verified: true,
        regionId: body.regionId || null,
        divisionId: body.divisionId || null,
        serviceId: body.serviceId || null,
        active: true,
        createdAt: new Date(),
      });
      return Response.json({ ok: true, id });
    }
    return Response.json({ ok: true });
  }

  if (path === 'reports' && method === 'GET') {
    const year = Number(req.nextUrl.searchParams.get('year'));
    const month = Number(req.nextUrl.searchParams.get('month'));
    const matching = store.reports
      .filter(
        (r) =>
          scope.includes(r.serviceId) &&
          (!year || r.year === year) &&
          (!month || r.month === month),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    if (req.nextUrl.searchParams.get('summary') === '1') {
      return Response.json(matching.map((r) => ({ serviceId: r.serviceId })));
    }
    return Response.json(matching.map((r) => previewHydrateReport(r)));
  }

  if (path === 'report' && method === 'POST') {
    if (u.role !== 'CHEF_SERVICE' || !u.serviceId || u.serviceId !== body.serviceId) {
      return fail('Chef de service requis', 403);
    }
    const year = Number(body.year);
    const month = Number(body.month);
    const data = obj(body.data);
    const srv = store.services.find((s) => s.id === u.serviceId);
    if (!srv) return fail('Service introuvable', 404);
    const expected = effectiveRubrics(srv.rights, srv.kind);
    const existing = store.reports.find(
      (r) => r.serviceId === u.serviceId && r.year === year && r.month === month,
    );
    if (existing && !['BROUILLON', 'REVOQUE', 'CORRIGE'].includes(existing.status)) {
      return fail('Rapport verrouillé', 409);
    }
    const previousCompleted = Array.isArray(existing?.data?.__completed)
      ? (existing!.data.__completed as unknown[]).map(String)
      : [];
    const rawCompleted = data.__completed ?? [];
    if (
      !Array.isArray(rawCompleted) ||
      !isValidCompletedProgression(
        expected,
        previousCompleted,
        rawCompleted.map(String),
      )
    ) {
      return fail('Complétez les rubriques dans l’ordre du canevas');
    }
    const completed = expected.filter((id) =>
      rawCompleted.map(String).includes(id),
    );
    const next: Record<string, unknown> = {
      ...(existing?.data ?? {}),
      __completed: completed,
    };
    for (const [cell, value] of Object.entries(data)) {
      if (cell === '__completed' || cell === '__tables') continue;
      if (existing && Object.hasOwn(existing.data, cell) && existing.data[cell] === value) {
        continue;
      }
      const field = numericCells.get(cell);
      if (!field || !expected.some((id) => id === field.rubric)) {
        return fail('Cellule non habilitée : ' + cell, 403);
      }
      if (value === '') delete next[cell];
      else {
        const num = readNumber(value);
        if (num !== undefined) next[cell] = num;
      }
    }
    if (Array.isArray(data.__tables)) next.__tables = data.__tables;
    const status: Status =
      existing?.status === 'REVOQUE' || existing?.status === 'CORRIGE'
        ? 'CORRIGE'
        : 'BROUILLON';
    const now = new Date();
    if (existing) {
      existing.data = next;
      existing.status = status;
      existing.updatedAt = now;
      return Response.json(existing);
    }
    const created = {
      id: previewNextId('rep'),
      serviceId: u.serviceId,
      year,
      month,
      status,
      data: next,
      reason: null,
      createdAt: now,
      updatedAt: now,
    };
    store.reports.push(created);
    return Response.json(created);
  }

  if (path === 'workflow' && method === 'POST') {
    const report = store.reports.find((r) => r.id === String(body.id));
    if (!report) return fail('Rapport introuvable', 404);
    const srv = store.services.find((s) => s.id === report.serviceId);
    if (!srv) return fail('Service introuvable', 404);
    const action = String(body.action);
    const oldStatus = report.status;
    let nextStatus: Status;
    if (action === 'soumettre') {
      if (
        u.role !== 'CHEF_SERVICE' ||
        u.serviceId !== report.serviceId ||
        !['BROUILLON', 'CORRIGE'].includes(report.status)
      ) {
        return fail('Soumission non autorisée', 403);
      }
      const expected = effectiveRubrics(srv.rights, srv.kind);
      const completed = obj(report.data).__completed;
      if (!expected.length) return fail('Aucune rubrique habilitée', 409);
      if (
        !Array.isArray(completed) ||
        expected.some((id) => !completed.includes(id))
      ) {
        return fail(
          'Rubriques incomplètes : ' +
            expected
              .filter(
                (id) => !Array.isArray(completed) || !completed.includes(id),
              )
              .join(', '),
          409,
        );
      }
      nextStatus = 'SOUMIS';
    } else if (action === 'valider' || action === 'revoquer') {
      const divisionCanDecide =
        u.role === 'CHEF_DIVISION' &&
        u.divisionId === srv.divisionId &&
        report.status === 'SOUMIS';
      const centralCanRevoke =
        action === 'revoquer' &&
        u.role === 'DIRECTION_CENTRALE' &&
        ['SOUMIS', 'VALIDE'].includes(report.status);
      if (!divisionCanDecide && !centralCanRevoke) {
        return fail(
          action === 'valider'
            ? 'Validation non autorisée'
            : 'Révocation non autorisée',
          403,
        );
      }
      if (
        action === 'revoquer' &&
        (typeof body.reason !== 'string' || !body.reason.trim())
      ) {
        return fail('Motif de révocation obligatoire');
      }
      nextStatus = action === 'valider' ? 'VALIDE' : 'REVOQUE';
    } else {
      return fail('Action inconnue');
    }
    report.status = nextStatus;
    report.reason =
      nextStatus === 'REVOQUE' ? String(body.reason).trim() : null;
    report.updatedAt = new Date();
    store.events.push({
      id: previewNextId('evt'),
      userId: u.id,
      reportId: report.id,
      action,
      oldStatus,
      newStatus: nextStatus,
      reason: report.reason,
      createdAt: new Date(),
    });
    return Response.json(report);
  }

  if (path === 'events') {
    const id = String(req.nextUrl.searchParams.get('id') || '');
    const report = store.reports.find((r) => r.id === id);
    if (!report || !scope.includes(report.serviceId)) {
      return fail('Accès refusé', 403);
    }
    const items = store.events
      .filter((e) => e.reportId === id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((e) => {
        const usr = store.users.find((x) => x.id === e.userId);
        return {
          ...e,
          user: {
            name: usr?.name ?? 'Utilisateur',
            firstName: usr?.firstName ?? '',
            role: usr?.role ?? 'CHEF_SERVICE',
          },
        };
      });
    return Response.json(items);
  }

  if (
    method === 'GET' &&
    (path === 'analytics' || path === 'analytics/export')
  ) {
    const params = req.nextUrl.searchParams;
    let filters;
    try {
      filters = parseFilters(params);
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Filtres invalides');
    }
    const services = store.services
      .filter((s) => scope.includes(s.id))
      .map((s) => {
        const h = previewHydrateService(s);
        return { id: h.id, name: h.name, region: h.division.region };
      });
    const eligible =
      filters.group === 'all'
        ? services
        : services.filter((service) =>
            filters.ids.includes(
              filters.group === 'region' ? service.region.id : service.id,
            ),
          );
    const minYear = Math.max(
      1900,
      filters.year - (filters.trend === 'years' ? filters.span - 1 : 1),
    );
    const eligibleIds = new Set(eligible.map((s) => s.id));
    const reports = store.reports.filter(
      (r) =>
        eligibleIds.has(r.serviceId) &&
        r.year >= minYear &&
        r.year <= filters.year,
    );
    const analysis = analyze(
      filters,
      eligible,
      reports.filter((r) => r.status === 'VALIDE'),
      reports,
    );
    if (path === 'analytics') {
      return Response.json(analysis, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    const type = params.get('type');
    if (type !== 'xlsx' && type !== 'pdf') return fail('Format inconnu');
    return exportAnalysis(analysis, type);
  }

  if (path === 'reporting') {
    const year = Number(req.nextUrl.searchParams.get('year'));
    const month = Number(req.nextUrl.searchParams.get('month'));
    const rr = store.reports
      .filter(
        (r) =>
          scope.includes(r.serviceId) &&
          r.status === 'VALIDE' &&
          (!year || r.year === year) &&
          (!month || r.month === month),
      )
      .map((r) => previewHydrateReport(r));

    const totals: Record<string, number> = {};
    for (const r of rr) {
      for (const [key, field] of numericCells) {
        const value = readNumber(obj(r.data)[key]);
        if (!field.percent && value !== undefined) {
          totals[key] = Number(((totals[key] ?? 0) + value).toPrecision(14));
        }
      }
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

  if (method === 'GET' && path === 'export') {
    const id = req.nextUrl.searchParams.get('id');
    const report = store.reports.find((r) => r.id === String(id));
    if (!report || !scope.includes(report.serviceId)) {
      return fail('Accès refusé', 403);
    }
    const type = req.nextUrl.searchParams.get('type');
    if (type !== 'pdf' && type !== 'xlsx') return fail('Format inconnu');
    return exportReport(previewHydrateReport(report) as any, type);
  }

  return fail('Action non disponible en mode aperçu local', 400);
}
