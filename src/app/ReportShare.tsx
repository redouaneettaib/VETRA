'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';

export default function ReportShare({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fallback, setFallback] = useState(false);
  const message = `VETRA · ONSSA / DPA\n${title}`;
  async function prepare() {
    if (!navigator.share || !navigator.canShare) {
      setFallback(true);
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
      if (navigator.canShare({ files: [document] })) setFile(document);
      else setFallback(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Partage indisponible');
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title, text: message });
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'AbortError')
        setFallback(true);
    }
  }
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn green inline-flex items-center gap-2"
        disabled={busy}
        onClick={file && !fallback ? share : prepare}
      >
        <MessageCircle size={16} />
        {busy
          ? 'Préparation…'
          : file && !fallback
            ? 'Partager le PDF'
            : 'WhatsApp'}
      </button>
      {file && !fallback && (
        <p className="text-xs text-slate-600">
          Choisissez WhatsApp dans le menu de partage.
        </p>
      )}
      {fallback && (
        <div className="rounded-lg border bg-white p-3 text-sm space-y-2">
          <p>
            Téléchargez le PDF puis joignez-le à votre conversation WhatsApp.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={url} className="text-teal underline">
              Télécharger le PDF
            </a>
            <a
              href={'https://wa.me/?text=' + encodeURIComponent(message)}
              target="_blank"
              rel="noreferrer"
              className="text-teal underline"
            >
              Ouvrir WhatsApp
            </a>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-red-800 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
