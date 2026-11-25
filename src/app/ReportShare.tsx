'use client';

import { useId, useRef, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';

export default function ReportShare({
  url,
  title,
  disabled = false,
  ariaLabel,
}: {
  url: string;
  title: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [cached, setCached] = useState<{ url: string; file: File } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const message = `VETRA · ONSSA / DPA\n${title}`;
  const currentFile = cached?.url === url ? cached.file : null;

  function openFallback(errMsg = '') {
    setError(errMsg);
    dialog.current?.showModal();
  }

  async function prepare() {
    if (disabled) return;
    if (!navigator.share || !navigator.canShare) {
      openFallback();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(url);
      if (!response.ok) throw Error('Le PDF n’a pas pu être préparé.');
      const filename =
        response.headers
          .get('Content-Disposition')
          ?.match(/filename="([^"]+)"/)?.[1] ?? 'VETRA.pdf';
      const document = new File([await response.blob()], filename, {
        type: 'application/pdf',
      });
      if (navigator.canShare({ files: [document] })) {
        setCached({ url, file: document });
        try {
          await navigator.share({ files: [document], title, text: message });
        } catch (shareErr) {
          if (!(shareErr instanceof Error) || shareErr.name !== 'AbortError') {
            openFallback();
          }
        }
      } else {
        openFallback();
      }
    } catch (cause) {
      openFallback(
        cause instanceof Error ? cause.message : 'Partage indisponible',
      );
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (disabled || !currentFile) return;
    try {
      await navigator.share({ files: [currentFile], title, text: message });
    } catch (cause) {
      if (!(cause instanceof Error) || cause.name !== 'AbortError') {
        openFallback();
      }
    }
  }

  const label = busy
    ? 'Préparation du partage WhatsApp…'
    : ariaLabel || 'Partager le PDF via WhatsApp';

  return (
    <>
      <button
        type="button"
        className="vetra-action-icon vetra-action-whatsapp"
        title={disabled ? 'Aucun rapport saisi à partager' : label}
        aria-label={label}
        disabled={disabled || busy}
        onClick={currentFile ? share : prepare}
      >
        <img
          src="/icons/whatsapp.png"
          alt=""
          width={22}
          height={22}
          className={`vetra-brand-icon${busy ? ' animate-pulse' : ''}`}
          referrerPolicy="no-referrer"
        />
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="vetra-mail-dialog"
      >
        <div className="space-y-4">
          <h2 id={titleId} className="text-xl font-semibold text-navy">
            Partager via WhatsApp
          </h2>
          <p className="text-sm text-slate-600">
            <strong className="text-navy">{title}</strong> — Téléchargez le PDF puis joignez-le à votre conversation WhatsApp.
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <a
              href={url}
              className="btn alt inline-flex items-center gap-2 text-sm"
            >
              <Download size={15} aria-hidden="true" />
              Télécharger le PDF
            </a>
            <a
              href={'https://wa.me/?text=' + encodeURIComponent(message)}
              target="_blank"
              rel="noreferrer"
              className="btn green inline-flex items-center gap-2 text-sm"
            >
              <ExternalLink size={15} aria-hidden="true" />
              Ouvrir WhatsApp
            </a>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="btn alt text-sm"
              onClick={() => dialog.current?.close()}
            >
              Fermer
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
