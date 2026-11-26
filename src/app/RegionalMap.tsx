'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import geography from '@/lib/regions-maroc.json';
import {
  officialRegionRank,
  previousPeriod,
  regionalProgress,
  regionKey,
  sortRegionsOfficial,
  type Region,
  type RegionalService,
} from '@/lib/regional-progress';

const palette = ['#ffffff', '#d1eadd', '#8eccac', '#399f75', '#0f654c'];
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
  const listRef = useRef<HTMLUListElement | null>(null);
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const [scrollState, setScrollState] = useState({
    canUp: false,
    canDown: false,
    hasOverflow: false,
  });
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
  const rows = sortRegionsOfficial(
    regionalProgress(regions, services, recorded, previous?.ids ?? null),
  );
  const byName = new Map(rows.map((row) => [regionKey(row.name), row]));
  const rowCount = rows.length;

  const updateScrollState = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 4;
    const canUp = el.scrollTop > 4;
    const canDown = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
    setScrollState((prev) =>
      prev.canUp === canUp &&
      prev.canDown === canDown &&
      prev.hasOverflow === hasOverflow
        ? prev
        : { canUp, canDown, hasOverflow },
    );
  }, []);

  useEffect(() => {
    updateScrollState();
    window.addEventListener('resize', updateScrollState);
    return () => window.removeEventListener('resize', updateScrollState);
  }, [rowCount, updateScrollState]);

  useEffect(() => {
    if (!selected) return;
    const node = itemRefs.current.get(selected);
    if (node) {
      node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selected]);

  const scrollListBy = (direction: -1 | 1) => {
    const el = listRef.current;
    if (!el) return;
    const step = Math.max(180, Math.round(el.clientHeight * 0.8));
    el.scrollBy({ top: direction * step, behavior: 'smooth' });
  };

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
                : region.name;
              return (
                <path
                  key={region.id}
                  d={region.path}
                  fill={row ? scale(row.rate) : 'transparent'}
                  stroke={
                    row?.id === selected ? '#142d46' : '#94a3b8'
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
            ].map((label, index) => (
              <span key={label} className="inline-flex items-center gap-1">
                <i
                  className="h-3 w-3 rounded-sm border border-slate-300"
                  style={{ background: palette[index] }}
                />{' '}
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <div className="vetra-region-header">
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-navy">
                Écart en points par rapport à{' '}
                {frenchMonth(previousYear, previousMonth)}
              </h3>
              {rows.length > 0 && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {rows.length} direction{rows.length > 1 ? 's' : ''}{' '}
                  régionale{rows.length > 1 ? 's' : ''} · classement officiel
                </p>
              )}
            </div>
            {scrollState.hasOverflow && (
              <div
                className="vetra-region-scroll-controls"
                aria-label="Défilement de la liste des régions"
              >
                <button
                  type="button"
                  className="vetra-region-scroll-btn"
                  aria-label="Régions précédentes"
                  title="Monter dans la liste"
                  disabled={!scrollState.canUp}
                  onClick={() => scrollListBy(-1)}
                >
                  <ChevronUp size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="vetra-region-scroll-btn"
                  aria-label="Régions suivantes"
                  title="Descendre dans la liste"
                  disabled={!scrollState.canDown}
                  onClick={() => scrollListBy(1)}
                >
                  <ChevronDown size={16} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
          {!previous && (
            <p role="status" className="text-xs text-slate-600 mt-1">
              Chargement de la comparaison…
            </p>
          )}
          {previous?.failed && (
            <p className="text-xs text-slate-600 mt-1">
              La comparaison avec le mois précédent est indisponible.
            </p>
          )}
          {rows.length === 0 && (
            <p className="text-sm text-slate-600 py-4">
              Aucun service dans ce périmètre.
            </p>
          )}
          {rows.length > 0 && (
            <div className="vetra-region-scroll-wrap">
              <ul
                ref={listRef}
                className="vetra-region-list"
                aria-label="Liste des directions régionales"
                onScroll={updateScrollState}
              >
                {rows.map((row, index) => {
                  const officialRank = officialRegionRank(row.name);
                  const displayRank =
                    officialRank <= 12 ? officialRank : index + 1;
                  return (
                    <li
                      key={row.id}
                      ref={(el) => {
                        if (el) itemRefs.current.set(row.id, el);
                        else itemRefs.current.delete(row.id);
                      }}
                    >
                      <button
                        type="button"
                        aria-pressed={row.id === selected}
                        onClick={() =>
                          onSelect(row.id === selected ? '' : row.id)
                        }
                      >
                        <span className="vetra-region-item-main">
                          <span
                            className="vetra-region-rank"
                            aria-hidden="true"
                          >
                            {String(displayRank).padStart(2, '0')}
                          </span>
                          <i
                            className="vetra-region-dot"
                            aria-hidden="true"
                            style={{ background: scale(row.rate) }}
                          />
                          <span className="min-w-0">
                            <strong className="block truncate">
                              {row.name}
                            </strong>
                            <small>
                              {row.current}/{row.expected} rapports saisis
                            </small>
                          </span>
                        </span>
                        <span className="text-right tabular-nums shrink-0">
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
                  );
                })}
              </ul>
              {scrollState.hasOverflow && (
                <div className="vetra-region-scroll-footer">
                  <button
                    type="button"
                    className="vetra-region-scroll-hint"
                    onClick={() => scrollListBy(scrollState.canDown ? 1 : -1)}
                  >
                    {scrollState.canDown ? (
                      <>
                        <ChevronDown size={14} aria-hidden="true" />
                        Défiler pour voir les autres régions
                      </>
                    ) : (
                      <>
                        <ChevronUp size={14} aria-hidden="true" />
                        Revenir en haut de la liste
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
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

