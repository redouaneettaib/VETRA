'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { Paperclip } from 'lucide-react';

export default function ReportEmail({
  endpoint,
  title,
}: {
  endpoint: string;
  title: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const titleId = useId();
  const [recipient, setRecipient] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: recipient.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'L’envoi a échoué.');
      setSent(recipient.trim());
      dialog.current?.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'L’envoi a échoué.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="vetra-action-icon vetra-action-email"
        title={sent ? `Envoyé à ${sent}` : 'Envoyer par e-mail (PDF joint)'}
        aria-label="Envoyer par e-mail (PDF joint)"
        onClick={() => {
          setRecipient('');
          setSent('');
          setError('');
          dialog.current?.showModal();
        }}
      >
        <img
          src="/icons/email.png"
          alt=""
          width={22}
          height={22}
          className="vetra-brand-icon"
          referrerPolicy="no-referrer"
        />
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="vetra-mail-dialog"
        onCancel={(event) => {
          if (pending.current) event.preventDefault();
        }}
      >
        <form onSubmit={submit} className="space-y-4">
          <h2 id={titleId} className="text-xl font-semibold">
            Envoyer le rapport
          </h2>
          <div className="flex items-start gap-2 rounded-lg bg-slate-100 p-3 text-sm">
            <Paperclip className="shrink-0" size={17} />{' '}
            <span>{title} · PDF joint automatiquement</span>
          </div>
          <label className="grid gap-1 text-sm font-medium">
            Adresse e-mail du destinataire
            <input
              type="email"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              disabled={busy}
              maxLength={254}
              placeholder="nom@domaine.ma"
              required
              autoFocus
            />
          </label>
          {error && (
            <p className="text-sm text-red-700" role="alert">
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
              {busy ? 'Envoi en cours…' : 'Envoyer le PDF'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
