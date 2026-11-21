import { afterEach, expect, it, vi } from 'vitest';
import {
  buildOtpEmailHtml,
  email,
  mailConfigured,
  mailStatus,
} from '../src/lib/mail';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('envoie un OTP et transmet le PDF en base64 via HTTPS', async () => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('RESEND_FROM', 'VETRA <test@example.invalid>');
  vi.stubEnv('SMTP_HOST', '');
  const fetchMock = vi.fn(async (_url: string, _options: RequestInit) =>
    Response.json({ id: 'test' }),
  );
  vi.stubGlobal('fetch', fetchMock);
  expect(mailConfigured()).toBe(true);
  const res = await email(
    'user@example.invalid',
    'OTP',
    'Votre code',
    undefined,
    buildOtpEmailHtml('RESET', '123456'),
  );
  expect(res).toEqual({ provider: 'resend', messageId: 'test' });
  await email('user@example.invalid', 'Rapport', 'Ci-joint', {
    filename: 'rapport.pdf',
    content: Buffer.from('%PDF'),
  });
  expect(fetchMock.mock.calls[0][0]).toBe('https://api.resend.com/emails');
  expect(fetchMock.mock.calls[0][1].headers).toHaveProperty(
    'Authorization',
    'Bearer test-key',
  );
  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({
    to: ['user@example.invalid'],
    text: 'Votre code',
  });
  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).html).toContain(
    '123456',
  );
  expect(
    JSON.parse(String(fetchMock.mock.calls[1][1].body)).attachments,
  ).toEqual([
    {
      filename: 'rapport.pdf',
      content: Buffer.from('%PDF').toString('base64'),
    },
  ]);
});

it('détecte la configuration incomplète et les refus détaillés du fournisseur', async () => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('RESEND_FROM', '');
  vi.stubEnv('SMTP_HOST', '');
  vi.stubEnv('SMTP_FROM', '');
  expect(mailConfigured()).toBe(false);
  expect(mailStatus()).toMatchObject({
    configured: false,
    provider: 'none',
    missing: ['RESEND_FROM'],
  });
  vi.stubEnv('RESEND_FROM', 'VETRA <onboarding@resend.dev>');
  expect(mailStatus()).toMatchObject({
    configured: true,
    provider: 'resend',
    sandboxSender: true,
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json(
        { message: 'You can only send testing emails to your own email address.' },
        { status: 403 },
      ),
    ),
  );
  await expect(
    email('user@example.invalid', 'OTP', 'Votre code'),
  ).rejects.toThrow(/HTTP 403.*testing emails/);
});
