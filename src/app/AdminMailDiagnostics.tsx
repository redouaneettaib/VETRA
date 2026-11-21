'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Mail, RefreshCw, Send } from 'lucide-react';

interface MailStatusResponse {
  configured: boolean;
  provider: 'resend' | 'smtp' | 'none';
  from: string;
  host?: string;
  port?: number;
  authenticated?: boolean;
  sandboxSender: boolean;
  missing: string[];
}

type ApiCall = (path: string, data?: Record<string, unknown>) => Promise<any>;

export default function AdminMailDiagnostics({
  api,
  defaultRecipient,
}: {
  api: ApiCall;
  defaultRecipient?: string;
}) {
  const [status, setStatus] = useState<MailStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [recipient, setRecipient] = useState(defaultRecipient || '');
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  async function refreshStatus() {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api('admin/mail-status');
      setStatus(data);
    } catch (cause) {
      setLoadError(
        cause instanceof Error
          ? cause.message
          : 'Impossible de lire l’état de la messagerie.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  async function sendTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setTestResult(null);
    try {
      const result = await api('admin', {
        action: 'mailTest',
        recipient: recipient.trim(),
      });
      setTestResult({
        ok: true,
        message: `E-mail de test accepté par ${result.provider === 'resend' ? 'Resend HTTPS' : 'SMTP'} depuis ${result.from}${result.messageId ? ` (réf. ${result.messageId})` : ''}. Vérifiez la boîte de réception et les indésirables.`,
      });
    } catch (cause) {
      setTestResult({
        ok: false,
        message:
          cause instanceof Error
            ? cause.message
            : 'Le test d’envoi a échoué.',
      });
    } finally {
      setSending(false);
    }
  }

  const providerLabel = !status
    ? '—'
    : status.provider === 'resend'
      ? 'Resend (HTTPS)'
      : status.provider === 'smtp'
        ? 'SMTP'
        : 'Non configuré';

  return (
    <div className="panel space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-bold text-navy flex items-center gap-2">
            <Mail size={18} aria-hidden="true" />
            Diagnostic de la messagerie (OTP et réinitialisation)
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Vérifiez le fournisseur actif et testez la délivrabilité réelle des
            codes de vérification.
          </p>
        </div>
        <button
          type="button"
          className="btn alt inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          disabled={loading}
          onClick={refreshStatus}
        >
          <RefreshCw size={15} aria-hidden="true" />
          Actualiser
        </button>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">
          Vérification de la configuration serveur…
        </p>
      )}

      {loadError && (
        <p
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
          role="alert"
        >
          {loadError}
        </p>
      )}

      {!loading && status && (
        <>
          <div className="grid md:grid-cols-3 gap-4 border-b border-slate-200 pb-4 text-sm">
            <div>
              <span className="block text-xs font-semibold text-slate-500">
                Fournisseur actif
              </span>
              <span className="mt-1 inline-flex items-center gap-1.5 font-semibold text-navy">
                {status.configured ? (
                  <CheckCircle2
                    size={15}
                    className="text-teal shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <AlertTriangle
                    size={15}
                    className="text-amber-600 shrink-0"
                    aria-hidden="true"
                  />
                )}
                {providerLabel}
              </span>
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500">
                Adresse d’expédition
              </span>
              <span className="mt-1 block font-medium text-navy break-all">
                {status.from || 'Aucune adresse définie'}
              </span>
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500">
                Détails transport
              </span>
              <span className="mt-1 block text-slate-700 tabular-nums">
                {status.provider === 'smtp'
                  ? `${status.host} · port ${status.port} · ${status.authenticated ? 'authentifié' : 'sans auth'}`
                  : status.provider === 'resend'
                    ? 'API HTTPS api.resend.com'
                    : status.missing.join(', ')}
              </span>
            </div>
          </div>

          {status.sandboxSender && (
            <div
              className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3"
              role="note"
            >
              <strong>Domaine de test Resend détecté ({status.from}) :</strong>{' '}
              Resend limite l’expéditeur <code>onboarding@resend.dev</code> à la
              seule adresse propriétaire du compte Resend. Pour que tous les
              services vétérinaires reçoivent leurs codes de réinitialisation,
              vérifiez votre domaine dans Resend puis mettez à jour la variable{' '}
              <code>RESEND_FROM</code>.
            </div>
          )}

          {!status.configured && (
            <div
              className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-2"
              role="note"
            >
              <p className="font-semibold text-navy">
                Variables d’environnement serveur à renseigner sur votre
                hébergeur (Railway / Vercel) :
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Option Resend (recommandée sur Railway) :{' '}
                <code>RESEND_API_KEY</code> et <code>RESEND_FROM</code>.
                <br />
                Option SMTP : <code>SMTP_HOST</code>, <code>SMTP_FROM</code>,{' '}
                <code>SMTP_PORT</code>, <code>SMTP_USER</code> et{' '}
                <code>SMTP_PASS</code>.
              </p>
              <p className="text-xs text-slate-600">
                En attendant la configuration, vous pouvez réinitialiser
                directement le mot de passe de n’importe quel utilisateur depuis
                l’onglet <strong>Comptes utilisateurs</strong>.
              </p>
            </div>
          )}

          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={sendTest}
          >
            <label className="field flex-1 min-w-[240px] text-sm font-medium">
              Envoyer un e-mail de test vers
              <input
                type="email"
                required
                placeholder="prenom.nom@onssa.gov.ma"
                value={recipient}
                disabled={sending}
                onChange={(event) => setRecipient(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="btn green inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              disabled={sending || !status.configured}
            >
              <Send size={15} aria-hidden="true" />
              {sending ? 'Envoi en cours…' : 'Envoyer un test'}
            </button>
          </form>

          {testResult && (
            <p
              role={testResult.ok ? 'status' : 'alert'}
              className={
                testResult.ok
                  ? 'text-sm text-teal bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2'
                  : 'text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2'
              }
            >
              {testResult.message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
