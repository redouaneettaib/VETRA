import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { db } from './prisma';
import type { User } from '@prisma/client';
import {
  isPreviewMode,
  previewAllowedServices,
  previewFindUserById,
  previewGetActiveUser,
  previewSetActiveUser,
} from './preview-store';

const PREVIEW_SESSION_SECRET =
  'vetra-aistudio-preview-ephemeral-session-key-non-production';

const key = () => {
  const s =
    process.env.SESSION_SECRET ||
    (isPreviewMode() ? PREVIEW_SESSION_SECRET : '');
  if (!s || s.length < 32)
    throw Error('SESSION_SECRET doit contenir 32 caractères minimum');
  return new TextEncoder().encode(s);
};

export async function setSession(id: string) {
  const preview = isPreviewMode();
  if (preview) previewSetActiveUser(id);
  const token = await new SignJWT({ sub: id })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .sign(key());
  (await cookies()).set('vetra_session', token, {
    httpOnly: true,
    sameSite: preview ? 'none' : 'lax',
    secure: preview ? true : process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 43200,
  });
}

export async function clearSession() {
  if (isPreviewMode()) previewSetActiveUser(null);
  (await cookies()).delete('vetra_session');
}

export async function currentUser(): Promise<User | null> {
  if (isPreviewMode()) {
    try {
      const token = (await cookies()).get('vetra_session')?.value;
      if (token) {
        const { payload } = await jwtVerify(token, key());
        const found = previewFindUserById(String(payload.sub));
        if (found?.active) return found;
      }
    } catch {
      // Fallback to active preview session if browser blocks 3P iframe cookies
    }
    return previewGetActiveUser();
  }
  try {
    const token = (await cookies()).get('vetra_session')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, key());
    return await db.user.findUnique({ where: { id: String(payload.sub) } });
  } catch {
    return null;
  }
}

export async function allowedServices(user: User) {
  if (isPreviewMode()) return previewAllowedServices(user);
  if (user.role === 'ADMIN_NATIONAL' || user.role === 'DIRECTION_CENTRALE')
    return (await db.service.findMany({ select: { id: true } })).map(
      (x) => x.id,
    );
  if (user.role === 'CHEF_SERVICE') return user.serviceId ? [user.serviceId] : [];
  if (user.role === 'CHEF_DIVISION')
    return (
      await db.service.findMany({
        where: { divisionId: user.divisionId || '---' },
        select: { id: true },
      })
    ).map((x) => x.id);
  if (user.role === 'DIRECTEUR_REGIONAL')
    return (
      await db.service.findMany({
        where: { division: { regionId: user.regionId || '---' } },
        select: { id: true },
      })
    ).map((x) => x.id);
  return [];
}

export const fail = (error: string, status = 400) =>
  Response.json({ error }, { status });
