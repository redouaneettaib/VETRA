import {
  ArrowRight,
  BellRing,
  Clock3,
  FilePenLine,
  RotateCcw,
  ClipboardCheck,
  KeyRound,
} from 'lucide-react';
import type { PendingResetRequest } from './AdminResetRequests';

const statuses = [
  { id: 'SOUMIS', label: 'En attente de validation', Icon: Clock3 },
  { id: 'REVOQUE', label: 'À corriger', Icon: RotateCcw },
  { id: 'CORRIGE', label: 'À resoumettre', Icon: ClipboardCheck },
  { id: 'BROUILLON', label: 'Brouillons', Icon: FilePenLine },
];

export default function ReportNotifications({
  statusesToReview,
  month,
  year,
  onOpen,
  isAdmin = false,
  resetRequests = [],
  onOpenResetRequests,
}: {
  statusesToReview: string[];
  month: number;
  year: number;
  onOpen: () => void;
  isAdmin?: boolean;
  resetRequests?: PendingResetRequest[];
  onOpenResetRequests?: (userId?: string) => void;
}) {
  const reportCount = statusesToReview.length;
  const resetCount = isAdmin ? resetRequests.length : 0;
  const totalCount = reportCount + resetCount;

  const summaryLabel = isAdmin
    ? `${totalCount} notifications (${resetCount} demande${resetCount === 1 ? '' : 's'} de mot de passe, ${reportCount} rapport${reportCount === 1 ? '' : 's'} non validé${reportCount === 1 ? '' : 's'})`
    : `${reportCount} rapports non validés pour la période`;

  const hasAlerts = totalCount > 0;

  return (
    <details
      className={`vetra-notifications${hasAlerts ? ' has-alerts' : ''}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && event.currentTarget.open) {
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }
      }}
    >
      <summary aria-label={summaryLabel} title={summaryLabel}>
        <BellRing
          size={21}
          strokeWidth={2.1}
          className="vetra-bell-icon"
          aria-hidden="true"
        />
        <span
          className={`vetra-notification-count${hasAlerts ? ' has-alerts' : ''}`}
          aria-hidden="true"
        >
          {totalCount > 99 ? '99+' : totalCount}
        </span>
      </summary>
      <div className="vetra-notification-menu">
        {isAdmin && (
          <div className="border-b border-slate-200 bg-amber-50/50">
            <div className="px-4 pt-4 pb-2.5 flex items-center justify-between gap-2">
              <div>
                <p className="font-bold text-navy flex items-center gap-1.5 text-sm">
                  <KeyRound
                    size={15}
                    className="text-amber-700 shrink-0"
                    aria-hidden="true"
                  />
                  Réinitialisations MDP
                </p>
                <p className="text-xs text-slate-600">
                  {resetCount
                    ? `${resetCount} demande${resetCount === 1 ? '' : 's'} en attente`
                    : 'Aucune demande en attente'}
                </p>
              </div>
              {resetCount > 0 && (
                <span className="rounded-full bg-amber-600 text-white text-xs font-bold px-2 py-0.5 tabular-nums">
                  {resetCount}
                </span>
              )}
            </div>
            {resetCount > 0 && (
              <>
                <ul className="px-3 pb-2 space-y-1 max-h-48 overflow-y-auto">
                  {resetRequests.slice(0, 5).map((req) => (
                    <li key={req.id}>
                      <button
                        type="button"
                        className="w-full text-left rounded-lg px-2.5 py-2 hover:bg-amber-100/70 transition-colors"
                        onClick={(event) => {
                          const details = event.currentTarget.closest('details');
                          if (details) details.open = false;
                          onOpenResetRequests?.(req.userId);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-navy truncate">
                            {req.firstName} {req.name}
                          </span>
                          <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                            {new Date(req.createdAt).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 truncate">
                          {req.email}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="border-t border-amber-200/80 w-full flex justify-between items-center px-4 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100/60 transition-colors"
                  onClick={(event) => {
                    const details = event.currentTarget.closest('details');
                    if (details) details.open = false;
                    onOpenResetRequests?.();
                  }}
                >
                  Traiter les demandes{' '}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        )}
        <div className="px-4 pt-4 pb-3 border-b border-slate-100">
          <p className="font-bold text-navy text-sm">Suivi des rapports</p>
          <p className="text-xs text-slate-600">
            {String(month).padStart(2, '0')}/{year} · {reportCount} non validé
            {reportCount === 1 ? '' : 's'}
          </p>
        </div>
        {reportCount ? (
          <ul className="px-4 py-2">
            {statuses.map(({ id, label, Icon }) => {
              const amount = statusesToReview.filter(
                (status) => status === id,
              ).length;
              return amount ? (
                <li key={id} className="flex items-center gap-2 py-2 text-sm">
                  <Icon size={16} className="text-teal" aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  <strong className="tabular-nums">{amount}</strong>
                </li>
              ) : null;
            })}
          </ul>
        ) : (
          <p className="px-4 py-3 text-sm text-slate-600">
            Aucun rapport non validé pour cette période.
          </p>
        )}
        <button
          type="button"
          className="border-t border-slate-100 w-full flex justify-between items-center p-4 text-sm font-semibold text-teal hover:bg-slate-50"
          onClick={(event) => {
            const details = event.currentTarget.closest('details');
            if (details) details.open = false;
            onOpen();
          }}
        >
          Voir les rapports non validés{' '}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </details>
  );
}
