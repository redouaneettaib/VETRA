import { describe, expect, it } from 'vitest';
import {
  buildProvincialDemoReportData,
  isFullReportingPeriod,
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
import { regionalProgress } from '../src/lib/regional-progress';
import { getPreviewStore } from '../src/lib/preview-store';

describe('Jeu de données de présentation Direction Générale (12 régions)', () => {
  it('représente les 12 directions régionales avec 3 à 4 services et un compte Chef de service chacune', () => {
    expect(REGION_NAMES).toHaveLength(12);
    const servicesPerRegion = new Map<string, number>();
    for (const s of PRESENTATION_SERVICES) {
      servicesPerRegion.set(
        s.regionName,
        (servicesPerRegion.get(s.regionName) ?? 0) + 1,
      );
    }
    const coveredAccountRegions = new Set(
      PRESENTATION_CHEF_ACCOUNTS.map((a) => a.regionName),
    );
    for (const region of REGION_NAMES) {
      expect(servicesPerRegion.get(region) ?? 0).toBeGreaterThanOrEqual(3);
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

  it('met tous les 12 mois de 2025 ainsi que août et octobre de l’année en cours à 100 % sur les 12 régions', () => {
    const store = getPreviewStore();
    const regionById = new Map(store.regions.map((r) => [r.id, r]));
    const divisionById = new Map(store.divisions.map((d) => [d.id, d]));
    const services = store.services.map((s) => {
      const div = divisionById.get(s.divisionId)!;
      const reg = regionById.get(div.regionId)!;
      return { id: s.id, name: s.name, region: reg };
    });

    const currentYear = new Date().getFullYear();
    const prevYear = currentYear - 1;

    // 1. Tous les 12 mois de 2025 à 100 % (transmis & validés)
    for (let month = 1; month <= 12; month++) {
      expect(isFullReportingPeriod(prevYear, month, currentYear)).toBe(true);
      const analysis = analyze(
        {
          year: prevYear,
          month,
          mode: 'month',
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
      expect(analysis.operational.regions).toHaveLength(12);
      expect(analysis.operational.expected).toBe(store.services.length);
      expect(analysis.operational.transmitted).toBe(store.services.length);
      expect(analysis.operational.validated).toBe(store.services.length);
    }

    // 2. Août (8) et Octobre (10) de l'année en cours à 100 % sur les 12 régions
    for (const month of [8, 10]) {
      const filters: Filters = {
        year: currentYear,
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
      expect(analysis.operational.transmitted).toBe(store.services.length);
      expect(analysis.operational.validated).toBe(store.services.length);
      for (const region of analysis.operational.regions) {
        expect(region.transmitted).toBe(region.expected);
      }
    }
  });

  it('produit de vrais pourcentages régionaux intermédiaires (non binaires 0/100) sur les mois incomplets (ex. septembre)', () => {
    const store = getPreviewStore();
    const divisionById = new Map(store.divisions.map((d) => [d.id, d]));
    const regionalServices = store.services.map((s) => ({
      id: s.id,
      kind: s.kind,
      division: { regionId: divisionById.get(s.divisionId)!.regionId },
    }));
    const currentYear = new Date().getFullYear();

    for (const month of [1, 3, 6, 9]) {
      const recordedIds = new Set(
        store.reports
          .filter((r) => r.year === currentYear && r.month === month)
          .map((r) => r.serviceId),
      );
      const progress = regionalProgress(
        store.regions,
        regionalServices,
        recordedIds,
        null,
      );
      expect(progress).toHaveLength(12);
      const rates = progress.map((p) => p.rate);
      const intermediate = rates.filter((rate) => rate > 0 && rate < 100);
      // La grande majorité des régions affichent des taux intermédiaires (25 %, 33 %, 50 %, 67 %, 75 %)
      expect(intermediate.length).toBeGreaterThanOrEqual(8);
      // Au moins 3 tranches de couleurs différentes (1-49 %, 50-74 %, 75-99 % ou 100 %)
      const buckets = new Set(
        rates.map((r) =>
          r === 0 ? '0' : r < 50 ? '1-49' : r < 75 ? '50-74' : r < 100 ? '75-99' : '100',
        ),
      );
      expect(buckets.size).toBeGreaterThanOrEqual(3);
    }
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

    // Vérifie planDemoReport pour un service personnalisé en 2025 et en août 2026
    const custom2025 = planDemoReport({
      serviceName: 'Service vétérinaire personnalisé',
      serviceIndex: 44,
      serviceIndexInRegion: 0,
      regionServiceCount: 3,
      serviceKind: 'PROVINCIAL',
      regionName: 'Souss-Massa',
      year: 2025,
      month: 3,
      currentYear: 2026,
      currentMonth: 11,
      permittedRubrics: provincialRubrics,
    });
    expect(custom2025?.status).toBe('VALIDE');
    expect(custom2025?.completedRubrics).toHaveLength(provincialRubrics.length);
  });
});
