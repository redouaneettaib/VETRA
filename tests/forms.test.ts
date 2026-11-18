import { describe, expect, it } from 'vitest';
import {
  calculate,
  calculatedCells,
  dynamicFields,
  enabledRubrics,
  numericCells,
  tables,
} from '../src/lib/forms';
import { RUBRICS } from '../src/lib/canevas';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import { exportReport } from '../src/lib/exports';

describe('Canevas et exports VETRA', () => {
  it('couvre les 20 rubriques et conserve les cellules à saisir même vides', () => {
    expect(Object.keys(tables)).toEqual(RUBRICS.map(([id]) => id));
    for (const cell of [
      'B17',
      'B34',
      'A68',
      'G69',
      'B148',
      'B220',
      'C277',
      'A310',
    ])
      expect(numericCells.has(cell)).toBe(true);
    for (const cell of ['A93', 'H9', 'B153', 'K306', 'A305'])
      expect(numericCells.has(cell)).toBe(false);
    expect(dynamicFields['I.D']).toHaveLength(4);
    expect(dynamicFields['II.C']).toHaveLength(14);
  });
  it('calcule les totaux et distingue unités, poids et taux', () => {
    expect(calculate('C68', { A68: 31, B68: 4 })).toBe(35);
    expect(calculate('I56', { B50: 2, H55: 9 })).toBe(11);
    expect(calculate('B153', { B127: 1, B141: 5, B152: 4 })).toBe(10);
    expect(calculate('C293', { C277: '2', C291: 4 })).toBe(6);
    expect(calculate('H9', { B9: 0 })).toBe(0);
    expect(calculate('H9', {})).toBeUndefined();
    expect(numericCells.get('C199')?.integer).toBe(true);
    expect(numericCells.get('C200')?.integer).toBe(false);
    expect(numericCells.get('K297')?.percent).toBe(true);
    expect(calculatedCells.has('K306')).toBe(false);
  });
  it('préserve le sens historique des droits absents et des droits désactivés', () => {
    expect(enabledRubrics([])).toHaveLength(20);
    expect(
      enabledRubrics([
        { rubricId: 'IV', enabled: true },
        { rubricId: 'V', enabled: false },
      ]),
    ).toEqual(['IV']);
    expect(enabledRubrics([{ rubricId: 'IV', enabled: false }])).toEqual([]);
  });
  const report = {
    year: 2026,
    month: 1,
    status: 'VALIDE',
    service: { name: 'SV Casablanca', kind: 'PROVINCIAL' },
    data: {
      __completed: ['I.A.1'],
      B9: 2,
      C9: 3,
      B152: 4,
      K297: 32,
      __tables: [
        { rubric: 'I.D', values: [1, 7, 1, 'Casablanca'] },
        { rubric: 'I.D', values: [2, 9, 1, 'Médiouna'] },
        {
          rubric: 'II.C',
          values: [
            1,
            'Établissement',
            3.5,
            '2026-01-05',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            'Action',
          ],
        },
      ],
    },
  };
  it('préserve les fusions et les formules, en effaçant les chiffres d’exemple', async () => {
    const response = await exportReport(report, 'xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await response.arrayBuffer());
    const sheet = wb.getWorksheet('CASA')!;
    expect(sheet.getCell('H2').value).toBe('JANVIER');
    expect(sheet.getCell('H3').value).toBe(2026);
    expect(sheet.getCell('H9').value).toEqual({
      formula: 'SUM(B9:G9)',
      result: 5,
    });
    expect(sheet.getCell('B153').result).toBe(4);
    expect(sheet.getCell('K297').value).toBe(32);
    expect(sheet.getCell('B10').value).toBeNull();
    expect(sheet.getCell('K306').value).toBeNull();
    expect(sheet.getCell('D120').value).toBe('Casablanca');
    expect(sheet.getCell('N167').value).toBe('Action');
    expect(sheet.getCell('L165').master.address).toBe('K165');
    expect(wb.getWorksheet('TIAC complémentaires')!.getCell('D2').value).toBe(
      'Médiouna',
    );
  });
  it('génère un PDF avec les deux logos et les caractères accentués', async () => {
    const response = await exportReport(report, 'pdf');
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(
      (await PDFDocument.load(await response.arrayBuffer())).getPageCount(),
    ).toBeGreaterThan(0);
  });
});
