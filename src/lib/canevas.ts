import rows from './casa.json';

export const CANEVAS = rows as unknown as {
  row: number;
  cells: Record<string, string | number | undefined>;
}[];
const rubricRanges = [
  ['I.A.1', 7, 14],
  ['I.A.2', 15, 21],
  ['I.A.3', 22, 31],
  ['I.A.4', 32, 35],
  ['I.A.5', 36, 47],
  ['I.A.6', 48, 57],
  ['I.A.7', 58, 63],
  ['I.B.1', 65, 79],
  ['I.B.2', 80, 89],
  ['I.C.1', 91, 111],
  ['I.C.2', 112, 117],
  ['I.D', 118, 122],
  ['II.A', 124, 157],
  ['II.B', 158, 163],
  ['II.C', 164, 172],
  ['III', 173, 179],
  ['IV', 180, 227],
  ['V', 228, 273],
  ['VI.A', 275, 293],
  ['VI.B', 294, 310],
] as const;
export type RubricId = (typeof rubricRanges)[number][0];
export const RUBRICS = rubricRanges.map(([id, start, end]) => {
  const original = CANEVAS.find((row) => row.row === start)?.cells['A' + start];
  if (typeof original !== 'string')
    throw Error('Intitulé du canevas manquant : ' + id);
  const title = original
    .trim()
    .replace(/^(?:\d+\s*-|[IVX]+\s*\/|[A-Z]\s*\/)\s*/, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*:\s*$/, '');
  return [id, start, end, title] as const;
});
export const rubricForRow = (row: number) =>
  RUBRICS.find(([, a, b]) => row >= a && row <= b)?.[0];
export const unitFor = (row: number, label: string) =>
  /OVO\s*PRODUITS|Œufs de consommation \(unités\)/i.test(label)
    ? 'unités'
    : /viandes|abats/i.test(label) && row >= 180 && row <= 273
      ? 'kg'
      : undefined;
