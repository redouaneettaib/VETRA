import ExcelJS from 'exceljs';
import { format, rubricLabels, type Analysis } from './analytics';
import { attachment, pdfTables } from './pdf-tables';

export async function exportAnalysis(analysis: Analysis, type: 'pdf' | 'xlsx') {
  const { filters, period, results, indicators, periods, metric } = analysis;
  const active = indicators.find((item) => item.id === metric);
  const title = `Reporting ${filters.mode === 'year' ? 'annuel' : 'mensuel'} · ${period}`;
  const filename = `VETRA_Reporting_${filters.year}${filters.mode === 'month' ? '-' + String(filters.month).padStart(2, '0') : ''}.${type}`;
  const selected =
    filters.rubrics.map((id) => rubricLabels[id]).join(' · ') ||
    'Toutes les rubriques';
  const scope =
    filters.group === 'all'
      ? 'Périmètre autorisé'
      : filters.group === 'region'
        ? 'Comparaison régionale'
        : 'Comparaison par service';
  const subtitle =
    scope +
    ' · Rapports validés · ' +
    results.reduce((sum, result) => sum + result.current.count, 0) +
    ' rapports sur la période';
  const coverage = results.map((result) => [
    result.name,
    result.current.count,
    result.services * (filters.mode === 'year' ? 12 : 1),
    result.previous.count,
  ]);
  const coverageHead = [
    'Périmètre',
    'Rapports validés',
    'Rapports théoriques',
    'Période précédente',
  ];
  const getDelta = (now: number | null, prev: number | null) =>
    now == null || prev == null ? null : Number((now - prev).toPrecision(14));
  if (type === 'pdf') {
    const pdf = await pdfTables(title, subtitle);
    pdf.note('Rubriques : ' + selected);
    pdf.table('Couverture des remontées', coverageHead, coverage);
    if (active) {
      for (let start = 0; start < results.length; start += 5) {
        const groups = results.slice(start, start + 5);
        pdf.chart(
          active.label,
          periods.map((point) =>
            filters.trend === 'months' ? point.label.slice(0, 3) : point.label,
          ),
          groups.map((group) => ({
            name: group.name,
            values: group.trend.map((point) => point.values[metric]),
          })),
          active.percent,
        );
        pdf.table(
          'Évolution · ' + active.label,
          ['Période', ...groups.map((group) => group.name)],
          periods.map((point, index) => [
            point.label,
            ...groups.map((group) =>
              format(group.trend[index].values[metric], active.percent),
            ),
          ]),
        );
      }
    }
    for (const [id, label] of Object.entries(rubricLabels)) {
      const rows = indicators.filter(
        (item) =>
          item.rubric === id &&
          results.some(
            (result) =>
              result.current.values[item.id] != null ||
              result.previous.values[item.id] != null,
          ),
      );
      if (!rows.length) continue;
      for (const result of results) {
        pdf.table(
          `${id} · ${label} / ${result.name}`,
          ['Indicateur', 'Période sélectionnée', 'Période précédente', 'Écart'],
          rows.map((item) => {
            const cur = result.current.values[item.id],
              prev = result.previous.values[item.id];
            const delta = getDelta(cur, prev);
            return [
              item.label,
              format(cur, item.percent),
              format(prev, item.percent),
              delta == null
                ? '—'
                : format(delta) + (item.percent ? ' pts' : ''),
            ];
          }),
        );
      }
    }
    if (!indicators.length)
      pdf.note('Aucune donnée validée pour cette sélection.');
    pdf.note(
      'Le tiret indique une donnée absente ou un taux sans dénominateur commun.',
    );
    return attachment(new Uint8Array(await pdf.save()), filename, type);
  }
  const book = new ExcelJS.Workbook();
  book.creator = 'ONSSA – DPA / VETRA';
  function sheet(name: string, columns: string[], rows: ExcelJS.CellValue[][]) {
    const ws = book.addWorksheet(name);
    ws.columns = columns.map((header, index) => ({
      header,
      width: index === 0 ? 46 : 24,
    }));
    ws.addRows(rows);
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };
    ws.getRow(1).height = 32;
    ws.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF075456' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { wrapText: true, vertical: 'middle' };
    });
    return ws;
  }
  sheet(
    'Synthèse',
    ['Paramètre', 'Valeur'],
    [
      ['Rapport', title],
      ['Périmètre', subtitle],
      ['Rubriques', selected],
      ['Indicateur de la courbe', active?.label ?? '—'],
      ['Évolution', filters.trend === 'months' ? 'Mensuelle' : 'Annuelle'],
      [
        'Taux',
        'Un taux est affiché lorsqu’une seule observation est disponible.',
      ],
    ],
  );
  sheet('Couverture', coverageHead, coverage);
  sheet(
    'Évolution',
    ['Indicateur', 'Période', ...results.map((result) => result.name)],
    indicators.flatMap((item) =>
      periods.map((point, index) => [
        item.label,
        point.label,
        ...results.map((result) => result.trend[index].values[item.id] ?? null),
      ]),
    ),
  );
  for (const [id] of Object.entries(rubricLabels)) {
    const rows = indicators.filter(
      (item) =>
        item.rubric === id &&
        results.some(
          (result) =>
            result.current.values[item.id] != null ||
            result.previous.values[item.id] != null,
        ),
    );
    if (!rows.length) continue;
    sheet(
      id,
      [
        'Indicateur',
        'Région ou service',
        'Période sélectionnée',
        'Période précédente',
        'Écart',
        'Nature',
      ],
      rows.flatMap((item) =>
        results.map((result) => {
          const now = result.current.values[item.id],
            prev = result.previous.values[item.id];
          return [
            item.label,
            result.name,
            now,
            prev,
            getDelta(now, prev),
            item.percent ? 'Taux (%)' : 'Valeur du canevas',
          ];
        }),
      ),
    );
  }
  return attachment(
    new Uint8Array((await book.xlsx.writeBuffer()) as ArrayBuffer),
    filename,
    type,
  );
}
