'use client';

import { Sigma } from 'lucide-react';
import ReportEmail from './ReportEmail';
import ReportShare from './ReportShare';

export default function ConsolidatedExportBar({
  year,
  month,
  monthLabel,
  scopeLabel,
  statusFilter,
  regionId = '',
  includedCount,
  totalServiceCount,
}: {
  year: number;
  month: number;
  monthLabel: string;
  scopeLabel: string;
  statusFilter: string;
  regionId?: string;
  includedCount: number;
  totalServiceCount: number;
}) {
  const effectiveStatus =
    statusFilter === 'NON INTRODUIT' ? null : statusFilter || 'TOUS';
  const canExport = Boolean(effectiveStatus) && includedCount > 0;

  const params = new URLSearchParams({
    scope: 'total',
    year: String(year),
    month: String(month),
    status: effectiveStatus || 'TOUS',
  });
  if (regionId) {
    params.set('regionId', regionId);
  }
  const query = params.toString();
  const xlsxUrl = `/api/export?${query}&type=xlsx`;
  const pdfUrl = `/api/export?${query}&type=pdf`;
  const emailEndpoint = `/api/export/email?${query}`;

  const statusQualifier =
    statusFilter === 'VALIDE'
      ? ' · Validés uniquement'
      : statusFilter === 'SOUMIS'
        ? ' · En validation uniquement'
        : '';

  const reportTitle = `Total consolidé ${month}/${year} · ${scopeLabel}${statusQualifier}`;

  return (
    <section
      className="vetra-consolidated-bar mb-4"
      aria-label="Exportation et envoi du rapport consolidé"
    >
      <div className="vetra-consolidated-info">
        <span className="vetra-consolidated-icon" aria-hidden="true">
          <Sigma size={19} />
        </span>
        <div className="vetra-consolidated-copy">
          <div className="vetra-consolidated-heading-row">
            <h3 className="vetra-consolidated-title">
              Total consolidé — Somme des services vétérinaires
            </h3>
            <span
              className={
                'vetra-consolidated-count' +
                (canExport ? ' is-ready' : ' is-empty')
              }
            >
              {includedCount}/{totalServiceCount}{' '}
              {includedCount > 1 ? 'rapports' : 'rapport'}
            </span>
          </div>
          <p className="vetra-consolidated-meta">
            {statusFilter === 'NON INTRODUIT' ? (
              <>
                <strong>{scopeLabel}</strong> · Aucun rapport saisi dans le
                filtre « Non introduits ». Sélectionnez « Tous », « Introduits
                », « En validation » ou « Validés » pour consolider.
              </>
            ) : includedCount === 0 ? (
              <>
                <strong>{scopeLabel}</strong> · Aucun rapport saisi pour{' '}
                {monthLabel} {year}
                {statusQualifier}.
              </>
            ) : (
              <>
                <strong>{scopeLabel}</strong> · {monthLabel} {year}
                {statusQualifier} · Somme des indicateurs de {includedCount}{' '}
                {includedCount > 1
                  ? 'services vétérinaires'
                  : 'service vétérinaire'}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="vetra-consolidated-actions">
        <span className="vetra-consolidated-actions-label">
          Exporter / envoyer le total
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {canExport ? (
            <a
              href={xlsxUrl}
              download
              title="Télécharger le total consolidé en Excel (XLSX)"
              aria-label="Télécharger le total consolidé en Excel (XLSX)"
              className="vetra-action-icon vetra-action-excel"
            >
              <img
                src="/icons/excel.png"
                alt=""
                width={22}
                height={22}
                className="vetra-brand-icon"
                referrerPolicy="no-referrer"
              />
            </a>
          ) : (
            <button
              type="button"
              disabled
              title="Aucun rapport saisi à télécharger"
              aria-label="Télécharger le total consolidé en Excel (XLSX)"
              className="vetra-action-icon vetra-action-excel"
            >
              <img
                src="/icons/excel.png"
                alt=""
                width={22}
                height={22}
                className="vetra-brand-icon"
                referrerPolicy="no-referrer"
              />
            </button>
          )}
          {canExport ? (
            <a
              href={pdfUrl}
              download
              title="Télécharger le total consolidé en PDF"
              aria-label="Télécharger le total consolidé en PDF"
              className="vetra-action-icon vetra-action-pdf"
            >
              <img
                src="/icons/acrobat.png"
                alt=""
                width={22}
                height={22}
                className="vetra-brand-icon"
                referrerPolicy="no-referrer"
              />
            </a>
          ) : (
            <button
              type="button"
              disabled
              title="Aucun rapport saisi à télécharger"
              aria-label="Télécharger le total consolidé en PDF"
              className="vetra-action-icon vetra-action-pdf"
            >
              <img
                src="/icons/acrobat.png"
                alt=""
                width={22}
                height={22}
                className="vetra-brand-icon"
                referrerPolicy="no-referrer"
              />
            </button>
          )}
          <ReportEmail
            endpoint={emailEndpoint}
            title={reportTitle}
            disabled={!canExport}
            ariaLabel="Envoyer le total consolidé par e-mail (PDF joint)"
          />
          <ReportShare
            url={pdfUrl}
            title={reportTitle}
            disabled={!canExport}
            ariaLabel="Partager le total consolidé via WhatsApp (PDF)"
          />
        </div>
      </div>
    </section>
  );
}
