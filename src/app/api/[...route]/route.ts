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
import {
  buildAdminResetNoticeHtml,
  buildOtpEmailHtml,
  email,
  mailConfigured,
  mailStatus,
} from '@/lib/mail';
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
const recipientAddress = z.string().trim().max(254).email();
const findUserByEmail = (address: string) => {
  const normalized = address.trim();
  if (!normalized) return Promise.resolve(null);
  return db.user.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' } },
  });
};

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
  const recent = await db.otp.findFirst({
    where: {
      userId,
      purpose,
      consumed: false,
      createdAt: { gt: new Date(Date.now() - 30_000) },
    },
    select: { id: true },
  });
  if (recent) return { cooldown: true };
  const code = String(crypto.randomInt(100000, 1000000));
  const challenge = await db.otp.create({
    data: {
      userId,
      purpose,
      hash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });
  const subject =
    purpose === 'RESET'
      ? 'VETRA — Réinitialisation du mot de passe'
      : 'VETRA — Code de vérification';
  const html = buildOtpEmailHtml(purpose === 'RESET' ? 'RESET' : 'LOGIN', code);
  try {
    await email(
      to,
      subject,
      `Code à usage unique : ${code}. Expiration : 10 minutes.`,
      undefined,
      html,
    );
    return { cooldown: false };
  } catch (error) {
    console.error(
      'VETRA OTP mail delivery failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
    await db.otp.update({
      where: { id: challenge.id },
      data: { consumed: true },
    });
    throw error;
  }
}
async function verifyOtp(userId: string, purpose: string, code: string) {
  if (!/^\d{6}$/.test(code)) return false;
  const challenge = await db.otp.findFirst({
    where: { userId, purpose },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  if (!challenge || challenge.consumed || challenge.expiresAt <= new Date())
    return false;
  // Preserve compatibility with codes already stored as bare bcrypt hashes.
  const encoded = /^(\d+):(.+)$/.exec(challenge.hash);
  const attempts = encoded ? Number(encoded[1]) : 0;
  const digest = encoded?.[2] ?? challenge.hash;
  if (attempts >= 5) return false;
  const reservation = await db.otp.updateMany({
    where: {
      id: challenge.id,
      hash: challenge.hash,
      consumed: false,
      expiresAt: { gt: new Date() },
    },
    data: { hash: `${attempts + 1}:${digest}` },
  });
  if (reservation.count !== 1 || !(await bcrypt.compare(code, digest)))
    return false;
  const used = await db.otp.updateMany({
    where: { id: challenge.id, consumed: false, expiresAt: { gt: new Date() } },
    data: { consumed: true },
  });
  return used.count === 1;
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
    const user = await findUserByEmail(String(body.email || ''));
    if (
      !user ||
      !user.active ||
      !(await bcrypt.compare(String(body.password || ''), user.passwordHash))
    )
      return fail('Identifiants incorrects', 401);
    if (process.env.REQUIRE_LOGIN_OTP !== 'false') {
      if (!mailConfigured())
        return fail(
          'L’envoi du code OTP est indisponible. Le serveur de messagerie doit être configuré.',
          503,
        );
      try {
        await otp(user.id, 'LOGIN', user.email);
      } catch {
        return fail(
          'Le serveur de messagerie n’a pas confirmé l’envoi du code OTP. Contactez l’administrateur national.',
          502,
        );
      }
      return Response.json({ otpRequired: true, email: user.email });
    }
    await setSession(user.id);
    return Response.json({ ok: true });
  }
  if (path === 'otp/verify' && method === 'POST') {
    const user = await findUserByEmail(String(body.email || ''));
    if (
      !user ||
      !user.active ||
      !(await verifyOtp(user.id, 'LOGIN', String(body.code || '').trim()))
    )
      return fail('Code incorrect ou expiré', 401);
    await setSession(user.id);
    return Response.json({ ok: true });
  }
  if (path === 'password/request' && method === 'POST') {
    const parsedEmail = recipientAddress.safeParse(
      String(body.email || '')
        .trim()
        .toLowerCase(),
    );
    if (!parsedEmail.success)
      return fail('Saisissez une adresse e-mail professionnelle valide.', 400);
    const note =
      typeof body.note === 'string'
        ? body.note.replace(/[\x00-\x1f]/g, ' ').trim().slice(0, 200)
        : '';
    const user = await findUserByEmail(parsedEmail.data);
    const hasMail = mailConfigured();
    if (user && user.active) {
      const recentRequest = await db.event.findFirst({
        where: {
          userId: user.id,
          action: 'PASSWORD_RESET_REQUEST',
          createdAt: { gt: new Date(Date.now() - 5 * 60_000) },
        },
        select: { id: true },
      });
      if (!recentRequest) {
        await db.event.create({
          data: {
            userId: user.id,
            action: 'PASSWORD_RESET_REQUEST',
            reason: note || 'Demande depuis l’écran de connexion',
          },
        });
      }
      if (hasMail) {
        try {
          await otp(user.id, 'RESET', user.email);
        } catch (error) {
          console.error(
            'VETRA reset email failed (admin request still recorded):',
            error instanceof Error ? error.message : 'unknown error',
          );
        }
      }
    }
    return Response.json({ ok: true, mode: hasMail ? 'email' : 'admin' });
  }
  if (path === 'password/reset' && method === 'POST') {
    const parsedEmail = recipientAddress.safeParse(
      String(body.email || '')
        .trim()
        .toLowerCase(),
    );
    if (!parsedEmail.success)
      return fail('Code invalide ou mot de passe trop court');
    const password = body.password;
    const code = String(body.code || '').trim();
    if (
      typeof password !== 'string' ||
      password.length < 12 ||
      Buffer.byteLength(password, 'utf8') > 72
    )
      return fail('Code invalide ou mot de passe trop court');
    const user = await findUserByEmail(parsedEmail.data);
    if (
      !user ||
      !user.active ||
      !(await verifyOtp(user.id, 'RESET', code))
    )
      return fail('Code invalide ou mot de passe trop court');
    const passwordHash = await bcrypt.hash(password, 12);
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      db.otp.updateMany({
        where: { userId: user.id, purpose: 'RESET', consumed: false },
        data: { consumed: true },
      }),
      db.event.create({
        data: {
          userId: user.id,
          action: 'PASSWORD_RESET_RESOLVED',
          reason: 'Mot de passe réinitialisé par code à usage unique',
        },
      }),
    ]);
    return Response.json({ ok: true });
  }
  if (!u || !u.active) return fail('Connexion requise', 401);
  if (path === 'password/change' && method === 'POST') {
    const { currentPassword, password } = body;
    if (
      typeof currentPassword !== 'string' ||
      typeof password !== 'string' ||
      password.length < 12 ||
      Buffer.byteLength(password, 'utf8') > 72
    )
      return fail(
        'Le nouveau mot de passe doit contenir au moins 12 caractères et ne pas dépasser 72 octets.',
      );
    if (!(await bcrypt.compare(currentPassword, u.passwordHash)))
      return fail('Mot de passe actuel incorrect.', 400);
    if (await bcrypt.compare(password, u.passwordHash))
      return fail(
        'Choisissez un mot de passe différent du mot de passe actuel.',
      );
    const passwordHash = await bcrypt.hash(password, 12);
    const changed = await db.user.updateMany({
      where: { id: u.id, active: true, passwordHash: u.passwordHash },
      data: { passwordHash },
    });
    return changed.count === 1
      ? Response.json({ ok: true })
      : fail('Le compte a changé entre-temps. Réessayez.', 409);
  }
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
              phone: true,
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
  if (path === 'admin/mail-status' && method === 'GET') {
    if (!isAdmin(u.role)) return fail('Accès administrateur requis', 403);
    return Response.json(mailStatus(), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  if (path === 'admin/reset-requests' && method === 'GET') {
    if (!isAdmin(u.role)) return fail('Accès administrateur requis', 403);
    const events = await db.event.findMany({
      where: {
        action: { in: ['PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_RESOLVED'] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 500,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            email: true,
            phone: true,
            role: true,
            active: true,
            service: { select: { name: true } },
            region: { select: { name: true } },
          },
        },
      },
    });
    const seen = new Set<string>();
    const pending = [];
    for (const event of events) {
      if (seen.has(event.userId)) continue;
      seen.add(event.userId);
      if (event.action === 'PASSWORD_RESET_REQUEST' && event.user.active) {
        pending.push({
          id: event.id,
          userId: event.user.id,
          name: event.user.name,
          firstName: event.user.firstName,
          email: event.user.email,
          phone: event.user.phone ?? '',
          role: event.user.role,
          serviceName: event.user.service?.name ?? '',
          regionName: event.user.region?.name ?? '',
          note: event.reason ?? '',
          createdAt: event.createdAt,
        });
      }
    }
    return Response.json(pending, {
      headers: { 'Cache-Control': 'private, no-store' },
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
    } else if (body.action === 'user' || body.action === 'userEdit') {
      const email = String(body.email ?? '')
          .trim()
          .toLowerCase(),
        name = String(body.name ?? '').trim().toLocaleUpperCase('fr-FR'),
        firstName = String(body.firstName ?? '')
          .trim()
          .toLocaleUpperCase('fr-FR');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name || !firstName)
        return fail('Nom, prénom et adresse e-mail valide obligatoires');
      const phone = String(body.phone ?? '').trim();
      if (body.action === 'userEdit') {
        const id = String(body.id ?? '');
        const account = await db.user.findUnique({ where: { id }, select: { email: true } });
        if (!account) return fail('Compte introuvable', 404);
        const owner = await findUserByEmail(email);
        if (owner && owner.id !== id) return fail('Cette adresse e-mail est déjà utilisée', 409);
        const updated = await db.user.update({
          where: { id },
          data: {
            email,
            name,
            firstName,
            phone,
            ...(email !== account.email
              ? { otps: { updateMany: { where: { consumed: false }, data: { consumed: true } } } }
              : {}),
          },
        });
        return Response.json({ ok: true, id: updated.id });
      }
      const password = body.password,
        role = body.role as Role;
      if (
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
          phone,
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
    } else if (body.action === 'userResetPassword') {
      const id = String(body.id ?? '').trim();
      const password = body.password;
      if (
        !id ||
        typeof password !== 'string' ||
        password.length < 12 ||
        Buffer.byteLength(password, 'utf8') > 72
      )
        return fail(
          'Le mot de passe doit contenir au moins 12 caractères (72 octets maximum).',
        );
      const target = await db.user.findUnique({
        where: { id },
        select: { id: true, email: true, active: true },
      });
      if (!target) return fail('Compte introuvable', 404);
      const passwordHash = await bcrypt.hash(password, 12);
      await db.$transaction([
        db.user.update({
          where: { id: target.id },
          data: { passwordHash },
        }),
        db.otp.updateMany({
          where: { userId: target.id, consumed: false },
          data: { consumed: true },
        }),
        db.event.create({
          data: {
            userId: u.id,
            action: 'ADMIN_RESET_PASSWORD',
            reason: `Réinitialisation administrateur pour ${target.email}`,
          },
        }),
        db.event.create({
          data: {
            userId: target.id,
            action: 'PASSWORD_RESET_RESOLVED',
            reason: `Mot de passe réinitialisé par ${u.firstName} ${u.name}`,
          },
        }),
      ]);
      let notified = false;
      let notifyError = '';
      if (body.notifyByEmail === true && mailConfigured()) {
        try {
          await email(
            target.email,
            'VETRA — Mot de passe réinitialisé',
            'Bonjour,\n\nL’administrateur national a réinitialisé le mot de passe de votre compte VETRA. Par mesure de sécurité, le nouveau mot de passe temporaire n’est pas transmis par e-mail. Rapprochez-vous de votre administrateur pour le récupérer puis modifiez-le dès votre connexion.\n\nONSSA / DPA — VETRA',
            undefined,
            buildAdminResetNoticeHtml(),
          );
          notified = true;
        } catch (cause) {
          notifyError =
            cause instanceof Error
              ? cause.message
              : 'Notification par e-mail non confirmée.';
        }
      }
      return Response.json({
        ok: true,
        id: target.id,
        notified,
        ...(notifyError ? { notifyError } : {}),
      });
    } else if (body.action === 'userGenerateResetCode') {
      const id = String(body.id ?? '').trim();
      if (!id) return fail('Compte introuvable', 404);
      const target = await db.user.findUnique({
        where: { id },
        select: { id: true, email: true, active: true },
      });
      if (!target) return fail('Compte introuvable', 404);
      if (!target.active)
        return fail('Réactivez d’abord ce compte avant de générer un code.', 409);
      const code = String(crypto.randomInt(100000, 1000000));
      const hash = await bcrypt.hash(code, 10);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);
      await db.$transaction([
        db.otp.updateMany({
          where: { userId: target.id, purpose: 'RESET', consumed: false },
          data: { consumed: true },
        }),
        db.otp.create({
          data: {
            userId: target.id,
            purpose: 'RESET',
            hash,
            expiresAt,
          },
        }),
        db.event.create({
          data: {
            userId: u.id,
            action: 'ADMIN_GENERATED_RESET_CODE',
            reason: `Code de réinitialisation généré pour ${target.email}`,
          },
        }),
        db.event.create({
          data: {
            userId: target.id,
            action: 'PASSWORD_RESET_RESOLVED',
            reason: `Code temporaire 24h généré par ${u.firstName} ${u.name}`,
          },
        }),
      ]);
      return Response.json(
        {
          ok: true,
          id: target.id,
          code,
          expiresAt: expiresAt.toISOString(),
        },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    } else if (body.action === 'dismissResetRequest') {
      const id = String(body.id ?? '').trim();
      if (!id) return fail('Compte introuvable', 404);
      const target = await db.user.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!target) return fail('Compte introuvable', 404);
      await db.event.create({
        data: {
          userId: target.id,
          action: 'PASSWORD_RESET_RESOLVED',
          reason: `Demande clôturée par ${u.firstName} ${u.name}`,
        },
      });
      return Response.json({ ok: true, id: target.id });
    } else if (body.action === 'mailTest') {
      const checked = recipientAddress.safeParse(body.recipient);
      if (!checked.success)
        return fail('Saisissez une adresse e-mail destinataire valide.', 400);
      const status = mailStatus();
      if (!status.configured)
        return fail(
          `Messagerie non configurée. Variables serveur requises : ${status.missing.join(', ')}.`,
          503,
        );
      try {
        const sent = await email(
          checked.data,
          'VETRA — Test de la messagerie',
          `Bonjour,\n\nCeci est un e-mail de test envoyé depuis l’administration VETRA via ${status.provider.toUpperCase()} (${status.from}).\n\nONSSA / DPA — VETRA`,
          undefined,
          buildOtpEmailHtml('LOGIN', '000000').replace(
            'Pour confirmer votre connexion à la plateforme VETRA, saisissez le code à usage unique ci-dessous :',
            'Ceci est un e-mail de vérification envoyé depuis le module de diagnostic messagerie VETRA. Votre configuration d’envoi fonctionne correctement.',
          ).replace('000000', 'OK'),
        );
        return Response.json({
          ok: true,
          provider: sent.provider,
          messageId: sent.messageId ?? null,
          from: status.from,
        });
      } catch (cause) {
        return fail(
          cause instanceof Error
            ? cause.message
            : 'Le serveur de messagerie a refusé l’envoi de test.',
          502,
        );
      }
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
    if (req.nextUrl.searchParams.get('summary') === '1') {
      return Response.json(
        await db.report.findMany({ where, select: { serviceId: true } }),
      );
    }
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
      const divisionCanDecide =
        u.role === 'CHEF_DIVISION' &&
        u.divisionId === report.service.divisionId &&
        report.status === 'SOUMIS';
      const centralCanRevoke =
        action === 'revoquer' &&
        u.role === 'DIRECTION_CENTRALE' &&
        ['SOUMIS', 'VALIDE'].includes(report.status);
      if (!divisionCanDecide && !centralCanRevoke)
        return fail(
          action === 'valider'
            ? 'Validation non autorisée'
            : 'Révocation non autorisée',
          403,
        );
      status = action === 'valider' ? 'VALIDE' : 'REVOQUE';
      if (
        status === 'REVOQUE' &&
        (typeof body.reason !== 'string' || !body.reason.trim())
      )
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
          reason: status === 'REVOQUE' ? body.reason.trim() : null,
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
          reason: status === 'REVOQUE' ? body.reason.trim() : null,
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
        'Le service d’envoi d’e-mails de VETRA n’est pas configuré.',
        503,
      );
    const reports = await db.report.findMany({
      where: {
        serviceId: { in: eligible.map((service) => service.id) },
        year: {
          gte: Math.max(
            1900,
            filters.year - (filters.trend === 'years' ? filters.span - 1 : 1),
          ),
          lte: filters.year,
        },
      },
      select: {
        serviceId: true,
        year: true,
        month: true,
        status: true,
        data: true,
      },
    });
    const analysis = analyze(
      filters,
      eligible,
      reports.filter((report) => report.status === 'VALIDE'),
      reports,
    );
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
          'Le service d’envoi d’e-mails de VETRA n’est pas configuré.',
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
