import {
  ClipboardList,
  BadgeCheck,
  Clock3,
  RotateCcw,
  BarChart3,
  MapPin,
  PieChart,
} from 'lucide-react';
import { format, months, type Analysis } from '@/lib/analytics';

const percent = (part: number, total: number) =>
  total ? Math.round((part / total) * 1000) / 10 : 0;
export default function ReportingOverview({
  analysis,
}: {
  analysis: Analysis;
}) {
  const {
    expected,
    validated,
    pending,
    correction,
    transmitted,
    regions,
    byMonth,
  } = analysis.operational;
  const remaining = Math.max(0, expected - transmitted);
  const segments = [
    { name: 'Validés', count: validated, color: '#15946f' },
    { name: 'En validation', count: pending, color: '#e4a321' },
    { name: 'À corriger ou resoumettre', count: correction, color: '#cf6351' },
    { name: 'Non transmis', count: remaining, color: '#dce5ed' },
  ];
  let accumulated = 0;
  const stops = segments.map((segment) => {
    const start = accumulated;
    accumulated += expected ? (segment.count / expected) * 100 : 0;
    return `${segment.color} ${start}% ${accumulated}%`;
  });
  const stats = [
    {
      name: 'Rapports attendus',
      value: format(expected),
      icon: ClipboardList,
      tone: 'blue',
    },
    {
      name: 'Rapports validés',
      value: format(validated),
      icon: BadgeCheck,
      tone: 'green',
    },
    {
      name: 'En validation',
      value: format(pending),
      icon: Clock3,
      tone: 'amber',
    },
    {
      name: 'À corriger ou resoumettre',
      value: format(correction),
      icon: RotateCcw,
      tone: 'rose',
    },
    {
      name: 'Taux de transmission',
      value: expected ? format(percent(transmitted, expected), true) : '—',
      icon: BarChart3,
      tone: 'violet',
    },
  ];
  const maximum = Math.max(1, ...byMonth.map((month) => month.count));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold text-navy">
          Suivi des rapports · {analysis.period}
        </h3>
        <span className="text-sm text-slate-600">
          {format(transmitted)} rapport(s) transmis sur {format(expected)}{' '}
          attendu(s)
        </span>
      </div>
      <div className="vetra-kpis">
        {stats.map(({ name, value, icon: Icon, tone }) => (
          <article key={name} className={`vetra-kpi vetra-kpi-${tone}`}>
            <span className="vetra-kpi-icon">
              <Icon size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xl font-bold tabular-nums">{value}</p>
              <p className="text-xs font-semibold">{name}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="vetra-overview-grid">
        <article className="panel space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <MapPin size={17} />
            Transmission par région
          </h4>
          {!regions.length && (
            <p className="text-sm text-slate-600">
              Aucune région dans ce périmètre.
            </p>
          )}
          <ul className="max-h-56 overflow-y-auto space-y-2">
            {regions.map((region) => (
              <li key={region.id} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span>{region.name}</span>
                  <span
                    className="font-semibold whitespace-nowrap"
                    title={`${region.transmitted} sur ${region.expected}`}
                  >
                    {format(percent(region.transmitted, region.expected), true)}
                  </span>
                </div>
                <div
                  className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-teal"
                    style={{
                      width: `${percent(region.transmitted, region.expected)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </article>
        <article className="panel space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <PieChart size={17} />
            État des rapports
          </h4>
          <div className="flex flex-wrap gap-4 items-center">
            <div
              className="vetra-donut"
              aria-hidden="true"
              style={{
                background: expected
                  ? `conic-gradient(${stops.join(',')})`
                  : '#dce5ed',
              }}
            >
              <span className="bg-white">
                <b>{format(expected)}</b>
                <small>attendus</small>
              </span>
            </div>
            <ul className="space-y-1.5 text-sm">
              {segments.map((item) => (
                <li key={item.name} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: item.color }}
                  />
                  <b>{item.count}</b>
                  {item.name}
                </li>
              ))}
            </ul>
          </div>
        </article>
        <article className="panel space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <BarChart3 size={17} />
            Rapports transmis par mois · {analysis.filters.year}
          </h4>
          <div className="overflow-x-auto">
            <div className="vetra-month-bars">
              {byMonth.map((month) => (
                <div
                  key={month.label}
                  className="vetra-month-bar"
                  title={`${month.label} : ${month.count}`}
                >
                  <span className="vetra-bar-track" aria-hidden="true">
                    <span
                      style={{ height: `${(month.count / maximum) * 100}%` }}
                    />
                  </span>
                  <b className="text-[10px] tabular-nums">{month.count}</b>
                  <abbr
                    className="text-[10px] no-underline"
                    title={month.label}
                  >
                    {month.label.slice(0, 3)}
                  </abbr>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>
      <article className="panel">
        <h4 className="font-semibold flex items-center gap-2 mb-3">
          <ClipboardList size={17} />
          Rapports à suivre ({analysis.operational.toReview.length})
        </h4>
        {analysis.operational.toReview.length === 0 ? (
          <p className="text-sm text-slate-600">
            Aucun rapport en attente de validation ou de correction sur cette
            période.
          </p>
        ) : (
          <div className="scroll max-h-64">
            <table>
              <thead>
                <tr>
                  <th>Région</th>
                  <th>Service vétérinaire</th>
                  <th>Mois</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {analysis.operational.toReview.map((item) => (
                  <tr key={item.serviceId + '-' + item.month}>
                    <td>{item.region}</td>
                    <td>{item.service}</td>
                    <td>{months[item.month - 1]}</td>
                    <td>
                      <span className={'badge ' + item.status}>
                        {item.status === 'SOUMIS'
                          ? 'En validation'
                          : item.status === 'REVOQUE'
                            ? 'À corriger'
                            : 'À resoumettre'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
      <p className="text-xs text-slate-600">
        La transmission est comptée au mois du rapport. Les chiffres détaillés
        par rubrique utilisent les rapports validés.
      </p>
    </div>
  );
}
