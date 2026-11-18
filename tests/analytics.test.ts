import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import { analyze, parseFilters } from '../src/lib/analytics';
import { exportAnalysis } from '../src/lib/reporting-export';

const services = [
  { id: 's1', name: 'Service 1', region: { id: 'r1', name: 'Région 1' } },
  { id: 's2', name: 'Service 2', region: { id: 'r2', name: 'Région 2' } },
];
const reports = [
  { serviceId: 's1', year: 2025, month: 12, data: { B9: 3 } },
  {
    serviceId: 's1',
    year: 2026,
    month: 1,
    data: {
      B9: 0,
      K297: 5,
      __tables: [
        { rubric: 'I.D', values: [2, 4] },
        { rubric: 'I.D', values: [1, 3] },
      ],
    },
  },
  { serviceId: 's1', year: 2026, month: 3, data: { B9: 6, K297: 10 } },
  { serviceId: 's2', year: 2026, month: 1, data: { B9: 9 } },
  { serviceId: 'private', year: 2026, month: 1, data: { B9: 999 } },
];
const analyzeWith = (query: string) =>
  analyze(
    parseFilters(new URLSearchParams('year=2026&month=1&' + query)),
    services,
    reports,
  );

describe('Reporting VETRA', () => {
  it('compare les régions par mois et retrouve décembre comme période précédente', () => {
    const analysis = analyzeWith(
      'group=region&id=r1&id=r2&rubric=I.A.1&metric=H9',
    );
    expect(analysis.results.map((group) => group.current.values.H9)).toEqual([
      0, 9,
    ]);
    expect(analysis.results[0].previous.values.H9).toBe(3);
    expect(analysis.results[0].trend[1].values.H9).toBeNull();
    expect(analysis.results[0].trend[2].values.H9).toBe(6);
  });
  it('consolide les valeurs annuelles sans exposer les services hors périmètre', () => {
    const analysis = analyzeWith('mode=year&trend=years&span=3&metric=H9');
    expect(analysis.results[0].current).toMatchObject({
      count: 3,
      values: { H9: 15, K297: null, 'I.D:0': 3, 'I.D:1': 7 },
    });
    expect(analysis.results[0].trend.map((period) => period.values.H9)).toEqual(
      [null, 3, 15],
    );
  });
  it('garde un taux saisi isolé sans additionner de pourcentages', () => {
    const analysis = analyzeWith('group=service&id=s1&rubric=VI.B&metric=K297');
    expect(analysis.results[0].current.values.K297).toBe(5);
    expect(analysis.indicators.map((field) => field.id)).toEqual(['K297']);
  });
  it('rejette les filtres invalides et produit les deux pièces jointes', async () => {
    expect(() =>
      parseFilters(new URLSearchParams('year=2026&month=13')),
    ).toThrow();
    const analysis = analyzeWith(
      'mode=year&trend=years&group=service&id=s1&id=s2&rubric=I.A.1&metric=H9',
    );
    const xlsx = await exportAnalysis(analysis, 'xlsx');
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await xlsx.arrayBuffer());
    expect(book.getWorksheet('I.A.1')?.rowCount).toBeGreaterThan(1);
    expect(book.getWorksheet('VI.B')).toBeUndefined();
    expect(
      book.getWorksheet('Évolution')?.getRow(1).getCell(3).value,
    ).toContain('Service 1');
    const pdf = await exportAnalysis(analysis, 'pdf');
    expect(
      (await PDFDocument.load(await pdf.arrayBuffer())).getPageCount(),
    ).toBeGreaterThan(0);
  });
});

it('distingue les rapports transmis des brouillons et conserve les chiffres validés', () => {
  const result = analyze(
    parseFilters(new URLSearchParams('year=2026&month=1')),
    services,
    reports,
    [
      { serviceId: 's1', year: 2026, month: 1, status: 'SOUMIS' },
      { serviceId: 's2', year: 2026, month: 1, status: 'BROUILLON' },
      { serviceId: 'private', year: 2026, month: 1, status: 'VALIDE' },
    ],
  );
  expect(result.operational).toMatchObject({
    expected: 2,
    transmitted: 1,
    validated: 0,
    pending: 1,
    correction: 0,
  });
  expect(result.operational.byMonth[0].count).toBe(1);
  expect(result.operational.toReview[0]).toMatchObject({
    serviceId: 's1',
    status: 'SOUMIS',
  });
  expect(result.results[0].current.values.H9).toBe(9);
});
