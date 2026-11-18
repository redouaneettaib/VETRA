import ExcelJS from 'exceljs';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'node:fs/promises';
import path from 'node:path';
import { RUBRICS } from './canevas';
import {
  calculate,
  calculatedCells,
  dynamicFields,
  formulas,
  numericCells,
  readNumber,
} from './forms';

type Report = {
  year: number;
  month: number;
  status: string;
  data: unknown;
  service: { name: string; kind: string };
};
const asset = (name: string) => path.join(process.cwd(), 'public', name);

export async function exportReport(report: Report, type: 'pdf' | 'xlsx') {
  const data = (
    report.data && typeof report.data === 'object' ? report.data : {}
  ) as Record<string, unknown>;
  const details = Array.isArray(data.__tables) ? data.__tables : [];
  const month = new Intl.DateTimeFormat('fr-MA', {
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(report.year, report.month - 1, 1)));
  const title = `Rapport mensuel · ${month} ${report.year}`;
  const filename = `VETRA_${report.year}_${String(report.month).padStart(2, '0')}.${type}`;
  let bytes: Uint8Array<ArrayBuffer>;
  if (type === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(
      path.join(process.cwd(), 'canevas_CASA_original.xlsx'),
    );
    const sheet = workbook.getWorksheet('CASA');
    if (!sheet) throw Error('Feuille CASA introuvable');
    sheet.getCell('H2').value = month.toLocaleUpperCase('fr-MA');
    sheet.getCell('H3').value = report.year;
    sheet.eachRow((row) =>
      row.eachCell((cell) => {
        if (cell.type === ExcelJS.ValueType.Number && cell.address !== 'H3')
          cell.value = null;
      }),
    );
    for (const [address] of numericCells) {
      sheet.getCell(address).value = readNumber(data[address]) ?? null;
    }
    for (const address of ['K306', 'L306', 'M306'])
      sheet.getCell(address).value = null;
    for (const [address, formula] of Object.entries(formulas)) {
      sheet.getCell(address).value = {
        formula,
        result: calculate(address, data) ?? 0,
      };
    }
    workbook.calcProperties.fullCalcOnLoad = true;
    for (const [rubric, fields] of Object.entries(dynamicFields)) {
      const rows = details.filter(
        (item) => item?.rubric === rubric && Array.isArray(item.values),
      );
      const staticRows = rubric === 'I.D' ? [120] : [167, 168];
      rows.slice(0, staticRows.length).forEach((item, index) => {
        fields.forEach((field, j) => {
          const value = item.values[j];
          const cell = sheet.getRow(staticRows[index]).getCell(j + 1);
          if (field.kind === 'number') cell.value = readNumber(value) ?? null;
          else if (
            field.kind === 'date' &&
            /^\d{4}-\d{2}-\d{2}$/.test(String(value))
          ) {
            cell.value = new Date(String(value) + 'T00:00:00Z');
            cell.style = { ...cell.style, numFmt: 'dd/mm/yyyy' };
          } else
            cell.value =
              value === undefined || value === '' ? null : String(value);
        });
      });
      if (rubric === 'II.C' && rows.length) {
        for (const col of [0, 2, 7, 8, 9]) {
          const values = rows
            .map((item) => readNumber(item.values[col]))
            .filter((value) => value !== undefined);
          sheet.getRow(169).getCell(col + 1).value = values.length
            ? values.reduce((a, b) => a + b, 0)
            : null;
        }
      }
      if (rows.length <= staticRows.length) continue;
      const extra = workbook.addWorksheet(
        rubric === 'I.D' ? 'TIAC complémentaires' : 'Retraits complémentaires',
      );
      extra.columns = fields.map((field) => ({
        header: field.label,
        width: 30,
      }));
      extra.getRow(1).font = { bold: true };
      extra.getRow(1).alignment = { wrapText: true };
      extra.views = [{ state: 'frozen', ySplit: 1 }];
      for (const item of rows.slice(staticRows.length))
        extra.addRow(
          fields.map((field, index) =>
            field.kind === 'number'
              ? (readNumber(item.values[index]) ?? null)
              : String(item.values[index] ?? ''),
          ),
        );
    }
    bytes = new Uint8Array((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
  } else {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const [font, onssa, vetra] = await Promise.all([
      fs
        .readFile(asset('DejaVuSans.ttf'))
        .then((buffer) => doc.embedFont(buffer, { subset: true })),
      fs
        .readFile(asset('ONSSA_officiel.jpg'))
        .then((buffer) => doc.embedJpg(buffer)),
      fs
        .readFile(asset('VETRA_officiel.jpg'))
        .then((buffer) => doc.embedJpg(buffer)),
    ]);
    const color = rgb(0.07, 0.19, 0.29);
    let page = doc.addPage([595, 842]);
    let y = 0;
    const header = () => {
      const left = onssa.scaleToFit(120, 42),
        right = vetra.scaleToFit(120, 42);
      page.drawImage(onssa, { x: 36, y: 758, ...left });
      page.drawImage(vetra, { x: 559 - right.width, y: 758, ...right });
      page.drawText(`ONSSA – DPA  |  ${title}`, {
        x: 36,
        y: 730,
        font,
        size: 13,
        color,
      });
      page.drawText(String(doc.getPageCount()), {
        x: 541,
        y: 28,
        font,
        size: 9,
        color,
      });
      y = 705;
    };
    header();
    const ensure = (height: number) => {
      if (y >= 48 + height) return;
      page = doc.addPage([595, 842]);
      header();
    };
    function line(text: string, size = 10, indent = 0) {
      let current = '';
      for (const char of text.replace(/[\r\n\t]/g, ' ')) {
        if (font.widthOfTextAtSize(current + char, size) > 523 - indent) {
          ensure(16);
          page.drawText(current.trim(), {
            x: 36 + indent,
            y,
            font,
            size,
            color,
          });
          y -= 16;
          current = '';
        }
        current += char;
      }
      ensure(16);
      page.drawText(current.trim(), { x: 36 + indent, y, font, size, color });
      y -= 16;
    }
    line(
      report.service.name +
        ' · Service ' +
        (report.service.kind === 'FRONTALIER' ? 'frontalier' : 'provincial'),
    );
    line('Statut : ' + report.status);
    for (const [rubric, , , label] of RUBRICS) {
      const fields = [...numericCells, ...calculatedCells].filter(
        ([, field]) => field.rubric === rubric,
      );
      const entries = fields.flatMap(([address, field]) => {
        const value = calculate(address, data);
        return value === undefined
          ? []
          : [field.label + ' : ' + value.toLocaleString('fr-FR')];
      });
      const rows = details.filter(
        (item) => item?.rubric === rubric && Array.isArray(item.values),
      );
      if (!entries.length && !rows.length) continue;
      ensure(48);
      y -= 10;
      line(`${rubric} — ${label}`, 12);
      entries.forEach((entry) => line(entry, 10, 8));
      rows.forEach((item, index) => {
        line('Ligne ' + (index + 1), 10, 8);
        dynamicFields[rubric]?.forEach((field, j) => {
          if (item.values[j] !== undefined && item.values[j] !== '')
            line(field.label + ' : ' + item.values[j], 10, 16);
        });
      });
    }
    bytes = new Uint8Array(await doc.save());
  }
  return new Response(bytes, {
    headers: {
      'Content-Type':
        type === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
