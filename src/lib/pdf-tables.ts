import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function pdfTables(title: string, subtitle: string) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const asset = (name: string) =>
    fs.readFile(path.join(process.cwd(), 'public', name));
  const [font, left, right] = await Promise.all([
    asset('DejaVuSans.ttf').then((bytes) =>
      doc.embedFont(bytes, { subset: true }),
    ),
    asset('onssa-transparent.png').then((bytes) => doc.embedPng(bytes)),
    asset('VETRA_officiel.jpg').then((bytes) => doc.embedJpg(bytes)),
  ]);
  const ink = rgb(0.06, 0.17, 0.27),
    teal = rgb(0.03, 0.32, 0.33),
    white = rgb(1, 1, 1),
    grey = rgb(0.93, 0.96, 0.97);
  const width = 842,
    margin = 32,
    inner = width - 2 * margin;
  let page = doc.addPage([width, 595]),
    y = 0;
  const draw = (
    text: string,
    x: number,
    at: number,
    size: number,
    color = ink,
  ) => page.drawText(text, { x, y: at, font, size, color });
  function wrap(raw: unknown, max: number, size: number) {
    const text = String(raw ?? '—').replace(/[\x00-\x1f]/g, ' ');
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      if (!word) continue;
      if (line && font.widthOfTextAtSize(line + ' ' + word, size) > max) {
        lines.push(line);
        line = '';
      }
      if (font.widthOfTextAtSize(word, size) <= max)
        line += (line ? ' ' : '') + word;
      else
        for (const char of word) {
          if (font.widthOfTextAtSize(line + char, size) > max) {
            lines.push(line);
            line = '';
          }
          line += char;
        }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }
  function header() {
    const a = left.scaleToFit(85, 32),
      b = right.scaleToFit(85, 32);
    page.drawImage(left, { x: margin, y: 540, ...a });
    page.drawImage(right, { x: width - margin - b.width, y: 540, ...b });
    draw(title, margin, 518, 16);
    wrap(subtitle, inner, 9).forEach((line, i) =>
      draw(line, margin, 500 - i * 12, 9),
    );
    draw('VETRA · ONSSA / DPA', margin, 22, 8);
    draw(String(doc.getPageCount()), width - margin - 18, 22, 8);
    y = 480 - 12 * (wrap(subtitle, inner, 9).length - 1);
  }
  header();
  function nextPage() {
    page = doc.addPage([width, 595]);
    header();
  }
  function note(text: string) {
    for (const line of wrap(text, inner, 9)) {
      if (y < 52) nextPage();
      draw(line, margin, y - 11, 9);
      y -= 13;
    }
    y -= 8;
  }
  function table(name: string, columns: string[], rows: unknown[][]) {
    if (!rows.length || !columns.length) return;
    const widths = columns.map((_, i) =>
      columns.length > 1
        ? i === 0
          ? inner * Math.max(0.23, 1 / columns.length)
          : (inner * (1 - Math.max(0.23, 1 / columns.length))) /
            (columns.length - 1)
        : inner,
    );
    const size = columns.length > 9 ? 7 : 8.5,
      leading = size + 3;
    const lines = (row: unknown[]) =>
      columns.map((_, i) => wrap(row[i], widths[i] - 10, size));
    const head = lines(columns);
    const height = (cells: string[][]) =>
      Math.max(...cells.map((cell) => cell.length)) * leading + 10;
    function print(
      cells: string[][],
      background: typeof white,
      color: typeof ink,
    ) {
      const h = height(cells);
      let x = margin;
      cells.forEach((cell, i) => {
        page.drawRectangle({
          x,
          y: y - h,
          width: widths[i],
          height: h,
          color: background,
          borderColor: grey,
          borderWidth: 0.4,
        });
        cell.forEach((line, j) =>
          draw(line, x + 5, y - 6 - size - j * leading, size, color),
        );
        x += widths[i];
      });
      y -= h;
    }
    function tableHeader() {
      const caption = wrap(name, inner, 11);
      caption.forEach((line, i) => draw(line, margin, y - 10 - i * 13, 11));
      y -= caption.length * 13 + 6;
      print(head, teal, white);
    }
    if (y < height(head) + 105) nextPage();
    tableHeader();
    rows.forEach((row, index) => {
      const cells = lines(row);
      let offset = 0;
      const length = Math.max(...cells.map((cell) => cell.length));
      while (offset < length) {
        const capacity = Math.floor((y - 53) / leading);
        if (
          capacity < 1 ||
          (offset === 0 && length > capacity && length <= 20)
        ) {
          nextPage();
          tableHeader();
        }
        const take = Math.min(
          length - offset,
          Math.max(1, Math.floor((y - 53) / leading)),
        );
        print(
          cells.map((cell) => cell.slice(offset, offset + take)),
          index % 2 ? grey : white,
          ink,
        );
        offset += take;
      }
    });
    y -= 17;
  }
  function chart(
    caption: string,
    periods: string[],
    series: { name: string; values: (number | null)[] }[],
    percent: boolean,
  ) {
    const values = series.flatMap((item) =>
      item.values.filter((value): value is number => value != null),
    );
    if (!values.length) return;
    if (y < 245) nextPage();
    const colors = [
      teal,
      rgb(0.14, 0.33, 0.72),
      rgb(0.68, 0.34, 0.04),
      rgb(0.53, 0.25, 0.64),
      rgb(0.7, 0.16, 0.35),
    ];
    const legend = series.map((item) => wrap(item.name, inner - 40, 8));
    for (const line of wrap(caption, inner, 11)) {
      if (y < 234) nextPage();
      draw(line, margin, y - 10, 11);
      y -= 14;
    }
    const upper = y - 12,
      bottom = upper - 140,
      max = percent ? 100 : Math.max(...values) || 1;
    const start = margin + 64,
      span = inner - 80;
    const x = (i: number) =>
      start + (i * span) / Math.max(1, periods.length - 1);
    const py = (value: number) => bottom + ((upper - bottom) * value) / max;
    const number = new Intl.NumberFormat('fr-FR', {
      notation: max >= 1e6 ? 'compact' : 'standard',
      maximumSignificantDigits: 4,
    });
    for (let i = 0; i <= 4; i++) {
      const value = (max * i) / 4,
        at = py(value);
      page.drawLine({
        start: { x: start, y: at },
        end: { x: x(periods.length - 1), y: at },
        thickness: 0.5,
        color: grey,
      });
      draw(number.format(value) + (percent ? ' %' : ''), margin, at - 3, 8);
    }
    periods.forEach((label, i) => draw(label, x(i) - 9, bottom - 14, 8));
    series.forEach((item, k) =>
      item.values.forEach((value, i) => {
        if (value == null) return;
        const previous = item.values[i - 1];
        if (previous != null)
          page.drawLine({
            start: { x: x(i - 1), y: py(previous) },
            end: { x: x(i), y: py(value) },
            color: colors[k],
            thickness: 1.7,
          });
        page.drawCircle({ x: x(i), y: py(value), size: 2.8, color: colors[k] });
      }),
    );
    y = bottom - 29;
    legend.forEach((lines, index) =>
      lines.forEach((line, i) => {
        if (y < 53) nextPage();
        if (i === 0)
          page.drawCircle({
            x: margin + 4,
            y: y - 5,
            size: 3,
            color: colors[index],
          });
        draw(line, margin + 15, y - 8, 8);
        y -= 12;
      }),
    );
    y -= 12;
  }
  return { note, table, chart, save: () => doc.save() };
}

export function attachment(
  bytes: Uint8Array<ArrayBuffer>,
  filename: string,
  type: 'pdf' | 'xlsx',
) {
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
