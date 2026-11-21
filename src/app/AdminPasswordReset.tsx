'use client';

import { useState, type FormEvent } from 'react';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
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

export default function AdminPasswordReset({
  user,
  api,
  onDone,
  onResolved,
  onCancel,
}: {
  user: ResetTarget;
  api: ApiCall;
  onDone: (message: string) => void;
  onResolved?: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<'code' | 'password'>('code');
  const [generatedCode, setGeneratedCode] = useState('');
  const [codeExpiry, setCodeExpiry] = useState('');
  const [password, setPassword] = useState('');
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
      });
      setGeneratedCode(String(result.code || ''));
      setCodeExpiry(
        result.expiresAt
          ? new Date(result.expiresAt).toLocaleString('fr-FR')
          : '',
      );
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
    if (password.length < 12) {
      setError('Le mot de passe doit contenir au moins 12 caractères.');
      return;
    }
    setSaving(true);
    try {
      await api('admin', {
        action: 'userResetPassword',
        id: user.id,
        password,
      });
      if (onResolved) await onResolved();
      onDone(
        `Mot de passe réinitialisé pour ${user.firstName} ${user.name}. Communiquez-le à l’utilisateur par un canal sûr.`,
      );
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
            Réinitialisation d’accès sans messagerie
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
          Mot de passe direct
        </button>
      </div>

      {mode === 'code' ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Générez un code à usage unique valable 24 heures, puis transmettez-le
            à l’utilisateur (téléphone / WhatsApp). Il choisira lui-même son
            nouveau mot de passe depuis <strong>Mot de passe oublié ? → J’ai reçu un code à 6 chiffres</strong>.
          </p>

          {!generatedCode ? (
            <button
              type="button"
              className="btn green inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              disabled={saving}
              onClick={generateResetCode}
            >
              <ShieldCheck size={16} aria-hidden="true" />
              {saving ? 'Génération…' : 'Générer un code à 6 chiffres'}
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
              <p className="text-xs text-slate-600">
                Valable jusqu’au <strong>{codeExpiry || '24 heures'}</strong> · 5 tentatives maximum · Demande clôturée automatiquement.
              </p>
            </div>
          )}
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submitReset}>
          <p className="text-sm text-slate-600">
            Définissez immédiatement un mot de passe temporaire et transmettez-le
            à l’utilisateur. Il pourra ensuite le changer depuis son menu{' '}
            <strong>Modifier mon mot de passe</strong>.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="field flex-1 min-w-[240px] text-sm font-medium">
              Nouveau mot de passe temporaire (12 caractères min.)
              <input
                type={reveal ? 'text' : 'password'}
                required
                minLength={12}
                autoComplete="new-password"
                value={password}
                disabled={saving}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Saisissez ou générez un mot de passe robuste"
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
              Générer
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
            <button
              type="button"
              className="btn alt inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              disabled={saving || !password}
              onClick={() => copyText(password)}
            >
              {copied ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Copy size={15} aria-hidden="true" />
              )}
              {copied ? 'Copié' : 'Copier'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="btn green whitespace-nowrap shrink-0"
              disabled={saving}
            >
              {saving
                ? 'Enregistrement…'
                : 'Enregistrer le nouveau mot de passe'}
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
