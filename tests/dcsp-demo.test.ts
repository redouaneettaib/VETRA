import { describe, expect, it } from 'vitest';
import {
  buildDcspDemoReportData,
  isDcspService,
  needsDcspDemoNormalization,
} from '../src/lib/demo-dcsp';
import {
  calculate,
  calculatedCells,
  cellRubric,
  numericCells,
} from '../src/lib/forms';
import { analyze, parseFilters } from '../src/lib/analytics';

describe('Données de test DCSP (Rubrique IV uniquement)', () => {
  it('détecte les services DCSP / frontaliers et exclut les services provinciaux standards', () => {
    expect(
      isDcspService({
        name: 'Service vétérinaire de la DCSP de Casablanca',
        kind: 'FRONTALIER',
      }),
    ).toBe(true);
    expect(
      isDcspService({
        name: 'Service vétérinaire de la DCSP de Tanger',
        kind: 'PROVINCIAL',
      }),
    ).toBe(true);
    expect(
      isDcspService({
        name: 'Poste frontalier portuaire',
        kind: 'PROVINCIAL',
        rights: [
          { rubricId: 'I.A.1', enabled: false },
          { rubricId: 'IV', enabled: true },
        ],
      }),
    ).toBe(true);
    expect(
      isDcspService({
        name: 'Service vétérinaire provincial de Fès',
        kind: 'PROVINCIAL',
        rights: [
          { rubricId: 'I.A.1', enabled: true },
          { rubricId: 'IV', enabled: true },
        ],
      }),
    ).toBe(false);
  });

  it('génère exclusivement des cellules valides de la rubrique IV cohérentes et sans formules', () => {
    for (const [serviceIndex, year, month] of [
      [0, 2025, 1],
      [0, 2025, 12],
      [1, 2026, 6],
      [2, 2026, 10],
    ]) {
      const data = buildDcspDemoReportData(serviceIndex, year, month);
      expect(data.__demo).toBe(true);
      expect(data.__completed).toEqual(['IV']);

      const cellKeys = Object.keys(data).filter((key) => !key.startsWith('__'));
      expect(cellKeys.length).toBeGreaterThan(20);

      for (const key of cellKeys) {
        expect(cellRubric(key)).toBe('IV');
        expect(calculatedCells.has(key)).toBe(false);
        const field = numericCells.get(key);
        expect(field).toBeDefined();
        expect(field?.rubric).toBe('IV');
        const value = data[key];
        expect(typeof value).toBe('number');
        expect(Number.isFinite(value as number)).toBe(true);
        expect(value as number).toBeGreaterThanOrEqual(0);
        if (field?.integer) {
          expect(Number.isSafeInteger(value as number)).toBe(true);
        }
      }

      // Cohérence quantités non admises <= quantités contrôlées
      for (const key of cellKeys) {
        if (key.startsWith('D')) {
          const controlledKey = 'C' + key.slice(1);
          expect(data[key] as number).toBeLessThanOrEqual(
            data[controlledKey] as number,
          );
        }
      }

      // Cohérence dossiers et certificats à l'importation (B220..B226)
      expect(data.B220).toBe((data.B221 as number) + (data.B226 as number));
      expect(data.B222 as number).toBeLessThanOrEqual(data.B226 as number);
      expect(data.B223 as number).toBeLessThanOrEqual(data.B220 as number);
      expect(data.B224 as number).toBeLessThanOrEqual(data.B220 as number);
      expect(data.B225 as number).toBeLessThanOrEqual(data.B224 as number);

      // Totaux calculés automatiquement par les formules de la rubrique IV
      expect(calculate('C187', data)).toBe(
        (data.C182 as number) +
          (data.C183 as number) +
          (data.C184 as number) +
          (data.C185 as number) +
          (data.C186 as number),
      );
      expect(calculate('C198', data)).toBeGreaterThan(0);
      expect(calculate('C217', data)).toBe(
        (data.C215 as number) + (data.C216 as number),
      );
    }
  });

  it('repère les anciennes données DCSP hors rubrique IV et laisse intactes les données conformes', () => {
    const oldDemo = {
      __demo: true,
      B9: 104,
      C9: 116,
      D9: 108,
      B10: 1040,
      C10: 312,
      D10: 104,
      B11: 1,
      C11: 2,
    };
    expect(needsDcspDemoNormalization(oldDemo)).toBe(true);

    const legacyWithoutFlag = {
      B9: 104,
      C9: 116,
      D9: 108,
      B10: 1040,
      C10: 312,
      D10: 104,
      B11: 1,
      C11: 2,
    };
    expect(needsDcspDemoNormalization(legacyWithoutFlag)).toBe(true);

    const compliantDemo = buildDcspDemoReportData(0, 2026, 5);
    expect(needsDcspDemoNormalization(compliantDemo)).toBe(false);

    const manualIvReport = {
      __completed: ['IV'],
      C182: 500,
      B220: 12,
      B221: 12,
    };
    expect(needsDcspDemoNormalization(manualIvReport)).toBe(false);
  });

  it('alimente le reporting uniquement sur la rubrique IV pour un service DCSP', () => {
    const service = {
      id: 'dcsp-casa',
      name: 'Service vétérinaire de la DCSP de Casablanca',
      region: { id: 'casa', name: 'Casablanca-Settat' },
    };
    const report = {
      serviceId: service.id,
      year: 2026,
      month: 5,
      data: buildDcspDemoReportData(0, 2026, 5),
    };
    const filters = parseFilters(
      new URLSearchParams('year=2026&month=5&group=service&id=dcsp-casa'),
    );
    const analysis = analyze(filters, [service], [report]);
    expect(analysis.indicators.length).toBeGreaterThan(0);
    expect(analysis.indicators.every((indicator) => indicator.rubric === 'IV')).toBe(
      true,
    );
  });
});
