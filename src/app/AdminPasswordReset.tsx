'use client';

import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  MailCheck,
  Send,
  ShieldCheck,
  Shuffle,
} from 'lucide-react';

interface ResetTarget {
  id: string;
  firstName: string;
  name: string;
  email: string;
  phone?: string;
}

interface DeliveryStatus {
  emailed: boolean;
  mailConfigured: boolean;
  emailError?: string;
}

type ApiCall = (path: string, data?: Record<string, unknown>) => Promise<any>;

function generateStrongPassword(length = 16) {
  const groups = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnopqrstuvwxyz',
    '23456789',
    '!@#$%&*-_',
  ];
  const all = groups.join('');
  const bytes = new Uint32Array(length);
  window.crypto.getRandomValues(bytes);
  const chars = groups.map(
    (group, index) => group[bytes[index] % group.length],
  );
  for (let i = groups.length; i < length; i++) {
    chars.push(all[bytes[i] % all.length]);
  }
  const shuffleBytes = new Uint32Array(chars.length);
  window.crypto.getRandomValues(shuffleBytes);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function DeliveryNotice({
  delivery,
  email,
  kind,
}: {
  delivery: DeliveryStatus;
  email: string;
  kind: 'code' | 'password';
}) {
  const itemLabel = kind === 'code' ? 'Le code' : 'Le mot de passe temporaire';
  if (delivery.emailed) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-white/90 px-3 py-2 text-xs text-emerald-900">
        <MailCheck size={16} className="text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          <strong>Envoyé automatiquement par e-mail</strong> à{' '}
          <span className="font-semibold">{email}</span>. Il reste également
          affiché ci-dessus pour référence.
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <AlertTriangle size={16} className="text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
      <span>
        {delivery.emailError
          ? `Envoi e-mail non confirmé (${delivery.emailError}). ${itemLabel} reste actif : vous pouvez le copier et le transmettre manuellement.`
          : delivery.mailConfigured
            ? `Envoi e-mail non effectué. ${itemLabel} reste actif : vous pouvez le copier et le transmettre manuellement.`
            : `Messagerie serveur non configurée (onglet Messagerie). ${itemLabel} reste actif : copiez-le pour le transmettre par téléphone ou WhatsApp.`}
      </span>
    </div>
  );
}

export default function AdminPasswordReset({
  user,
  api,
  onResolved,
  onCancel,
}: {
  user: ResetTarget;
  api: ApiCall;
  onDone?: (message: string) => void;
  onResolved?: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<'code' | 'password'>('code');
  const [generatedCode, setGeneratedCode] = useState('');
  const [codeExpiry, setCodeExpiry] = useState('');
  const [codeDelivery, setCodeDelivery] = useState<DeliveryStatus | null>(null);
  const [password, setPassword] = useState('');
  const [issuedPassword, setIssuedPassword] = useState('');
  const [passwordDelivery, setPasswordDelivery] =
    useState<DeliveryStatus | null>(null);
  const [reveal, setReveal] = useState(true);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function copyText(value: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(
        'Copie automatique bloquée par le navigateur. Copiez la valeur manuellement.',
      );
    }
  }

  async function generateResetCode() {
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      const result = await api('admin', {
        action: 'userGenerateResetCode',
        id: user.id,
        sendEmail: true,
      });
      setGeneratedCode(String(result.code || ''));
      setCodeExpiry(
        result.expiresAt
          ? new Date(result.expiresAt).toLocaleString('fr-FR')
          : '',
      );
      setCodeDelivery({
        emailed: Boolean(result.emailed),
        mailConfigured: Boolean(result.mailConfigured),
        emailError: result.emailError ? String(result.emailError) : undefined,
      });
      if (onResolved) await onResolved();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible de générer un code de réinitialisation.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError('');
    const trimmed = password.trim();
    if (trimmed.length > 0 && password.length < 12) {
      setError('Le mot de passe doit contenir au moins 12 caractères.');
      return;
    }
    setSaving(true);
    try {
      const result = await api('admin', {
        action: 'userResetPassword',
        id: user.id,
        ...(trimmed.length > 0 ? { password } : { generate: true }),
        sendEmail: true,
      });
      const finalPassword = String(result.password || password);
      setIssuedPassword(finalPassword);
      setPassword(finalPassword);
      setReveal(true);
      setPasswordDelivery({
        emailed: Boolean(result.emailed),
        mailConfigured: Boolean(result.mailConfigured),
        emailError: result.emailError ? String(result.emailError) : undefined,
      });
      if (onResolved) await onResolved();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible de réinitialiser le mot de passe.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="admin-reset-password-panel" className="panel space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="font-bold text-navy flex items-center gap-2">
            <KeyRound size={17} aria-hidden="true" />
            Réinitialisation d’accès utilisateur
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {user.firstName} {user.name} · {user.email}
            {user.phone ? ` · ${user.phone}` : ''}
          </p>
        </div>
        <button
          type="button"
          className="btn alt whitespace-nowrap shrink-0"
          disabled={saving}
          onClick={onCancel}
        >
          Fermer
        </button>
      </div>

      <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
        <button
          type="button"
          className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
            mode === 'code'
              ? 'bg-white text-navy shadow-sm'
              : 'text-slate-600 hover:text-navy'
          }`}
          disabled={saving}
          onClick={() => {
            setMode('code');
            setError('');
          }}
        >
          Code à 6 chiffres (recommandé)
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
            mode === 'password'
              ? 'bg-white text-navy shadow-sm'
              : 'text-slate-600 hover:text-navy'
          }`}
          disabled={saving}
          onClick={() => {
            setMode('password');
            setError('');
          }}
        >
          Mot de passe temporaire
        </button>
      </div>

      {mode === 'code' ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            En un clic, VETRA génère un code à usage unique (valable 24 heures),
            l’envoie automatiquement par e-mail à{' '}
            <strong>{user.email}</strong> et l’affiche ici pour l’administrateur.
          </p>

          {!generatedCode ? (
            <button
              type="button"
              className="btn green inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              disabled={saving}
              onClick={generateResetCode}
            >
              <Send size={15} aria-hidden="true" />
              {saving
                ? 'Génération et envoi…'
                : 'Générer et envoyer le code à 6 chiffres'}
            </button>
          ) : (
            <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="block text-xs font-semibold text-slate-600">
                    Code de réinitialisation à usage unique (affiché une seule fois)
                  </span>
                  <span className="mt-1 block font-mono text-3xl font-bold tracking-[0.25em] text-teal tabular-nums">
                    {generatedCode}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  onClick={() => copyText(generatedCode)}
                >
                  {copied ? (
                    <Check size={15} aria-hidden="true" />
                  ) : (
                    <Copy size={15} aria-hidden="true" />
                  )}
                  {copied ? 'Code copié' : 'Copier le code'}
                </button>
              </div>
              {codeDelivery && (
                <DeliveryNotice
                  delivery={codeDelivery}
                  email={user.email}
                  kind="code"
                />
              )}
              <p className="text-xs text-slate-600">
                Valable jusqu’au <strong>{codeExpiry || '24 heures'}</strong> · 5
                tentatives maximum · Demande clôturée automatiquement.
              </p>
            </div>
          )}
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submitReset}>
          <p className="text-sm text-slate-600">
            Laissez le champ vide pour que VETRA génère automatiquement un mot
            de passe robuste de 16 caractères (ou saisissez-en un manuellement),
            l’envoie par e-mail à <strong>{user.email}</strong> et l’affiche ici.
          </p>

          {issuedPassword ? (
            <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="block text-xs font-semibold text-slate-600">
                    Nouveau mot de passe temporaire actif (affiché une seule fois)
                  </span>
                  <span className="mt-1 block font-mono text-xl font-bold tracking-wide text-teal break-all">
                    {reveal ? issuedPassword : '••••••••••••••••'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="btn alt inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    onClick={() => setReveal((prev) => !prev)}
                    aria-label={
                      reveal
                        ? 'Masquer le mot de passe'
                        : 'Afficher le mot de passe'
                    }
                  >
                    {reveal ? (
                      <EyeOff size={15} aria-hidden="true" />
                    ) : (
                      <Eye size={15} aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    onClick={() => copyText(issuedPassword)}
                  >
                    {copied ? (
                      <Check size={15} aria-hidden="true" />
                    ) : (
                      <Copy size={15} aria-hidden="true" />
                    )}
                    {copied ? 'Mot de passe copié' : 'Copier'}
                  </button>
                </div>
              </div>
              {passwordDelivery && (
                <DeliveryNotice
                  delivery={passwordDelivery}
                  email={user.email}
                  kind="password"
                />
              )}
              <p className="text-xs text-slate-600">
                Demande clôturée automatiquement · L’utilisateur pourra le
                modifier depuis <strong>Modifier mon mot de passe</strong>.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <label className="field flex-1 min-w-[240px] text-sm font-medium">
                  Mot de passe temporaire (facultatif — généré automatiquement si vide)
                  <input
                    type={reveal ? 'text' : 'password'}
                    minLength={12}
                    autoComplete="new-password"
                    value={password}
                    disabled={saving}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Laisser vide pour génération automatique (16 car.)"
                  />
                </label>
                <button
                  type="button"
                  className="btn alt inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  disabled={saving}
                  onClick={() => {
                    setPassword(generateStrongPassword(16));
                    setReveal(true);
                    setError('');
                  }}
                >
                  <Shuffle size={15} aria-hidden="true" />
                  Pré-remplir
                </button>
                <button
                  type="button"
                  className="btn alt inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  disabled={saving || !password}
                  onClick={() => setReveal((prev) => !prev)}
                  aria-label={
                    reveal
                      ? 'Masquer le mot de passe'
                      : 'Afficher le mot de passe'
                  }
                >
                  {reveal ? (
                    <EyeOff size={15} aria-hidden="true" />
                  ) : (
                    <Eye size={15} aria-hidden="true" />
                  )}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="btn green inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                  disabled={saving}
                >
                  {password.trim() ? (
                    <ShieldCheck size={16} aria-hidden="true" />
                  ) : (
                    <Send size={15} aria-hidden="true" />
                  )}
                  {saving
                    ? 'Génération et envoi…'
                    : password.trim()
                      ? 'Enregistrer et envoyer par e-mail'
                      : 'Générer et envoyer un mot de passe'}
                </button>
                <button
                  type="button"
                  className="btn alt whitespace-nowrap shrink-0"
                  disabled={saving}
                  onClick={onCancel}
                >
                  Annuler
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {error && (
        <p
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
