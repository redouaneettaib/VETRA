import { describe, expect, it } from 'vitest';
import {
  buildExecutiveContext,
  buildQaContext,
  detectStatisticalAnomalies,
  detectWeakSignals,
  type ScopedReport,
  type ScopedService,
} from '../src/lib/ai-context';
import { numericCells } from '../src/lib/forms';

const [sampleMetricId] = [...numericCells.entries()].find(
  ([, field]) => !field.percent,
)!;

const services: ScopedService[] = [
  {
    id: 'svc-casa',
    name: 'SV Casablanca',
    kind: 'PROVINCIAL',
    region: { id: 'reg-1', name: 'Casablanca-Settat' },
  },
  {
    id: 'svc-rabat',
    name: 'SV Rabat',
    kind: 'PROVINCIAL',
    region: { id: 'reg-2', name: 'Rabat-Salé-Kénitra' },
  },
  {
    id: 'svc-tanger-port',
    name: 'PIF Tanger Med',
    kind: 'FRONTALIER',
    region: { id: 'reg-3', name: 'Tanger-Tétouan-Al Hoceïma' },
  },
];

describe('Analyse statistique et contexte IA (Direction centrale)', () => {
  it('détecte les pics extrêmes, chutes à zéro et défauts de transmission', () => {
    const reports: ScopedReport[] = [
      // Historical 4 months for Casa (median = 20)
      ...[1, 2, 3, 4].map((month) => ({
        id: `casa-${month}`,
        serviceId: 'svc-casa',
        year: 2026,
        month,
        status: 'VALIDE',
        data: { [sampleMetricId]: 20 },
      })),
      // Current month 5 for Casa: extreme spike (200 = 10x median)
      {
        id: 'casa-5',
        serviceId: 'svc-casa',
        year: 2026,
        month: 5,
        status: 'SOUMIS',
        data: { [sampleMetricId]: 200 },
      },
      // Historical 4 months for Rabat (median = 30), current month 5 drops to 0
      ...[1, 2, 3, 4].map((month) => ({
        id: `rabat-${month}`,
        serviceId: 'svc-rabat',
        year: 2026,
        month,
        status: 'VALIDE',
        data: { [sampleMetricId]: 30 },
      })),
      {
        id: 'rabat-5',
        serviceId: 'svc-rabat',
        year: 2026,
        month: 5,
        status: 'VALIDE',
        data: { [sampleMetricId]: 0 },
      },
      // Historical 3 months for Tanger Med, missing in month 5
      ...[2, 3, 4].map((month) => ({
        id: `tanger-${month}`,
        serviceId: 'svc-tanger-port',
        year: 2026,
        month,
        status: 'VALIDE',
        data: { [sampleMetricId]: 15 },
      })),
    ];

    const anomalies = detectStatisticalAnomalies(services, reports, 2026, 5);
    expect(anomalies.some((a) => a.kind === 'SPIKE' && a.serviceId === 'svc-casa')).toBe(
      true,
    );
    expect(
      anomalies.some((a) => a.kind === 'DROP_TO_ZERO' && a.serviceId === 'svc-rabat'),
    ).toBe(true);
    expect(
      anomalies.some(
        (a) => a.kind === 'MISSING_SUBMISSION' && a.serviceId === 'svc-tanger-port',
      ),
    ).toBe(true);
  });

  it('détecte les hausses consécutives et les progressions simultanées multi-régionales', () => {
    const reports: ScopedReport[] = [
      // Casa: steady 3-month rise + sharp surge in month 6
      ...[
        [1, 10],
        [2, 10],
        [3, 12],
        [4, 15],
        [5, 20],
        [6, 40],
      ].map(([month, val]) => ({
        id: `c-${month}`,
        serviceId: 'svc-casa',
        year: 2026,
        month,
        status: 'VALIDE',
        data: { [sampleMetricId]: val },
      })),
      // Rabat: simultaneous surge in month 6 vs prior 3-month average (10 -> 35)
      ...[
        [1, 10],
        [2, 10],
        [3, 10],
        [4, 10],
        [5, 10],
        [6, 35],
      ].map(([month, val]) => ({
        id: `r-${month}`,
        serviceId: 'svc-rabat',
        year: 2026,
        month,
        status: 'VALIDE',
        data: { [sampleMetricId]: val },
      })),
    ];

    const signals = detectWeakSignals(services, reports, 2026, 6);
    expect(signals.some((s) => s.pattern === 'MULTI_REGION_SURGE')).toBe(true);
    expect(signals.some((s) => s.pattern === 'CONSECUTIVE_RISE')).toBe(true);
  });

  it('construit un contexte exécutif et Q&A fidèle aux rapports validés', () => {
    const reports: ScopedReport[] = [
      {
        id: 'rep-1',
        serviceId: 'svc-casa',
        year: 2026,
        month: 5,
        status: 'VALIDE',
        data: { [sampleMetricId]: 42 },
      },
      {
        id: 'rep-2',
        serviceId: 'svc-rabat',
        year: 2026,
        month: 5,
        status: 'SOUMIS',
        data: { [sampleMetricId]: 18 },
      },
    ];

    const exec = buildExecutiveContext(services, reports, {
      year: 2026,
      month: 5,
      mode: 'month',
      trend: 'months',
      span: 5,
      group: 'all',
      ids: [],
      rubrics: [],
      metric: '',
    });
    expect(exec.totalServices).toBe(3);
    expect(exec.statusCounts.VALIDE).toBe(1);
    expect(exec.statusCounts.SOUMIS).toBe(1);
    expect(exec.topIndicators.some((i) => i.id === sampleMetricId && i.current === 42)).toBe(
      true,
    );

    const qa = buildQaContext(services, reports, 2026, 5);
    expect(qa.nationalServicesCount).toBe(3);
    expect(qa.currentMonthWorkflow.NON_INTRODUIT).toBe(1);
    expect(qa.kindBreakdown.find((k) => k.kind === 'FRONTALIER')?.serviceCount).toBe(1);
  });
});
