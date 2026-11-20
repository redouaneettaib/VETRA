'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';

type Phase = 'login' | 'otp' | 'request' | 'reset';
type Submit = (
  path: string,
  data: Record<string, string>,
) => Promise<{ otpRequired?: boolean; cooldown?: boolean }>;
export default function LoginScreen({
  brand,
  submit,
  onLogin,
}: {
  brand: ReactNode;
  submit: Submit;
  onLogin: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<Phase>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (next: Phase) => {
    setPhase(next);
    setError('');
    setNotice('');
    setCode('');
    setPassword('');
    setConfirmation('');
  };
  async function proceed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('Veuillez saisir votre adresse e-mail professionnelle.');
      return;
    }
    if (phase === 'reset') {
      if (password.length < 12) {
        setError('Le nouveau mot de passe doit contenir au moins 12 caractères.');
        return;
      }
      if (password !== confirmation) {
        setError('Les mots de passe ne correspondent pas.');
        return;
      }
    }
    setBusy(true);
    try {
      if (phase === 'login') {
        const result = await submit('login', {
          email: normalizedEmail,
          password,
        });
        if (result.otpRequired) {
          update('otp');
          setNotice('Saisissez le code à six chiffres reçu par e-mail.');
        } else await onLogin();
      } else if (phase === 'otp') {
        await submit('otp/verify', {
          email: normalizedEmail,
          code: code.trim(),
        });
        await onLogin();
      } else if (phase === 'request') {
        await submit('password/request', {
          email: normalizedEmail,
        });
        update('reset');
        setNotice(
          'Si cette adresse correspond à un compte actif, un code de réinitialisation à six chiffres a été envoyé (valable 10 minutes).',
        );
      } else {
        await submit('password/reset', {
          email: normalizedEmail,
          code: code.trim(),
          password,
        });
        update('login');
        setNotice(
          'Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe.',
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Une erreur est survenue.',
      );
    } finally {
      setBusy(false);
    }
  }
  const heading = {
    login: 'Connexion à VETRA',
    otp: 'Vérification de votre identité',
    request: 'Mot de passe oublié',
    reset: 'Nouveau mot de passe',
  }[phase];
  const phaseHint = {
    login: '',
    otp: 'Entrez le code de vérification à 6 chiffres envoyé à votre adresse professionnelle.',
    request:
      'Saisissez votre e-mail professionnel pour recevoir un code de réinitialisation valable 10 minutes.',
    reset:
      'Saisissez le code reçu par e-mail puis définissez un nouveau mot de passe d’au moins 12 caractères.',
  }[phase];
  return (
    <main className="vetra-cover">
      <div className="vetra-cover-photo" aria-hidden="true">
        <div className="vetra-cover-mirror">
          <img
            src="/inspection-onssa-etiquetage.webp"
            width="1600"
            height="900"
            alt=""
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="vetra-cover-frame">
          <img
            src="/inspection-onssa-etiquetage.webp"
            width="1600"
            height="900"
            fetchPriority="high"
            alt=""
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
      <section
        className="vetra-cover-login"
        aria-labelledby="vetra-login-title"
      >
        {brand}
        <div>
          <h1 id="vetra-login-title" className="text-2xl font-bold text-navy">
            {heading}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Plateforme de reporting des services vétérinaires
          </p>
          {phaseHint && (
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              {phaseHint}
            </p>
          )}
        </div>
        {notice && (
          <p
            className="text-sm text-teal bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2"
            role="status"
          >
            {notice}
          </p>
        )}
        <form className="space-y-4" onSubmit={proceed}>
          <label className="field text-sm font-medium">
            E-mail professionnel
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              disabled={phase === 'otp' || busy}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {(phase === 'otp' || phase === 'reset') && (
            <label className="field text-sm font-medium">
              Code à six chiffres
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                disabled={busy}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                }
              />
            </label>
          )}
          {(phase === 'login' || phase === 'reset') && (
            <label className="field text-sm font-medium">
              {phase === 'reset'
                ? 'Nouveau mot de passe (12 caractères minimum)'
                : 'Mot de passe'}
              <input
                type="password"
                required
                autoComplete={
                  phase === 'reset' ? 'new-password' : 'current-password'
                }
                minLength={phase === 'reset' ? 12 : undefined}
                value={password}
                disabled={busy}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          )}
          {phase === 'reset' && (
            <label className="field text-sm font-medium">
              Confirmer le mot de passe
              <input
                type="password"
                required
                autoComplete="new-password"
                minLength={12}
                value={confirmation}
                disabled={busy}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
          )}
          {error && (
            <p
              className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
              role="alert"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            className="btn w-full inline-flex items-center justify-center gap-2"
            disabled={busy}
          >
            <ShieldCheck size={17} />
            {busy
              ? 'Veuillez patienter…'
              : {
                  login: 'Se connecter',
                  otp: 'Vérifier le code',
                  request: 'Envoyer un code',
                  reset: 'Enregistrer le mot de passe',
                }[phase]}
          </button>
        </form>
        <button
          type="button"
          className="text-sm text-teal hover:text-navy hover:underline font-semibold flex items-center gap-2 justify-self-start py-1 transition-colors"
          disabled={busy}
          onClick={() =>
            update(phase === 'login' || phase === 'reset' ? 'request' : 'login')
          }
        >
          {phase === 'login' ? (
            <>
              <KeyRound size={15} />
              Mot de passe oublié ?
            </>
          ) : phase === 'reset' ? (
            <>Demander un nouveau code</>
          ) : (
            <>
              <ArrowLeft size={15} />
              Retour à la connexion
            </>
          )}
        </button>
        {phase === 'request' && (
          <button
            type="button"
            disabled={busy}
            className="text-sm text-slate-600 hover:text-navy hover:underline font-medium flex items-center gap-2 justify-self-start transition-colors"
            onClick={() => update('reset')}
          >
            <KeyRound size={15} />
            J’ai déjà reçu un code
          </button>
        )}
        {phase === 'reset' && (
          <button
            type="button"
            disabled={busy}
            className="text-sm text-teal hover:text-navy hover:underline font-semibold flex items-center gap-2 justify-self-start transition-colors"
            onClick={() => update('login')}
          >
            <ArrowLeft size={15} />
            Retour à la connexion
          </button>
        )}
      </section>
    </main>
  );
}
