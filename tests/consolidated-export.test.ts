import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import {
  aggregateReportsData,
  describeConsolidatedScope,
  filterReportsForConsolidation,
  parseConsolidatedParams,
  sanitizeFilenamePart,
} from '../src/lib/consolidated-export';
import { calculate } from '../src/lib/forms';
import { exportConsolidatedReport } from '../src/lib/exports';

describe('Consolidation multi-services (Total des rapports)', () => {
  it('additionne les indicateurs numériques, préserve la précision et concatène les tableaux dynamiques', () => {
    const reports = [
      {
        data: {
          __completed: ['I.A.1', 'II.A'],
          __demo: true,
          B9: 12,
          C9: 8,
          B152: 3,
          G69: 12.35,
          K297: 15,
          K298: 4.5,
          __tables: [
            { rubric: 'I.D', values: [1, 5, 0, 'Casablanca'] },
            {
              rubric: 'II.C',
              values: [
                2,
                'Unité A',
                10.5,
                '2026-11-04',
                '',
                '',
                '',
                1,
                0,
                0,
                '',
                '',
                '',
                'Retrait',
              ],
            },
          ],
        },
      },
      {
        data: {
          __completed: ['I.A.1', 'II.A'],
          B9: 5,
          C9: 7,
          B152: 4,
          G69: 0.15,
          K297: 25,
          __tables: [
            { rubric: 'I.D', values: [2, 9, 1, 'Mohammedia'] },
            {
              rubric: 'II.C',
              values: [
                1,
                'Unité B',
                4.5,
                '2026-11-08',
                '',
                '',
                '',
                2,
                0,
                0,
                '',
                '',
                '',
                'Rappel',
              ],
            },
          ],
        },
      },
    ];

    const aggregated = aggregateReportsData(reports);
    expect(aggregated.data.B9).toBe(17);
    expect(aggregated.data.C9).toBe(15);
    expect(aggregated.data.B152).toBe(7);
    expect(aggregated.data.G69).toBe(12.5);
    // Les pourcentages présents sur >= 2 services ne sont jamais additionnés
    expect(aggregated.data.K297).toBeUndefined();
    // Un pourcentage présent sur un seul service est conservé
    expect(aggregated.data.K298).toBe(4.5);
    // Les formules dérivées recalculent exactement le total
    expect(calculate('H9', aggregated.data)).toBe(32);
    // Les tableaux dynamiques sont concaténés
    expect(aggregated.dynamicRowCount).toBe(4);
    expect(Array.isArray(aggregated.data.__tables)).toBe(true);
    expect((aggregated.data.__tables as unknown[]).length).toBe(4);
    // Les métadonnées internes ne fuitent pas
    expect(aggregated.data.__completed).toBeUndefined();
    expect(aggregated.data.__demo).toBeUndefined();
  });

  it('valide les paramètres de consolidation et rejette les valeurs invalides', () => {
    const ok = parseConsolidatedParams(
      new URLSearchParams('year=2026&month=11&status=VALIDE&regionId=reg-2'),
    );
    expect(ok).toEqual({
      year: 2026,
      month: 11,
      status: 'VALIDE',
      regionId: 'reg-2',
    });

    const defaults = parseConsolidatedParams(
      new URLSearchParams('year=2026&month=5'),
    );
    expect(defaults.status).toBe('TOUS');
    expect(defaults.regionId).toBe('');

    expect(() =>
      parseConsolidatedParams(new URLSearchParams('year=2026&month=13')),
    ).toThrow(/Période invalide/);
    expect(() =>
      parseConsolidatedParams(
        new URLSearchParams('year=2026&month=11&status=NON%20INTRODUIT'),
      ),
    ).toThrow(/Filtre d’état invalide/);
  });

  it('filtre les rapports selon le statut demandé', () => {
    const list = [
      { id: '1', status: 'VALIDE' },
      { id: '2', status: 'SOUMIS' },
      { id: '3', status: 'BROUILLON' },
    ];
    expect(filterReportsForConsolidation(list, 'TOUS')).toHaveLength(3);
    expect(filterReportsForConsolidation(list, 'SAISIS')).toHaveLength(3);
    expect(filterReportsForConsolidation(list, 'VALIDE').map((r) => r.id)).toEqual([
      '1',
    ]);
    expect(filterReportsForConsolidation(list, 'SOUMIS').map((r) => r.id)).toEqual([
      '2',
    ]);
  });

  it('construit un intitulé, un sous-titre et un nom de fichier sûr selon le rôle', () => {
    expect(sanitizeFilenamePart('Fès-Meknès / L’Oriental')).toBe(
      'FES_MEKNES_L_ORIENTAL',
    );

    const centralAll = describeConsolidatedScope({
      role: 'DIRECTION_CENTRALE',
      year: 2026,
      month: 11,
      statusFilter: 'TOUS',
      includedCount: 8,
      totalServiceCount: 8,
    });
    expect(centralAll.filenameSlug).toBe('TOTAL_NATIONAL');
    expect(centralAll.subtitle).toContain('8/8 services inclus');

    const centralRegion = describeConsolidatedScope({
      role: 'DIRECTION_CENTRALE',
      year: 2026,
      month: 11,
      statusFilter: 'VALIDE',
      includedCount: 3,
      totalServiceCount: 4,
      regionFilterName: 'Casablanca-Settat',
    });
    expect(centralRegion.filenameSlug).toBe('TOTAL_CASABLANCA_SETTAT_VALIDES');
    expect(centralRegion.subtitle).toContain('Rapports validés uniquement');

    const dr = describeConsolidatedScope({
      role: 'DIRECTEUR_REGIONAL',
      year: 2026,
      month: 11,
      statusFilter: 'TOUS',
      includedCount: 4,
      totalServiceCount: 4,
      regionName: 'Casablanca-Settat',
    });
    expect(dr.filenameSlug).toBe('TOTAL_DR_CASABLANCA_SETTAT');

    const div = describeConsolidatedScope({
      role: 'CHEF_DIVISION',
      year: 2026,
      month: 11,
      statusFilter: 'SOUMIS',
      includedCount: 1,
      totalServiceCount: 4,
      divisionName: 'Division vétérinaire — Casablanca-Settat',
    });
    expect(div.filenameSlug).toContain('TOTAL_DIV_');
    expect(div.filenameSlug).toContain('_SOUMIS');
  });

  it('génère des exports consolidés Excel (XLSX) et PDF valides avec la somme exacte', async () => {
    const input = {
      year: 2026,
      month: 11,
      scopeLabel: 'Direction régionale · Casablanca-Settat',
      subtitle:
        'Direction régionale · Casablanca-Settat · 2/2 services inclus · Tous les rapports introduits',
      filenameSlug: 'TOTAL_DR_CASABLANCA_SETTAT',
      statusLabel: 'Tous les rapports introduits',
      totalServiceCount: 2,
      reports: [
        { data: { B9: 10, C9: 4, B152: 2 } },
        { data: { B9: 6, C9: 5, B152: 3 } },
      ],
      services: [
        {
          serviceId: 'srv-1',
          serviceName: 'SV Préfectoral Casablanca',
          serviceKind: 'PROVINCIAL',
          divisionName: 'Division Casablanca',
          regionName: 'Casablanca-Settat',
          status: 'VALIDE',
        },
        {
          serviceId: 'srv-2',
          serviceName: 'SV Mohammedia',
          serviceKind: 'PROVINCIAL',
          divisionName: 'Division Casablanca',
          regionName: 'Casablanca-Settat',
          status: 'SOUMIS',
        },
      ],
    };

    const xlsxResponse = await exportConsolidatedReport(input, 'xlsx');
    expect(xlsxResponse.headers.get('Content-Disposition')).toContain(
      'VETRA_TOTAL_DR_CASABLANCA_SETTAT_2026_11.xlsx',
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await xlsxResponse.arrayBuffer());
    const casa = wb.getWorksheet('CASA')!;
    expect(casa.getCell('H2').value).toBe('NOVEMBRE');
    expect(casa.getCell('H3').value).toBe(2026);
    expect(casa.getCell('B9').value).toBe(16);
    expect(casa.getCell('C9').value).toBe(9);
    expect(casa.getCell('H9').value).toEqual({
      formula: 'SUM(B9:G9)',
      result: 25,
    });
    const summarySheet = wb.getWorksheet('Périmètre consolidé');
    expect(summarySheet).toBeDefined();
    expect(summarySheet!.rowCount).toBeGreaterThanOrEqual(5);

    const pdfResponse = await exportConsolidatedReport(input, 'pdf');
    expect(pdfResponse.headers.get('Content-Type')).toBe('application/pdf');
    expect(pdfResponse.headers.get('Content-Disposition')).toContain(
      'VETRA_TOTAL_DR_CASABLANCA_SETTAT_2026_11.pdf',
    );
    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
    expect(Buffer.from(pdfBytes.subarray(0, 5)).toString('ascii')).toBe(
      '%PDF-',
    );
    const parsedPdf = await PDFDocument.load(pdfBytes);
    expect(parsedPdf.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
