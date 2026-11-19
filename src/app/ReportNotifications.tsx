import {
  ArrowRight,
  BellRing,
  Clock3,
  FilePenLine,
  RotateCcw,
  ClipboardCheck,
} from 'lucide-react';

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
}: {
  statusesToReview: string[];
  month: number;
  year: number;
  onOpen: () => void;
}) {
  const count = statusesToReview.length;
  return (
    <details
      className="vetra-notifications"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && event.currentTarget.open) {
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }
      }}
    >
      <summary aria-label={`${count} rapports non validés pour la période`}>
        <BellRing size={21} aria-hidden="true" />
        <span className="vetra-notification-count" aria-hidden="true">
          {count > 99 ? '99+' : count}
        </span>
      </summary>
      <div className="vetra-notification-menu">
        <div className="px-4 pt-4 pb-3 border-b border-slate-100">
          <p className="font-bold text-navy">Suivi des rapports</p>
          <p className="text-sm text-slate-600">
            {String(month).padStart(2, '0')}/{year} · {count} non validé
            {count === 1 ? '' : 's'}
          </p>
        </div>
        {count ? (
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
