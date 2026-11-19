import { afterEach, expect, it, vi } from 'vitest';
import { email, mailConfigured } from '../src/lib/mail';

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
  await email('user@example.invalid', 'OTP', 'Votre code');
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
  expect(
    JSON.parse(String(fetchMock.mock.calls[1][1].body)).attachments,
  ).toEqual([
    {
      filename: 'rapport.pdf',
      content: Buffer.from('%PDF').toString('base64'),
    },
  ]);
});

it('détecte la configuration incomplète et les refus du fournisseur', async () => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('RESEND_FROM', '');
  expect(mailConfigured()).toBe(false);
  vi.stubEnv('RESEND_FROM', 'test@example.invalid');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 403 })),
  );
  await expect(
    email('user@example.invalid', 'OTP', 'Votre code'),
  ).rejects.toThrow('HTTP 403');
});
