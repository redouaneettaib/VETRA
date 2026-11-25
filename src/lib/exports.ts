import ExcelJS from 'exceljs';
import path from 'node:path';
import { RUBRICS } from './canevas';
import {
  calculate,
  columnLabel,
  labelAt,
  tables,
  rowHeading,
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
import { attachment, pdfTables } from './pdf-tables';
import { format } from './analytics';
import {
  aggregateReportsData,
  type ConsolidatedServiceItem,
} from './consolidated-export';

type ConsolidatedReportInput = {
  year: number;
  month: number;
  scopeLabel: string;
  subtitle: string;
  filenameSlug: string;
  statusLabel: string;
  totalServiceCount: number;
  reports: { data: unknown }[];
  services: ConsolidatedServiceItem[];
};

function monthNameFr(year: number, month: number) {
  return new Intl.DateTimeFormat('fr-MA', {
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

async function buildExcelWorkbook(
  year: number,
  monthName: string,
  data: Record<string, unknown>,
  details: { rubric?: string; values?: unknown[] }[],
  consolidatedMeta?: {
    scopeLabel: string;
    statusLabel: string;
    totalServiceCount: number;
    services: ConsolidatedServiceItem[];
  },
) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(
    path.join(process.cwd(), 'canevas_CASA_original.xlsx'),
  );
  const sheet = workbook.getWorksheet('CASA');
  if (!sheet) throw Error('Feuille CASA introuvable');
  sheet.getCell('H2').value = monthName.toLocaleUpperCase('fr-MA');
  sheet.getCell('H3').value = year;
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
        const value = item.values![j];
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
          .map((item) => readNumber(item.values![col]))
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
            ? (readNumber(item.values![index]) ?? null)
            : String(item.values![index] ?? ''),
        ),
      );
  }
  if (consolidatedMeta) {
    const summary = workbook.addWorksheet('Périmètre consolidé');
    summary.columns = [
      { header: 'Direction régionale', width: 28 },
      { header: 'Division vétérinaire', width: 28 },
      { header: 'Service vétérinaire', width: 40 },
      { header: 'Type', width: 18 },
      { header: 'Statut', width: 16 },
    ];
    summary.getRow(1).font = { bold: true };
    summary.views = [{ state: 'frozen', ySplit: 1 }];
    const sorted = [...consolidatedMeta.services].sort(
      (a, b) =>
        a.regionName.localeCompare(b.regionName, 'fr') ||
        a.serviceName.localeCompare(b.serviceName, 'fr'),
    );
    for (const item of sorted) {
      summary.addRow([
        item.regionName,
        item.divisionName,
        item.serviceName,
        item.serviceKind === 'FRONTALIER'
          ? 'Service frontalier'
          : 'Service provincial',
        item.status,
      ]);
    }
    summary.addRow([]);
    summary.addRow([
      'Périmètre',
      consolidatedMeta.scopeLabel,
      'Filtre d’état',
      consolidatedMeta.statusLabel,
      `${sorted.length}/${consolidatedMeta.totalServiceCount} services`,
    ]);
    summary.getRow(summary.rowCount).font = { bold: true };
  }
  return new Uint8Array((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
}

async function buildPdfDocument(
  title: string,
  subtitle: string,
  data: Record<string, unknown>,
  details: { rubric?: string; values?: unknown[] }[],
  consolidatedServices?: ConsolidatedServiceItem[],
) {
  const pdf = await pdfTables(title, subtitle);
  if (consolidatedServices && consolidatedServices.length > 0) {
    const sorted = [...consolidatedServices].sort(
      (a, b) =>
        a.regionName.localeCompare(b.regionName, 'fr') ||
        a.serviceName.localeCompare(b.serviceName, 'fr'),
    );
    pdf.table(
      `Périmètre consolidé · ${sorted.length} service${sorted.length > 1 ? 's' : ''} vétérinaire${sorted.length > 1 ? 's' : ''} inclus`,
      ['Service vétérinaire', 'Direction régionale', 'Type', 'Statut'],
      sorted.map((item) => [
        item.serviceName,
        item.regionName,
        item.serviceKind === 'FRONTALIER' ? 'Frontalier' : 'Provincial',
        item.status,
      ]),
    );
  }
  let populated = false;
  for (const [rubric, , , label] of RUBRICS) {
    for (const group of tables[rubric] ?? []) {
      const columns = Array.from(group.columns);
      const rows = group.rows.filter(
        (row) =>
          !rowHeading(row) &&
          columns.some(
            (col) =>
              calculate(col + row, data) !== undefined &&
              group.editableColumns.includes(col),
          ),
      );
      if (!rows.length) continue;
      populated = true;
      pdf.table(
        `${rubric} · ${label} / ${group.title}`,
        columns.map((col) => columnLabel(group, col)),
        rows.map((row) =>
          columns.map((col) => {
            const id = col + row;
            return (
              labelAt(id) ||
              format(calculate(id, data), numericCells.get(id)?.percent)
            );
          }),
        ),
      );
    }
    const fields = dynamicFields[rubric];
    if (!fields) continue;
    const rows = details.filter(
      (item) => item?.rubric === rubric && Array.isArray(item.values),
    );
    if (!rows.length) continue;
    populated = true;
    for (let start = 0; start < fields.length; start += 6) {
      const subset = fields.slice(start, start + 6);
      pdf.table(
        `${rubric} · ${label}`,
        ['Ligne', ...subset.map((field) => field.label)],
        rows.map((row, index) => [
          index + 1,
          ...subset.map((field, j) =>
            field.kind === 'number'
              ? format(readNumber(row.values![start + j]))
              : row.values![start + j] || '—',
          ),
        ]),
      );
    }
  }
  if (!populated) pdf.note('Aucune donnée renseignée pour cette période.');
  return new Uint8Array(await pdf.save());
}

export async function exportReport(report: Report, type: 'pdf' | 'xlsx') {
  const data = (
    report.data && typeof report.data === 'object' ? report.data : {}
  ) as Record<string, unknown>;
  const details = Array.isArray(data.__tables) ? data.__tables : [];
  const month = monthNameFr(report.year, report.month);
  const title = `Rapport mensuel · ${month} ${report.year}`;
  const filename = `VETRA_${report.year}_${String(report.month).padStart(2, '0')}.${type}`;
  const bytes =
    type === 'xlsx'
      ? await buildExcelWorkbook(report.year, month, data, details)
      : await buildPdfDocument(
          title,
          report.service.name +
            ' · ' +
            (report.service.kind === 'FRONTALIER'
              ? 'Service frontalier'
              : 'Service provincial') +
            ' · ' +
            report.status,
          data,
          details,
        );
  return attachment(bytes, filename, type);
}

export async function exportConsolidatedReport(
  input: ConsolidatedReportInput,
  type: 'pdf' | 'xlsx',
) {
  const { data } = aggregateReportsData(input.reports);
  const details = Array.isArray(data.__tables)
    ? (data.__tables as { rubric?: string; values?: unknown[] }[])
    : [];
  const month = monthNameFr(input.year, input.month);
  const title = `Rapport mensuel consolidé · ${month} ${input.year}`;
  const safeSlug = input.filenameSlug.replace(/[^A-Za-z0-9_]/g, '') || 'TOTAL';
  const filename = `VETRA_${safeSlug}_${input.year}_${String(input.month).padStart(2, '0')}.${type}`;
  const bytes =
    type === 'xlsx'
      ? await buildExcelWorkbook(input.year, month, data, details, {
          scopeLabel: input.scopeLabel,
          statusLabel: input.statusLabel,
          totalServiceCount: input.totalServiceCount,
          services: input.services,
        })
      : await buildPdfDocument(
          title,
          input.subtitle,
          data,
          details,
          input.services,
        );
  return attachment(bytes, filename, type);
}

