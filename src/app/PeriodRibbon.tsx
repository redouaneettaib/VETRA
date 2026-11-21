'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';

const SHORT_MONTHS = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Jun',
  'Jul',
  'Aoû',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
] as const;

const FULL_MONTHS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const;

export default function PeriodRibbon({
  month,
  year,
  disabled = false,
  onChange,
}: {
  month: number;
  year: number;
  disabled?: boolean;
  onChange: (nextMonth: number, nextYear: number) => void;
}) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const isCurrentPeriod = month === currentMonth && year === currentYear;

  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const [gridStartYear, setGridStartYear] = useState(() => year - 5);
  const [customYear, setCustomYear] = useState(String(year));
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustomYear(String(year));
    setGridStartYear((prev) =>
      year < prev || year > prev + 11 ? year - 5 : prev,
    );
  }, [year]);

  useEffect(() => {
    if (!yearMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setYearMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setYearMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [yearMenuOpen]);

  const clampYear = (y: number) => Math.min(9999, Math.max(1900, Math.trunc(y)));

  const stepMonth = (delta: -1 | 1) => {
    if (disabled) return;
    let nextMonth = month + delta;
    let nextYear = year;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear = clampYear(year - 1);
    } else if (nextMonth > 12) {
      nextMonth = 1;
      nextYear = clampYear(year + 1);
    }
    onChange(nextMonth, nextYear);
  };

  const stepYear = (delta: -1 | 1) => {
    if (disabled) return;
    onChange(month, clampYear(year + delta));
  };

  const applyCustomYear = () => {
    const parsed = Number(customYear);
    if (Number.isInteger(parsed) && parsed >= 1900 && parsed <= 9999) {
      onChange(month, parsed);
      setYearMenuOpen(false);
    } else {
      setCustomYear(String(year));
    }
  };

  return (
    <section
      className="vetra-period-ribbon"
      aria-label="Sélection de la période mensuelle"
    >
      {/* Sélecteur d'année interactif */}
      <div className="vetra-period-year-wrap" ref={popoverRef}>
        <div className="vetra-period-year-dial">
          <span className="vetra-period-icon" aria-hidden="true">
            <CalendarDays size={16} />
          </span>
          <button
            type="button"
            className="vetra-period-step"
            aria-label="Année précédente"
            title="Année précédente"
            disabled={disabled || year <= 1900}
            onClick={() => stepYear(-1)}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            className="vetra-period-year-btn"
            aria-label={`Année ${year}, cliquer pour choisir`}
            aria-expanded={yearMenuOpen}
            disabled={disabled}
            onClick={() => setYearMenuOpen((open) => !open)}
          >
            {year}
          </button>
          <button
            type="button"
            className="vetra-period-step"
            aria-label="Année suivante"
            title="Année suivante"
            disabled={disabled || year >= 9999}
            onClick={() => stepYear(1)}
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {yearMenuOpen && (
          <div
            className="vetra-year-popover"
            role="dialog"
            aria-label="Choisir une année"
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100">
              <button
                type="button"
                className="vetra-period-step"
                aria-label="Décennie précédente"
                onClick={() => setGridStartYear((y) => Math.max(1900, y - 12))}
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-xs font-bold text-navy tabular-nums">
                {gridStartYear} – {Math.min(9999, gridStartYear + 11)}
              </span>
              <button
                type="button"
                className="vetra-period-step"
                aria-label="Décennie suivante"
                onClick={() => setGridStartYear((y) => Math.min(9988, y + 12))}
              >
                <ChevronRight size={15} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 12 }, (_, idx) => gridStartYear + idx).map(
                (y) => (
                  <button
                    key={y}
                    type="button"
                    className={
                      'vetra-year-cell' +
                      (y === year ? ' is-selected' : '') +
                      (y === currentYear ? ' is-today' : '')
                    }
                    onClick={() => {
                      onChange(month, y);
                      setYearMenuOpen(false);
                    }}
                  >
                    {y}
                  </button>
                ),
              )}
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center gap-1.5">
              <input
                type="number"
                aria-label="Saisir une année"
                min={1900}
                max={9999}
                value={customYear}
                onChange={(event) => setCustomYear(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applyCustomYear();
                  }
                }}
                className="w-full py-1.5 px-2.5 text-xs font-semibold tabular-nums text-navy"
              />
              <button
                type="button"
                className="btn text-xs py-1.5 px-3 shrink-0"
                onClick={applyCustomYear}
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>

      <span className="vetra-period-divider" aria-hidden="true" />

      {/* Frise chronologique des 12 mois */}
      <div
        className="vetra-month-strip"
        role="group"
        aria-label="Mois de l’année"
      >
        {SHORT_MONTHS.map((label, index) => {
          const m = index + 1;
          const active = m === month;
          const isTodayMonth = m === currentMonth && year === currentYear;
          const quarterBreak = index > 0 && index % 3 === 0;
          return (
            <button
              key={label}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              title={`${FULL_MONTHS[index]} ${year}`}
              className={
                'vetra-month-btn' +
                (active ? ' is-active' : '') +
                (isTodayMonth ? ' is-today' : '') +
                (quarterBreak ? ' is-quarter-start' : '')
              }
              onClick={() => onChange(m, year)}
            >
              <span>{label}</span>
              {isTodayMonth && (
                <span className="vetra-month-today-mark" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* Navigation mois précédent/suivant et retour au mois en cours */}
      <div className="vetra-period-actions">
        <div className="vetra-period-nav-group">
          <button
            type="button"
            className="vetra-period-step"
            aria-label="Mois précédent"
            title="Mois précédent"
            disabled={disabled}
            onClick={() => stepMonth(-1)}
          >
            <ChevronLeft size={15} />
          </button>
          <span className="vetra-period-readout" aria-live="polite">
            {FULL_MONTHS[month - 1]} {year}
          </span>
          <button
            type="button"
            className="vetra-period-step"
            aria-label="Mois suivant"
            title="Mois suivant"
            disabled={disabled}
            onClick={() => stepMonth(1)}
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {!isCurrentPeriod && (
          <button
            type="button"
            className="vetra-period-today-btn"
            disabled={disabled}
            title={`Revenir à ${FULL_MONTHS[currentMonth - 1]} ${currentYear}`}
            onClick={() => onChange(currentMonth, currentYear)}
          >
            <RotateCcw size={13} aria-hidden="true" />
            <span>Aujourd’hui</span>
          </button>
        )}
      </div>
    </section>
  );
}
