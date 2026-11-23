import nodemailer from 'nodemailer';

const brevoApiKey = () => process.env.BREVO_API_KEY?.trim();
const brevoFrom = () => process.env.BREVO_FROM?.trim();
const apiKey = () => process.env.RESEND_API_KEY?.trim();
const resendFrom = () => process.env.RESEND_FROM?.trim();
const smtpHostValue = () =>
  (process.env.SMTP_HOST?.trim() || '').replace(/^smtps?:\/\//i, '');
const smtpUserValue = () => process.env.SMTP_USER?.trim() || '';
const smtpSender = () => {
  const explicit = process.env.SMTP_FROM?.trim();
  if (explicit) return explicit;
  const user = smtpUserValue();
  return user.includes('@') ? user : '';
};

function parseFromAddress(raw: string): { name?: string; email: string } {
  const trimmed = raw.trim();
  const match = /^(.*?)<\s*([^<>\s]+@[^<>\s]+)\s*>$/.exec(trimmed);
  if (match) {
    const name = match[1].trim().replace(/^["']|["']$/g, '');
    return { ...(name ? { name } : {}), email: match[2].trim() };
  }
  return { email: trimmed };
}

export function mailConfigured() {
  return Boolean(
    (brevoApiKey() && brevoFrom()) ||
      (apiKey() && resendFrom()) ||
      (smtpHostValue() && smtpSender()),
  );
}

export interface MailStatus {
  configured: boolean;
  provider: 'brevo' | 'resend' | 'smtp' | 'none';
  from: string;
  host?: string;
  port?: number;
  authenticated?: boolean;
  sandboxSender: boolean;
  missing: string[];
}

export function mailStatus(): MailStatus {
  const hasBrevoKey = Boolean(brevoApiKey());
  const fromBrevo = brevoFrom() || '';
  const hasResendKey = Boolean(apiKey());
  const fromResend = resendFrom() || '';
  const smtpHost = smtpHostValue();
  const smtpFrom = smtpSender();
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpAuth = Boolean(smtpUserValue());

  if (hasBrevoKey && fromBrevo) {
    return {
      configured: true,
      provider: 'brevo',
      from: fromBrevo,
      sandboxSender: false,
      missing: [],
    };
  }
  if (hasResendKey && fromResend) {
    return {
      configured: true,
      provider: 'resend',
      from: fromResend,
      sandboxSender: /@resend\.dev\b/i.test(fromResend),
      missing: [],
    };
  }
  if (smtpHost && smtpFrom) {
    return {
      configured: true,
      provider: 'smtp',
      from: smtpFrom,
      host: smtpHost,
      port: smtpPort,
      authenticated: smtpAuth,
      sandboxSender: false,
      missing: [],
    };
  }
  const missing: string[] = [];
  if (hasBrevoKey && !fromBrevo) missing.push('BREVO_FROM');
  else if (hasResendKey && !fromResend) missing.push('RESEND_FROM');
  else if (smtpHost && !smtpFrom) missing.push('SMTP_FROM (ou SMTP_USER)');
  else if (!hasBrevoKey && !hasResendKey && !smtpHost) {
    missing.push(
      'BREVO_API_KEY + BREVO_FROM (ou RESEND_API_KEY + RESEND_FROM, ou SMTP_HOST + SMTP_FROM)',
    );
  }
  return {
    configured: false,
    provider: 'none',
    from: '',
    sandboxSender: false,
    missing,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildOtpEmailHtml(
  purpose: 'LOGIN' | 'RESET',
  code: string,
  expiryLabel = '10 minutes',
) {
  const safeCode = code.replace(/\D/g, '').slice(0, 6);
  const safeExpiry = escapeHtml(expiryLabel);
  const title =
    purpose === 'RESET'
      ? 'Réinitialisation de votre mot de passe'
      : 'Code de vérification de connexion';
  const intro =
    purpose === 'RESET'
      ? 'Un code à usage unique a été généré pour réinitialiser le mot de passe de votre compte VETRA. Cliquez sur « Mot de passe oublié ? → J’ai reçu un code à 6 chiffres » puis saisissez le code ci-dessous :'
      : 'Pour confirmer votre connexion à la plateforme VETRA, saisissez le code à usage unique ci-dessous :';

  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#123451;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dce5ed;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="background:#123451;padding:20px 24px;color:#ffffff;">
          <div style="font-size:18px;font-weight:700;letter-spacing:0.04em;">VETRA</div>
          <div style="font-size:12px;color:#cbd5e1;margin-top:4px;">ONSSA – DPA · Plateforme de reporting des services vétérinaires</div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <h1 style="margin:0 0 12px;font-size:18px;color:#123451;">${title}</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#334155;">${intro}</p>
          <div style="text-align:center;margin:20px 0;padding:16px;background:#f0f9f7;border:1px solid #b7e1d8;border-radius:10px;">
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:0.28em;color:#11816d;">${safeCode}</span>
          </div>
          <p style="margin:0 0 8px;font-size:13px;color:#475569;">Ce code est valable <strong>${safeExpiry}</strong> et utilisable une seule fois (5 tentatives maximum).</p>
          <p style="margin:0;font-size:12px;color:#64748b;">Si vous n’êtes pas à l’origine de cette demande, ignorez simplement ce message.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildAdminResetPasswordEmailHtml(
  temporaryPassword: string,
  recipientName?: string,
) {
  const safePassword = escapeHtml(temporaryPassword);
  const greeting = recipientName?.trim()
    ? `Bonjour ${escapeHtml(recipientName.trim())},`
    : 'Bonjour,';

  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#123451;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dce5ed;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="background:#123451;padding:20px 24px;color:#ffffff;">
          <div style="font-size:18px;font-weight:700;letter-spacing:0.04em;">VETRA</div>
          <div style="font-size:12px;color:#cbd5e1;margin-top:4px;">ONSSA – DPA · Plateforme de reporting des services vétérinaires</div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <h1 style="margin:0 0 12px;font-size:18px;color:#123451;">Votre nouveau mot de passe temporaire</h1>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#334155;">${greeting}</p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#334155;">L’administrateur national a réinitialisé l’accès à votre compte VETRA. Vous pouvez vous connecter immédiatement avec le mot de passe temporaire ci-dessous :</p>
          <div style="text-align:center;margin:20px 0;padding:16px;background:#f0f9f7;border:1px solid #b7e1d8;border-radius:10px;">
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:20px;font-weight:700;letter-spacing:0.06em;color:#11816d;word-break:break-all;">${safePassword}</span>
          </div>
          <p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:#475569;">Par mesure de sécurité, modifiez ce mot de passe dès votre première connexion depuis le menu <strong>Modifier mon mot de passe</strong>.</p>
          <p style="margin:0;font-size:12px;color:#64748b;">Si vous n’êtes pas à l’origine de cette demande, contactez immédiatement l’administrateur national.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildAdminResetNoticeHtml() {
  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#123451;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dce5ed;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="background:#123451;padding:20px 24px;color:#ffffff;">
          <div style="font-size:18px;font-weight:700;letter-spacing:0.04em;">VETRA</div>
          <div style="font-size:12px;color:#cbd5e1;margin-top:4px;">ONSSA – DPA · Plateforme de reporting des services vétérinaires</div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <h1 style="margin:0 0 12px;font-size:18px;color:#123451;">Mot de passe réinitialisé par l’administrateur</h1>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#334155;">L’administrateur national a réinitialisé le mot de passe de votre compte VETRA. Par mesure de sécurité, le nouveau mot de passe temporaire n’est pas transmis par e-mail.</p>
          <p style="margin:0;font-size:13px;line-height:1.55;color:#475569;">Rapprochez-vous de votre administrateur national pour le récupérer, puis modifiez-le dès votre connexion depuis le menu <strong>Modifier mon mot de passe</strong>.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function normalizeSmtpPassword(host: string, rawPass: string) {
  const trimmed = rawPass.trim();
  if (
    /gmail\.com$/i.test(host) &&
    /^[a-zA-Z]{4}(?: [a-zA-Z]{4}){3}$/.test(trimmed)
  ) {
    return trimmed.replace(/ /g, '');
  }
  return rawPass;
}

export async function email(
  to: string,
  subject: string,
  text: string,
  attachment?: { filename: string; content: Buffer },
  html?: string,
): Promise<{ provider: 'brevo' | 'resend' | 'smtp'; messageId?: string }> {
  if (!mailConfigured()) throw Error('Envoi d’e-mails non configuré');
  const bKey = brevoApiKey();
  const bFrom = brevoFrom();
  const key = apiKey();
  const fromResend = resendFrom();
  const hasResend = Boolean(key && fromResend);
  const hasSmtp = Boolean(smtpHostValue() && smtpSender());

  if (bKey && bFrom) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': bKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(12_000),
        body: JSON.stringify({
          sender: parseFromAddress(bFrom),
          to: [{ email: to }],
          subject,
          textContent: text,
          ...(html ? { htmlContent: html } : {}),
          ...(attachment
            ? {
                attachment: [
                  {
                    name: attachment.filename,
                    content: attachment.content.toString('base64'),
                  },
                ],
              }
            : {}),
        }),
      });
      if (!response.ok) {
        let detail = '';
        try {
          const body = (await response.json()) as {
            message?: string;
            code?: string;
          };
          detail = body?.message || body?.code || '';
        } catch {
          // Ignore unparseable error body
        }
        throw Error(
          `Envoi HTTPS refusé par Brevo (HTTP ${response.status})${detail ? ` : ${detail}` : ''}`,
        );
      }
      const result = (await response.json()) as { messageId?: string };
      return { provider: 'brevo', messageId: result.messageId };
    } catch (brevoError) {
      if (!hasResend && !hasSmtp) throw brevoError;
      console.error(
        'VETRA Brevo failed, falling back to next provider:',
        brevoError instanceof Error ? brevoError.message : 'unknown error',
      );
    }
  }

  if (hasResend && key && fromResend) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(12_000),
        body: JSON.stringify({
          from: fromResend,
          to: [to],
          subject,
          text,
          ...(html ? { html } : {}),
          attachments: attachment
            ? [
                {
                  filename: attachment.filename,
                  content: attachment.content.toString('base64'),
                },
              ]
            : undefined,
        }),
      });
      if (!response.ok) {
        let detail = '';
        try {
          const body = (await response.json()) as {
            message?: string;
            error?: string;
          };
          detail = body?.message || body?.error || '';
        } catch {
          // Ignore unparseable error body
        }
        throw Error(
          `Envoi HTTPS refusé par Resend (HTTP ${response.status})${detail ? ` : ${detail}` : ''}`,
        );
      }
      const result = (await response.json()) as { id?: string };
      if (!result.id) throw Error('Envoi non confirmé par Resend');
      return { provider: 'resend', messageId: result.id };
    } catch (resendError) {
      if (!hasSmtp) throw resendError;
      console.error(
        'VETRA Resend failed, falling back to SMTP:',
        resendError instanceof Error ? resendError.message : 'unknown error',
      );
    }
  }
  const smtpHost = smtpHostValue();
  const smtpUser = smtpUserValue();
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: smtpHost,
    port,
    secure: port === 465,
    auth: smtpUser
      ? {
          user: smtpUser,
          pass: normalizeSmtpPassword(smtpHost, process.env.SMTP_PASS || ''),
        }
      : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  const sent = await transport.sendMail({
    from: smtpSender(),
    to,
    subject,
    text,
    ...(html ? { html } : {}),
    attachments: attachment
      ? [{ ...attachment, contentType: 'application/pdf' }]
      : undefined,
  });
  if (!sent.accepted.length) throw Error('Destinataire refusé par SMTP');
  return { provider: 'smtp', messageId: sent.messageId };
}
