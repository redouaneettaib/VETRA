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

it('génère les gabarits e-mail de code 24h et de mot de passe temporaire avec échappement HTML', async () => {
  const { buildAdminResetPasswordEmailHtml } = await import('../src/lib/mail');
  const otpHtml = buildOtpEmailHtml('RESET', '654321', '24 heures');
  expect(otpHtml).toContain('654321');
  expect(otpHtml).toContain('24 heures');

  const pwdHtml = buildAdminResetPasswordEmailHtml(
    'Abc<&>"123456!',
    'Salma <Admin>',
  );
  expect(pwdHtml).toContain('Abc&lt;&amp;&gt;&quot;123456!');
  expect(pwdHtml).toContain('Bonjour Salma &lt;Admin&gt;,');
  expect(pwdHtml).not.toContain('Abc<&>"123456!');
});

it('bascule sur SMTP si RESEND_FROM est vide mais SMTP est configuré', () => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('RESEND_FROM', '');
  vi.stubEnv('SMTP_HOST', 'smtp.gmail.com');
  vi.stubEnv('SMTP_PORT', '465');
  vi.stubEnv('SMTP_FROM', 'VETRA <test@gmail.com>');
  vi.stubEnv('SMTP_USER', 'test@gmail.com');
  expect(mailConfigured()).toBe(true);
  expect(mailStatus()).toMatchObject({
    configured: true,
    provider: 'smtp',
    host: 'smtp.gmail.com',
    port: 465,
    authenticated: true,
  });
  vi.stubEnv('SMTP_FROM', '');
  expect(mailConfigured()).toBe(true);
  expect(mailStatus()).toMatchObject({
    configured: true,
    provider: 'smtp',
    from: 'test@gmail.com',
  });
});

it('envoie un e-mail via Brevo HTTPS avec pièce jointe PDF en base64', async () => {
  vi.stubEnv('BREVO_API_KEY', 'xkeysib-test');
  vi.stubEnv('BREVO_FROM', 'VETRA ONSSA <vetra@gmail.com>');
  vi.stubEnv('RESEND_API_KEY', '');
  vi.stubEnv('SMTP_HOST', '');
  const fetchMock = vi.fn(async (_url: string, _options: RequestInit) =>
    Response.json({ messageId: '<brevo-123@brevo.com>' }),
  );
  vi.stubGlobal('fetch', fetchMock);
  expect(mailConfigured()).toBe(true);
  expect(mailStatus()).toMatchObject({
    configured: true,
    provider: 'brevo',
    from: 'VETRA ONSSA <vetra@gmail.com>',
  });
  const res = await email(
    'agent@onssa.gov.ma',
    'VETRA — Code',
    'Votre code : 654321',
    { filename: 'rapport.pdf', content: Buffer.from('%PDF') },
    buildOtpEmailHtml('RESET', '654321', '10 minutes'),
  );
  expect(res).toEqual({
    provider: 'brevo',
    messageId: '<brevo-123@brevo.com>',
  });
  expect(fetchMock.mock.calls[0][0]).toBe(
    'https://api.brevo.com/v3/smtp/email',
  );
  expect(fetchMock.mock.calls[0][1].headers).toHaveProperty(
    'api-key',
    'xkeysib-test',
  );
  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({
    sender: { name: 'VETRA ONSSA', email: 'vetra@gmail.com' },
    to: [{ email: 'agent@onssa.gov.ma' }],
    subject: 'VETRA — Code',
    textContent: 'Votre code : 654321',
    attachment: [
      { name: 'rapport.pdf', content: Buffer.from('%PDF').toString('base64') },
    ],
  });
});



