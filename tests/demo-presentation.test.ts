import { describe, expect, it } from 'vitest';
import {
  buildProvincialDemoReportData,
  isFullReportingMonth,
  planDemoReport,
  PRESENTATION_CHEF_ACCOUNTS,
  PRESENTATION_SERVICES,
  REGION_NAMES,
} from '../src/lib/demo-presentation';
import {
  cellRubric,
  defaultRubricsForKind,
  numericCells,
  reportCompletionPercent,
} from '../src/lib/forms';
import { analyze, type Filters } from '../src/lib/analytics';
import { getPreviewStore } from '../src/lib/preview-store';

describe('Jeu de données de présentation Direction Générale (12 régions)', () => {
  it('représente les 12 directions régionales avec au moins un service et un compte Chef de service chacune', () => {
    expect(REGION_NAMES).toHaveLength(12);
    const coveredServiceRegions = new Set(
      PRESENTATION_SERVICES.map((s) => s.regionName),
    );
    const coveredAccountRegions = new Set(
      PRESENTATION_CHEF_ACCOUNTS.map((a) => a.regionName),
    );
    for (const region of REGION_NAMES) {
      expect(coveredServiceRegions.has(region)).toBe(true);
      expect(coveredAccountRegions.has(region)).toBe(true);
    }
    const emails = PRESENTATION_CHEF_ACCOUNTS.map((a) => a.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('ne génère que des cellules éditables valides et strictement limitées aux rubriques complétées', () => {
    const partial = defaultRubricsForKind('PROVINCIAL').slice(0, 4);
    const data = buildProvincialDemoReportData(
      2,
      2026,
      11,
      partial,
      'Marrakech-Safi',
    );
    const cellKeys = Object.keys(data).filter((k) => !k.startsWith('__'));
    expect(cellKeys.length).toBeGreaterThan(0);
    for (const key of cellKeys) {
      expect(numericCells.has(key)).toBe(true);
      expect(partial.includes(cellRubric(key)!)).toBe(true);
    }
  });

  it('garantit 100 % de transmission et validation en août et octobre dans le reporting sur les 12 régions', () => {
    expect(isFullReportingMonth(8)).toBe(true);
    expect(isFullReportingMonth(10)).toBe(true);
    expect(isFullReportingMonth(9)).toBe(false);

    const store = getPreviewStore();
    const regionById = new Map(store.regions.map((r) => [r.id, r]));
    const divisionById = new Map(store.divisions.map((d) => [d.id, d]));
    const services = store.services.map((s) => {
      const div = divisionById.get(s.divisionId)!;
      const reg = regionById.get(div.regionId)!;
      return { id: s.id, name: s.name, region: reg };
    });

    const year = new Date().getFullYear();
    for (const month of [8, 10]) {
      const filters: Filters = {
        year,
        month,
        mode: 'month',
        trend: 'months',
        span: 5,
        group: 'all',
        ids: [],
        rubrics: [],
        metric: '',
      };
      const analysis = analyze(
        filters,
        services,
        store.reports.filter((r) => r.status === 'VALIDE'),
        store.reports,
      );
      expect(analysis.operational.regions).toHaveLength(12);
      expect(analysis.operational.expected).toBe(store.services.length);
      expect(analysis.operational.transmitted).toBe(store.services.length);
      expect(analysis.operational.validated).toBe(store.services.length);
      for (const region of analysis.operational.regions) {
        expect(region.transmitted).toBe(region.expected);
      }
    }
  });

  it('produit des pourcentages de complétude variés par service sur le mois courant et par région sur l’année', () => {
    const store = getPreviewStore();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const currentMonthPcts = store.services.map((service) => {
      const report = store.reports.find(
        (r) =>
          r.serviceId === service.id && r.year === year && r.month === month,
      );
      expect(report).toBeDefined();
      return reportCompletionPercent(report, service.rights, service.kind);
    });

    // Au moins 6 taux de complétude distincts parmi les services (ex. 21 %, 32 %, 47 %, 58 %, 63 %, 68 %, 74 %, 79 %, 89 %, 100 %)
    expect(new Set(currentMonthPcts).size).toBeGreaterThanOrEqual(6);
    expect(Math.min(...currentMonthPcts)).toBeLessThan(40);
    expect(Math.max(...currentMonthPcts)).toBe(100);

    // Vue annuelle : les 12 régions ont des taux de transmission variés
    const regionById = new Map(store.regions.map((r) => [r.id, r]));
    const divisionById = new Map(store.divisions.map((d) => [d.id, d]));
    const services = store.services.map((s) => {
      const div = divisionById.get(s.divisionId)!;
      const reg = regionById.get(div.regionId)!;
      return { id: s.id, name: s.name, region: reg };
    });
    const annual = analyze(
      {
        year,
        month,
        mode: 'year',
        trend: 'months',
        span: 5,
        group: 'all',
        ids: [],
        rubrics: [],
        metric: '',
      },
      services,
      store.reports.filter((r) => r.status === 'VALIDE'),
      store.reports,
    );
    expect(annual.operational.regions).toHaveLength(12);
    const annualRates = new Set(
      annual.operational.regions.map((r) =>
        Math.round((r.transmitted / r.expected) * 100),
      ),
    );
    expect(annualRates.size).toBeGreaterThanOrEqual(5);
  });

  it('calcule correctement reportCompletionPercent selon le statut et les rubriques complétées', () => {
    const provincialRubrics = defaultRubricsForKind('PROVINCIAL');
    expect(reportCompletionPercent(null, [], 'PROVINCIAL')).toBe(0);
    expect(
      reportCompletionPercent({ status: 'VALIDE', data: {} }, [], 'PROVINCIAL'),
    ).toBe(100);
    expect(
      reportCompletionPercent({ status: 'SOUMIS', data: {} }, [], 'PROVINCIAL'),
    ).toBe(100);
    expect(
      reportCompletionPercent(
        {
          status: 'BROUILLON',
          data: { __completed: provincialRubrics.slice(0, 4) },
        },
        [],
        'PROVINCIAL',
      ),
    ).toBe(Math.round((4 / provincialRubrics.length) * 100));

    // Vérifie planDemoReport pour un service personnalisé en août
    const customAug = planDemoReport({
      serviceName: 'Service vétérinaire personnalisé',
      serviceIndex: 16,
      serviceKind: 'PROVINCIAL',
      regionName: 'Souss-Massa',
      year: 2026,
      month: 8,
      currentYear: 2026,
      currentMonth: 11,
      permittedRubrics: provincialRubrics,
    });
    expect(customAug?.status).toBe('VALIDE');
    expect(customAug?.completedRubrics).toHaveLength(provincialRubrics.length);
  });
});
