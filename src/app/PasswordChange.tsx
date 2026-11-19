'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';

export default function PasswordChange({
  submit,
  onSaved,
}: {
  submit: (path: string, data: Record<string, string>) => Promise<unknown>;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function change(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const currentPassword = String(values.get('currentPassword') ?? '');
    const password = String(values.get('password') ?? '');
    if (password !== values.get('confirmation')) {
      setError('Les nouveaux mots de passe ne correspondent pas.');
      return;
    }
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await submit('password/change', { currentPassword, password });
      form.reset();
      dialog.current?.close();
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Le mot de passe n’a pas pu être modifié.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="mt-3 w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-white hover:bg-white/10 rounded-lg"
        onClick={() => {
          setError('');
          dialog.current?.showModal();
        }}
      >
        <KeyRound size={16} aria-hidden="true" /> Modifier mon mot de passe
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={heading}
        className="vetra-mail-dialog"
        onCancel={(event) => {
          if (pending.current) event.preventDefault();
        }}
        onClose={() => dialog.current?.querySelector('form')?.reset()}
      >
        <form className="space-y-4" onSubmit={change}>
          <h2 id={heading} className="font-bold text-xl">
            Modifier mon mot de passe
          </h2>
          <label className="field">
            Mot de passe actuel
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              disabled={busy}
            />
          </label>
          <label className="field">
            Nouveau mot de passe (12 caractères minimum)
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              disabled={busy}
            />
          </label>
          <label className="field">
            Confirmer le nouveau mot de passe
            <input
              name="confirmation"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              disabled={busy}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn alt"
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              Annuler
            </button>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
