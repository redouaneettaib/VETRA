import nodemailer from 'nodemailer';

const apiKey = () => process.env.RESEND_API_KEY?.trim();
const resendFrom = () => process.env.RESEND_FROM?.trim();

export function mailConfigured() {
  return apiKey()
    ? Boolean(resendFrom())
    : Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export async function email(
  to: string,
  subject: string,
  text: string,
  attachment?: { filename: string; content: Buffer },
) {
  if (!mailConfigured()) throw Error('Envoi d’e-mails non configuré');
  const key = apiKey();
  if (key) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        from: resendFrom(),
        to: [to],
        subject,
        text,
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
    if (!response.ok)
      throw Error(`Envoi HTTPS refusé par Resend (HTTP ${response.status})`);
    const result = (await response.json()) as { id?: string };
    if (!result.id) throw Error('Envoi non confirmé par Resend');
    return;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
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
  const sent = await transport.sendMail({
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
