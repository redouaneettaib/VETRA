'use client';

import { useEffect, useId, useState } from 'react';
import {
  Activity,
  CalendarDays,
  Check,
  Copy,
  FileSpreadsheet,
  FileText,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  format,
  months,
  rubricLabels,
  type Analysis,
  type Filters,
  type Service,
} from '@/lib/analytics';
import ReportShare from './ReportShare';
import ReportEmail from './ReportEmail';
import ReportingOverview from './ReportingOverview';
import RubricIcon from './RubricIcon';

const palette = [
  '#027e77',
  '#2455b5',
  '#ad5809',
  '#8840a4',
  '#be3254',
  '#4b7207',
  '#456480',
  '#6552c1',
  '#a5381e',
  '#036784',
];
const colorFor = (index: number) => palette[index % palette.length];
const periodName = (label: string, monthly: boolean) =>
  monthly ? label.slice(0, 3) : label;
function Trend({ analysis }: { analysis: Analysis }) {
  const titleId = useId();
  const [focus, setFocus] = useState<number | null>(null);
  const { results, periods, metric, indicators, filters } = analysis;
  const field = indicators.find((item) => item.id === metric);
  const values = results.flatMap((result) =>
    result.trend.flatMap((point) => point.values[metric] ?? []),
  );
  if (!field || !values.length)
    return (
      <p className="py-8 text-slate-600">
        Aucune donnée validée pour tracer cette évolution.
      </p>
    );
  const maxValue = Math.max(0, ...values);
  const tick = Math.pow(10, Math.floor(Math.log10(maxValue / 4 || 1)));
  const step = Math.ceil(maxValue / 4 / tick) * tick || 1;
  const max = field.percent ? 100 : step * 4;
  const left = 83,
    top = 21,
    plotWidth = 710,
    height = 220;
  const x = (index: number) =>
    left + (plotWidth * index) / Math.max(1, periods.length - 1);
  const y = (value: number) => top + height - (height * value) / max;
  return (
    <>
      <div className="overflow-x-auto">
        <svg
          className="min-w-[600px] w-full"
          viewBox="0 0 822 276"
          role="img"
          aria-labelledby={titleId}
        >
          <title id={titleId}>
            {field.label} · évolution{' '}
            {filters.trend === 'months' ? 'mensuelle' : 'annuelle'}
          </title>
          {[0, 1, 2, 3, 4].map((grid) => (
            <g key={grid}>
              <line
                x1={left}
                x2={left + plotWidth}
                y1={y((max * grid) / 4)}
                y2={y((max * grid) / 4)}
                stroke="#dbe5ea"
              />
              <text
                x={left - 9}
                y={y((max * grid) / 4) + 4}
                textAnchor="end"
                fill="#425a70"
                fontSize={11}
              >
                {new Intl.NumberFormat('fr-FR', {
                  notation: max >= 1e6 ? 'compact' : 'standard',
                  maximumFractionDigits: 3,
                }).format((max * grid) / 4)}
                {field.percent ? ' %' : ''}
              </text>
            </g>
          ))}
          {focus !== null && focus < periods.length && (
            <line
              x1={x(focus)}
              x2={x(focus)}
              y1={top}
              y2={top + height}
              stroke="#94a3b8"
              strokeDasharray="4 4"
            />
          )}
          {periods.map((period, index) => (
            <text
              key={period.label}
              x={x(index)}
              y={top + height + 21}
              textAnchor="middle"
              fontSize={11}
              fill="#425a70"
            >
              {periodName(period.label, filters.trend === 'months')}
            </text>
          ))}
          {results.map((result, series) =>
            result.trend.map((point, index) => {
              const current = point.values[metric],
                previous = index
                  ? result.trend[index - 1].values[metric]
                  : null;
              if (current == null) return null;
              return (
                <g
                  key={result.id + '-' + index}
                  onPointerEnter={() => setFocus(index)}
                >
                  {previous != null && (
                    <line
                      x1={x(index - 1)}
                      y1={y(previous)}
                      x2={x(index)}
                      y2={y(current)}
                      stroke={colorFor(series)}
                      strokeWidth="2.5"
                      strokeDasharray={
                        series >= palette.length ? '5 3' : undefined
                      }
                    />
                  )}
                  <circle
                    cx={x(index)}
                    cy={y(current)}
                    r={focus === index ? 5.5 : 3.5}
                    fill={colorFor(series)}
                    stroke="white"
                  >
                    <title>
                      {result.name} · {periods[index].label} ·{' '}
                      {format(current, field.percent)}
                    </title>
                  </circle>
                </g>
              );
            }),
          )}
        </svg>
      </div>
      <ul className="flex flex-wrap gap-3 text-sm">
        {results.map((group, index) => (
          <li className="flex items-center gap-2" key={group.id}>
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: colorFor(index) }}
            />
            {group.name}
          </li>
        ))}
      </ul>
      <details className="border-t pt-3 mt-4">
        <summary className="cursor-pointer font-medium text-teal">
          Consulter les valeurs de la courbe
        </summary>
        <div className="scroll mt-3">
          <table>
            <thead>
              <tr>
                <th>Période</th>
                {results.map((group) => (
                  <th key={group.id}>{group.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((period, index) => (
                <tr key={period.label}>
                  <th scope="row">{period.label}</th>
                  {results.map((group) => (
                    <td key={group.id}>
                      {format(group.trend[index].values[metric], field.percent)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

export default function Reporting({
  services,
  initialYear,
  initialMonth,
  isCentralDirector = false,
}: {
  services: Service[];
  initialYear: number;
  initialMonth: number;
  isCentralDirector?: boolean;
}) {
  const [filters, setFilters] = useState<Filters>({
    year: initialYear,
    month: initialMonth,
    mode: 'month',
    trend: 'months',
    span: 5,
    group: 'all',
    ids: [],
    rubrics: [],
    metric: '',
  });
  const [yearInput, setYearInput] = useState(String(initialYear));
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    key: string;
    analysis: Analysis;
  } | null>(null);
  const [metricSearch, setMetricSearch] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiCopied, setAiCopied] = useState(false);
  const [aiSummary, setAiSummary] = useState<{
    key: string;
    titre: string;
    synthese: string;
    faitsMarquants: string[];
    pointsVigilance: string[];
    recommandations: string[];
    periodLabel: string;
  } | null>(null);
  const update = (changes: Partial<Filters>) =>
    setFilters((current) => ({ ...current, ...changes }));
  const catalog =
    filters.group === 'region'
      ? [
          ...new Map(
            services.map((service) => [service.region.id, service.region]),
          ).values(),
        ]
      : services.map((service) => ({
          id: service.id,
          name: service.name + ' · ' + service.region.name,
        }));
  const params = new URLSearchParams({
    year: String(filters.year),
    month: String(filters.month),
    mode: filters.mode,
    group: filters.group,
    trend: filters.trend,
    span: String(filters.span),
  });
  filters.ids.forEach((id) => params.append('id', id));
  filters.rubrics.forEach((id) => params.append('rubric', id));
  const key = params.toString();
  const canQuery = filters.group === 'all' || filters.ids.length > 0;
  useEffect(() => {
    setError('');
    if (!canQuery) return;
    const controller = new AbortController();
    fetch('/api/analytics?' + key, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok)
          throw Error(payload.error || 'Impossible de charger le reporting.');
        if (!controller.signal.aborted) setResult({ key, analysis: payload });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [key, canQuery]);
  const found = canQuery && result?.key === key ? result.analysis : null;
  const analysis = found
    ? {
        ...found,
        metric: found.indicators.some((item) => item.id === filters.metric)
          ? filters.metric
          : found.metric,
      }
    : null;
  const exportUrl = (type: string) =>
    '/api/analytics/export?' +
    key +
    '&type=' +
    type +
    '&metric=' +
    encodeURIComponent(analysis?.metric ?? '');
  const selectedMetric = analysis?.indicators.find(
    (item) => item.id === analysis.metric,
  );
  const toggle = (values: string[], id: string) =>
    values.includes(id)
      ? values.filter((item) => item !== id)
      : [...values, id];
  return (
    <section className="space-y-5">
      <div className="rounded-2xl bg-navy text-white px-5 py-6 md:px-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">
            Analyse des activités vétérinaires
          </h2>
          <p className="mt-2 text-blue-100">
            Rapports validés dans votre périmètre
          </p>
        </div>
        {analysis && (
          <div className="flex flex-wrap items-start gap-2">
            <a
              className="vetra-action-icon text-emerald-800 bg-emerald-50"
              href={exportUrl('xlsx')}
              aria-label="Télécharger en Excel (XLSX)"
              title="Télécharger en Excel (XLSX)"
            >
              <FileSpreadsheet size={19} aria-hidden="true" />
            </a>
            <a
              className="vetra-action-icon text-rose-800 bg-rose-50"
              href={exportUrl('pdf')}
              aria-label="Télécharger en PDF"
              title="Télécharger en PDF"
            >
              <FileText size={19} aria-hidden="true" />
            </a>
            <div className="text-navy">
              <ReportEmail
                key={'email-' + exportUrl('pdf')}
                endpoint={exportUrl('pdf').replace(
                  '/api/analytics/export?',
                  '/api/analytics/email?',
                )}
                title={`Reporting ${analysis.period}`}
              />
            </div>
            <div className="text-navy">
              <ReportShare
                key={exportUrl('pdf')}
                url={exportUrl('pdf')}
                title={`Reporting ${analysis.period}`}
              />
            </div>
          </div>
        )}
      </div>
      <div className="panel space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={19} />
          <h3 className="font-semibold">Période et périmètre</h3>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <label className="grid gap-1 text-sm font-medium">
            Rapport
            <select
              value={filters.mode}
              onChange={(e) => {
                const mode = e.target.value as Filters['mode'];
                update({ mode, trend: mode === 'year' ? 'years' : 'months' });
              }}
            >
              <option value="month">Mensuel</option>
              <option value="year">Annuel</option>
            </select>
          </label>
          <form
            className="grid gap-1 text-sm font-medium"
            onSubmit={(e) => {
              e.preventDefault();
              update({ year: Number(yearInput) });
            }}
          >
            <label htmlFor="report-year">Année</label>
            <div className="flex gap-1">
              <input
                id="report-year"
                type="number"
                required
                min={1900}
                max={9999}
                className="min-w-0 w-full"
                value={yearInput}
                onChange={(e) => setYearInput(e.target.value)}
              />
              <button
                className="btn alt"
                disabled={Number(yearInput) === filters.year}
              >
                Appliquer
              </button>
            </div>
          </form>
          {filters.mode === 'month' && (
            <label className="grid gap-1 text-sm font-medium">
              Mois
              <select
                value={filters.month}
                onChange={(e) => update({ month: Number(e.target.value) })}
              >
                {months.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="grid gap-1 text-sm font-medium">
            Comparer
            <select
              value={filters.group}
              onChange={(e) => {
                setQuery('');
                update({ group: e.target.value as Filters['group'], ids: [] });
              }}
            >
              <option value="all">Périmètre global</option>
              <option value="region">Régions</option>
              <option value="service">Services</option>
            </select>
          </label>
        </div>
        {filters.group !== 'all' && (
          <fieldset className="border rounded-xl p-3">
            <legend className="px-1 font-semibold text-sm">
              {filters.group === 'region' ? 'Régions' : 'Services'} ·{' '}
              {filters.ids.length} sélectionné(s)
            </legend>
            <input
              aria-label="Rechercher dans le périmètre"
              placeholder="Rechercher…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2 mt-2 max-h-44 overflow-y-auto">
              {catalog
                .filter((item) =>
                  item.name
                    .toLocaleLowerCase('fr')
                    .includes(query.toLocaleLowerCase('fr')),
                )
                .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
                .map((item) => (
                  <label
                    key={item.id}
                    className="flex gap-2 items-start text-sm py-1"
                  >
                    <input
                      type="checkbox"
                      checked={filters.ids.includes(item.id)}
                      onChange={() =>
                        update({ ids: toggle(filters.ids, item.id) })
                      }
                    />
                    {item.name}
                  </label>
                ))}
            </div>
          </fieldset>
        )}
        <details className="border rounded-xl p-3">
          <summary className="cursor-pointer font-semibold text-sm">
            Rubriques · {filters.rubrics.length || 'Toutes'}
          </summary>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2 mt-3">
            {Object.entries(rubricLabels).map(([id, label]) => (
              <label key={id} className="flex gap-2 items-start text-sm py-1">
                <input
                  type="checkbox"
                  checked={filters.rubrics.includes(id)}
                  onChange={() => {
                    setMetricSearch('');
                    update({
                      rubrics: toggle(filters.rubrics, id),
                      metric: '',
                    });
                  }}
                />
                {id} · {label}
              </label>
            ))}
          </div>
          {!!filters.rubrics.length && (
            <button
              className="btn alt mt-3"
              onClick={() => update({ rubrics: [], metric: '' })}
            >
              Toutes les rubriques
            </button>
          )}
        </details>
      </div>
      {!canQuery && (
        <p className="panel">
          Sélectionnez les régions ou services à afficher.
        </p>
      )}
      {error && (
        <p className="panel text-red-800" role="alert">
          {error}
        </p>
      )}
      {canQuery && !analysis && !error && (
        <p className="panel" role="status">
          Chargement du reporting…
        </p>
      )}
      {analysis && (
        <>
          <ReportingOverview analysis={analysis} />
          {isCentralDirector && (
            <article className="panel space-y-3 border-teal/30">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-navy flex items-center gap-2">
                    <Sparkles
                      size={17}
                      className="text-teal"
                      aria-hidden="true"
                    />
                    Synthèse exécutive IA (Direction centrale)
                  </h3>
                  <p className="text-xs text-slate-600">
                    Génère une note institutionnelle correspondant exactement
                    aux filtres actifs ci-dessus ({analysis.period}).
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {aiSummary?.key === key && (
                    <button
                      type="button"
                      className="btn alt inline-flex items-center gap-1.5 text-sm"
                      onClick={async () => {
                        const text = [
                          aiSummary.titre,
                          `Période : ${aiSummary.periodLabel}`,
                          '',
                          aiSummary.synthese,
                          '',
                          'FAITS MARQUANTS :',
                          ...aiSummary.faitsMarquants.map((f) => `- ${f}`),
                          '',
                          'POINTS DE VIGILANCE :',
                          ...aiSummary.pointsVigilance.map((p) => `- ${p}`),
                          '',
                          'RECOMMANDATIONS :',
                          ...aiSummary.recommandations.map((r) => `- ${r}`),
                        ].join('\n');
                        try {
                          await navigator.clipboard.writeText(text);
                          setAiCopied(true);
                          setTimeout(() => setAiCopied(false), 2500);
                        } catch {}
                      }}
                    >
                      {aiCopied ? (
                        <>
                          <Check size={15} className="text-teal" />
                          Copié
                        </>
                      ) : (
                        <>
                          <Copy size={15} />
                          Copier la note
                        </>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn green inline-flex items-center gap-2 text-sm"
                    disabled={aiBusy}
                    onClick={async () => {
                      setAiBusy(true);
                      setAiError('');
                      try {
                        const res = await fetch('/api/ai/central', {
                          method: 'POST',
                          cache: 'no-store',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'summary',
                            year: filters.year,
                            month: filters.month,
                            mode: filters.mode,
                            group: filters.group,
                            ids: filters.ids,
                            rubrics: filters.rubrics,
                          }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok)
                          throw new Error(
                            data.error || 'Erreur lors de la synthèse IA.',
                          );
                        setAiSummary({ key, ...data });
                      } catch (err) {
                        setAiError(
                          err instanceof Error
                            ? err.message
                            : 'Erreur lors de la synthèse IA.',
                        );
                      } finally {
                        setAiBusy(false);
                      }
                    }}
                  >
                    {aiBusy ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Sparkles size={15} />
                    )}
                    {aiBusy ? 'Rédaction…' : 'Générer la note'}
                  </button>
                </div>
              </div>
              {aiError && (
                <p
                  role="alert"
                  className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                >
                  {aiError}
                </p>
              )}
              {aiSummary?.key === key && (
                <div className="space-y-3 border-t border-slate-100 pt-3">
                  <h4 className="font-bold text-navy">{aiSummary.titre}</h4>
                  <p className="text-sm text-slate-800 leading-relaxed">
                    {aiSummary.synthese}
                  </p>
                  <div className="grid md:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-lg border border-slate-200 p-3 space-y-1.5">
                      <strong className="text-navy text-xs uppercase">
                        Faits marquants
                      </strong>
                      <ul className="list-disc pl-4 space-y-1 text-slate-700">
                        {aiSummary.faitsMarquants.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-1.5">
                      <strong className="text-amber-900 text-xs uppercase">
                        Points de vigilance
                      </strong>
                      <ul className="list-disc pl-4 space-y-1 text-slate-700">
                        {aiSummary.pointsVigilance.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-1.5">
                      <strong className="text-emerald-900 text-xs uppercase">
                        Recommandations
                      </strong>
                      <ul className="list-disc pl-4 space-y-1 text-slate-700">
                        {aiSummary.recommandations.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </article>
          )}
          <article className="panel space-y-4">
            <div className="flex gap-2 items-center">
              <Activity size={19} />
              <h3 className="font-semibold">Évolution des indicateurs</h3>
            </div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <label className="grid gap-1 text-sm font-medium">
                Fréquence
                <select
                  value={filters.trend}
                  onChange={(e) =>
                    update({ trend: e.target.value as Filters['trend'] })
                  }
                >
                  <option value="months">Mois de l’année</option>
                  <option value="years">Évolution annuelle</option>
                </select>
              </label>
              {filters.trend === 'years' && (
                <label className="grid gap-1 text-sm font-medium">
                  Historique
                  <select
                    value={filters.span}
                    onChange={(e) => update({ span: Number(e.target.value) })}
                  >
                    {[3, 5, 10].map((span) => (
                      <option key={span} value={span}>
                        {span} ans
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="grid gap-1 min-w-0 text-sm font-medium">
                Rechercher un indicateur
                <input
                  value={metricSearch}
                  onChange={(e) => setMetricSearch(e.target.value)}
                />
              </label>
              <label className="grid gap-1 min-w-0 text-sm font-medium">
                Indicateur
                <select
                  className="w-full min-w-0"
                  value={analysis.metric}
                  disabled={!analysis.indicators.length}
                  onChange={(e) => update({ metric: e.target.value })}
                >
                  {!analysis.metric && (
                    <option value="">Aucun indicateur</option>
                  )}
                  {analysis.indicators
                    .filter(
                      (item) =>
                        item.id === analysis.metric ||
                        (item.rubric + ' ' + item.label)
                          .toLocaleLowerCase('fr')
                          .includes(metricSearch.toLocaleLowerCase('fr')),
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.rubric} · {item.label}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {selectedMetric && (
              <p className="font-medium text-sm">{selectedMetric.label}</p>
            )}
            <Trend key={key + analysis.metric} analysis={analysis} />
          </article>
          {selectedMetric &&
            analysis.results.length > 1 &&
            (() => {
              const groups = analysis.results
                .filter(
                  (group) => group.current.values[analysis.metric] != null,
                )
                .sort(
                  (a, b) =>
                    b.current.values[analysis.metric]! -
                    a.current.values[analysis.metric]!,
                );
              const ceiling = selectedMetric.percent
                ? 100
                : Math.max(
                    1,
                    ...groups.map(
                      (group) => group.current.values[analysis.metric]!,
                    ),
                  );
              return (
                <article className="panel space-y-3">
                  <h3 className="font-semibold">
                    Comparaison sur la période · {analysis.period}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {selectedMetric.label}
                  </p>
                  {!groups.length && (
                    <p className="text-sm">
                      Aucune valeur validée pour cet indicateur sur la période.
                    </p>
                  )}
                  <ul className="space-y-3 max-h-96 overflow-y-auto">
                    {groups.map((group) => {
                      const value = group.current.values[analysis.metric]!;
                      return (
                        <li
                          key={group.id}
                          className="grid sm:grid-cols-[minmax(8rem,15rem)_1fr_7rem] gap-2 sm:items-center text-sm"
                        >
                          <span>{group.name}</span>
                          <div
                            aria-hidden="true"
                            className="bg-slate-100 h-3 rounded-full overflow-hidden"
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                background: colorFor(
                                  analysis.results.indexOf(group),
                                ),
                                width: `${(value / ceiling) * 100}%`,
                              }}
                            />
                          </div>
                          <strong className="sm:text-right tabular-nums">
                            {format(value, selectedMetric.percent)}
                          </strong>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })()}
          <div className="panel space-y-2">
            <h3 className="font-semibold">Couverture par périmètre</h3>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Périmètre</th>
                    <th>Validés</th>
                    <th>Théoriques</th>
                    <th>Couverture</th>
                    <th>Période précédente</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.results.map((group) => {
                    const target =
                      group.services * (filters.mode === 'year' ? 12 : 1);
                    return (
                      <tr key={group.id}>
                        <th scope="row">{group.name}</th>
                        <td>{group.current.count}</td>
                        <td>{target}</td>
                        <td>
                          {target
                            ? format(
                                Math.round(
                                  (group.current.count / target) * 1000,
                                ) / 10,
                                true,
                              )
                            : '—'}
                        </td>
                        <td>{group.previous.count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-slate-600">
              Base théorique : un rapport par mois et par service actuellement
              rattaché au périmètre.
            </p>
          </div>
          <div className="panel space-y-3">
            <h3 className="font-semibold">Rapports détaillés par rubrique</h3>
            <p className="text-sm text-slate-600">
              Écart par rapport{' '}
              {filters.mode === 'year'
                ? 'à l’année précédente'
                : 'au mois précédent'}
              . Le tiret indique une donnée absente ou un taux sans dénominateur
              commun.
            </p>
            {Object.entries(rubricLabels)
              .filter(
                ([id]) =>
                  !filters.rubrics.length || filters.rubrics.includes(id),
              )
              .map(([id, label]) => {
                const indicators = analysis.indicators.filter(
                  (field) =>
                    field.rubric === id &&
                    analysis.results.some(
                      (group) =>
                        group.current.values[field.id] != null ||
                        group.previous.values[field.id] != null,
                    ),
                );
                return (
                  <details key={id} className="border rounded-xl p-3">
                    <summary className="cursor-pointer font-medium">
                      <span className="inline-flex items-center gap-2">
                        <RubricIcon id={id} />
                        {id} · {label}
                      </span>{' '}
                      <span className="text-sm text-slate-500">
                        ({indicators.length})
                      </span>
                    </summary>
                    {!indicators.length ? (
                      <p className="text-sm mt-3 text-slate-600">
                        Aucune valeur validée pour cette période ou la
                        précédente.
                      </p>
                    ) : (
                      <div className="scroll mt-3">
                        <table>
                          <thead>
                            <tr>
                              <th>Indicateur</th>
                              {analysis.results.map((group) => (
                                <th key={group.id}>{group.name}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {indicators.map((field) => (
                              <tr key={field.id}>
                                <th scope="row" className="min-w-56">
                                  <button
                                    className="text-left hover:underline text-teal"
                                    onClick={() => update({ metric: field.id })}
                                  >
                                    {field.label}
                                  </button>
                                </th>
                                {analysis.results.map((group) => {
                                  const now = group.current.values[field.id],
                                    prev = group.previous.values[field.id];
                                  const delta =
                                    now == null || prev == null
                                      ? null
                                      : Number((now - prev).toPrecision(14));
                                  return (
                                    <td key={group.id} className="min-w-32">
                                      <b className="tabular-nums">
                                        {format(now, field.percent)}
                                      </b>
                                      {prev != null && (
                                        <div className="text-xs text-slate-600">
                                          Préc. {format(prev, field.percent)}
                                        </div>
                                      )}
                                      {delta != null && (
                                        <div className="text-xs text-slate-600">
                                          Écart {delta > 0 ? '+' : ''}
                                          {format(delta)}
                                          {field.percent ? ' pts' : ''}
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </details>
                );
              })}
          </div>
        </>
      )}
    </section>
  );
}
