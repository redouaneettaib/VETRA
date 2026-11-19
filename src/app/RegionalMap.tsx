'use client';
import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import geography from '@/lib/regions-maroc.json';
import {
  previousPeriod,
  regionalProgress,
  regionKey,
  type Region,
  type RegionalService,
} from '@/lib/regional-progress';

const palette = ['#edf3f5', '#d1eadd', '#8eccac', '#399f75', '#0f654c'];
const scale = (rate: number) =>
  rate === 0
    ? palette[0]
    : rate < 50
      ? palette[1]
      : rate < 75
        ? palette[2]
        : rate < 100
          ? palette[3]
          : palette[4];
const frenchMonth = (year: number, month: number) =>
  new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));

export default function RegionalMap({
  regions,
  services,
  recorded,
  year,
  month,
  identity,
  selected,
  onSelect,
}: {
  regions: Region[];
  services: RegionalService[];
  recorded: Set<string>;
  year: number;
  month: number;
  identity: string;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [history, setHistory] = useState<{
    key: string;
    ids: Set<string> | null;
    failed?: boolean;
  }>();
  const { year: previousYear, month: previousMonth } = previousPeriod(
    year,
    month,
  );
  const key = `${identity}:${previousYear}-${previousMonth}`;
  useEffect(() => {
    if (previousYear < 1900) {
      setHistory({ key, ids: null, failed: true });
      return;
    }
    const controller = new AbortController();
    fetch(
      `/api/reports?year=${previousYear}&month=${previousMonth}&summary=1`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw Error('Comparaison indisponible');
        const reports: { serviceId: string }[] = await response.json();
        if (!controller.signal.aborted)
          setHistory({
            key,
            ids: new Set(reports.map((row) => row.serviceId)),
          });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setHistory({ key, ids: null, failed: true });
      });
    return () => controller.abort();
  }, [key, previousMonth, previousYear]);
  const previous = history?.key === key ? history : undefined;
  const rows = regionalProgress(
    regions,
    services,
    recorded,
    previous?.ids ?? null,
  );
  const byName = new Map(rows.map((row) => [regionKey(row.name), row]));
  return (
    <section className="panel vetra-map-panel">
      <header className="flex flex-wrap justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-navy">
            <MapPin className="text-teal" size={20} /> Progression de la saisie
            par région
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Rapports saisis / services attendus · {frenchMonth(year, month)}
          </p>
        </div>
        {!!selected && (
          <button
            type="button"
            className="btn alt"
            onClick={() => onSelect('')}
          >
            Toutes les régions
          </button>
        )}
      </header>
      <div className="vetra-map-layout">
        <div>
          <svg
            viewBox={geography.viewBox}
            className="vetra-region-map"
            role="group"
            aria-label="Carte des régions du Maroc"
          >
            {geography.regions.map((region) => {
              const row = byName.get(regionKey(region.name));
              const label = row
                ? `${row.name} : ${row.current} sur ${row.expected}, ${row.rate} % saisis`
                : `${region.name} : hors périmètre`;
              return (
                <path
                  key={region.id}
                  d={region.path}
                  fill={row ? scale(row.rate) : '#f5f7fa'}
                  stroke={
                    row ? (row.id === selected ? '#142d46' : '#fff') : '#cbd5e1'
                  }
                  strokeWidth={row && row.id === selected ? 2 : 1.1}
                  vectorEffect="non-scaling-stroke"
                  fillRule="evenodd"
                  role={row ? 'button' : undefined}
                  tabIndex={row ? 0 : undefined}
                  aria-label={label}
                  aria-pressed={row ? row.id === selected : undefined}
                  className={row ? 'vetra-region-shape' : undefined}
                  onClick={
                    row
                      ? () => onSelect(row.id === selected ? '' : row.id)
                      : undefined
                  }
                  onKeyDown={
                    row
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onSelect(row.id === selected ? '' : row.id);
                          }
                        }
                      : undefined
                  }
                >
                  <title>{label}</title>
                </path>
              );
            })}
          </svg>
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center text-xs text-slate-600">
            {[
              '0 %',
              '1–49 %',
              '50–74 %',
              '75–99 %',
              '100 %',
              'Hors périmètre',
            ].map((label, index) => (
              <span key={label} className="inline-flex items-center gap-1">
                <i
                  className="h-3 w-3 rounded-sm border border-slate-300"
                  style={{ background: palette[index] ?? '#f5f7fa' }}
                />{' '}
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-sm text-navy">
            Écart en points par rapport à{' '}
            {frenchMonth(previousYear, previousMonth)}
          </h3>
          {!previous && (
            <p role="status" className="text-xs text-slate-600">
              Chargement de la comparaison…
            </p>
          )}
          {previous?.failed && (
            <p className="text-xs text-slate-600">
              La comparaison avec le mois précédent est indisponible.
            </p>
          )}
          {rows.length === 0 && (
            <p className="text-sm text-slate-600 py-4">
              Aucun service dans ce périmètre.
            </p>
          )}
          <ul className="vetra-region-list">
            {[...rows]
              .sort(
                (a, b) => b.rate - a.rate || a.name.localeCompare(b.name, 'fr'),
              )
              .map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    aria-pressed={row.id === selected}
                    onClick={() => onSelect(row.id === selected ? '' : row.id)}
                  >
                    <span>
                      <strong>{row.name}</strong>
                      <small>
                        {row.current}/{row.expected} rapports saisis
                      </small>
                    </span>
                    <span className="text-right tabular-nums">
                      <strong>{row.rate} %</strong>
                      <small
                        className={
                          row.delta == null
                            ? ''
                            : row.delta > 0
                              ? 'text-emerald-700'
                              : row.delta < 0
                                ? 'text-rose-700'
                                : ''
                        }
                      >
                        {row.delta == null
                          ? '—'
                          : `${row.delta > 0 ? '+' : ''}${row.delta} pts`}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Découpage administratif du reporting VETRA. Données cartographiques{' '}
        <a
          className="underline"
          href="https://github.com/yousfiSaad/morocco-map"
        >
          morocco-map
        </a>
        ,{' '}
        <a
          className="underline"
          href="https://opendatacommons.org/licenses/odbl/1-0/"
        >
          ODbL 1.0
        </a>
        .{' '}
        <a
          className="underline"
          href="/cartographie/regions-maroc.topo.json"
          download
        >
          Source TopoJSON
        </a>
      </p>
    </section>
  );
}
