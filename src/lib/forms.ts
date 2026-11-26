import { CANEVAS, RUBRICS, rubricForRow } from './canevas';
import sourceFormulas from './casa-formulas.json';

type Table = {
  title: string;
  columns: string;
  heading: number;
  rows: number[];
  editableColumns: string;
};

const range = (first: number, last: number) =>
  Array.from({ length: last - first + 1 }, (_, i) => first + i);
const table = (
  title: string,
  columns: string,
  heading: number,
  rows: number[],
  editableColumns = columns.slice(1),
): Table => ({ title, columns, heading, rows, editableColumns });

export const tables: Record<string, Table[]> = {
  'I.A.1': [table('Abattage et saisies', 'ABCDEFGH', 8, range(9, 13))],
  'I.A.2': [table('Viandes foraines', 'ABCD', 16, range(17, 20))],
  'I.A.3': [table('Abattage en établissement', 'ABCDE', 23, range(24, 30))],
  'I.A.4': [table('Lapins', 'ABCDE', 33, [34])],
  'I.A.5': [table('Contrôles par catégorie', 'ABCD', 37, range(38, 46))],
  'I.A.6': [
    table('Procès-verbaux par produit', 'ABCDEFGHI', 49, range(50, 56)),
  ],
  'I.A.7': [table('Certificats et laissez-passer', 'AB', 59, range(60, 62))],
  'I.B.1': [
    table('Compteur de sorties', 'ABC', 67, [68], 'ABC'),
    table('Points de vente contrôlés', 'DE', 67, range(68, 78)),
    table('Produits contrôlés', 'FGH', 67, range(68, 78)),
  ],
  'I.B.2': [
    table('Procès-verbaux des commissions', 'ABCDEFGH', 81, range(82, 88)),
  ],
  'I.C.1': [table('Types de restaurants', 'ABCD', 92, range(93, 110))],
  'I.C.2': [
    table('Produits contrôlés par lieu', 'ABCDEFGHIJ', 113, range(114, 116)),
  ],
  'I.D': [],
  'II.A': [table('Inspections par établissement', 'AB', 125, range(126, 153))],
  'II.B': [table('Dossiers déposés et traités', 'ABC', 159, [160])],
  'II.C': [],
  III: [table('Certificats délivrés', 'AB', 174, range(175, 177))],
  IV: [
    table('Produits importés', 'ABCD', 181, range(182, 217), 'CD'),
    table('Dossiers et certificats', 'AB', 219, range(220, 226)),
  ],
  V: [
    table('Produits exportés', 'ABCD', 229, range(230, 265), 'CD'),
    table('Dossiers d’exportation', 'AB', 267, range(268, 272)),
  ],
  'VI.A': [table('Prélèvements par plan', 'ABC', 276, range(277, 293), 'C')],
  'VI.B': [
    table('Prélèvements et analyses', 'ABCDEFGHIJ', 296, range(297, 306)),
    table(
      'Taux de non-conformité par produit (%)',
      'AKLM',
      296,
      range(297, 305),
    ),
    table('Taux de non-conformité global (%)', 'ABC', 309, [310], 'ABC'),
  ],
};

const headings = new Set([93, 103, 126, 136, 142, 145, 151]);
const source = Object.assign({}, ...CANEVAS.map((row) => row.cells)) as Record<
  string,
  string | number
>;
export const formulas: Record<string, string> = { ...sourceFormulas };
delete formulas.K306;
delete formulas.L306;
delete formulas.M306;

export const labelAt = (address: string) =>
  typeof source[address] === 'string' ? String(source[address]).trim() : '';
export const columnLabel = (group: Table, column: string) =>
  labelAt(column + group.heading) ||
  (group.heading === 296 && column === 'B' ? labelAt('B295') : 'Indicateur');
export const rowHeading = (row: number) => headings.has(row);
export const numericCells = new Map<
  string,
  { rubric: string; label: string; percent: boolean; integer: boolean }
>();
export const calculatedCells = new Map<
  string,
  { rubric: string; label: string }
>();
for (const [rubric, groups] of Object.entries(tables)) {
  for (const group of groups) {
    for (const row of group.rows) {
      if (rowHeading(row)) continue;
      const rowLabel = Array.from(group.columns)
        .map((c) => labelAt(c + row))
        .filter(Boolean)
        .join(' · ');
      for (const column of group.editableColumns) {
        const address = column + row;
        const header = columnLabel(group, column);
        const displayHeader = /^(?:[GH]76|[CD](?:199|247))$/.test(address)
          ? header.replace(/\(kg\)/i, '(unités)')
          : header;
        const caption =
          (rubric === 'VI.B' && group.heading !== 296) ||
          (rubric === 'VI.B' && 'KLM'.includes(column))
            ? group.title
            : '';
        const label = [rowLabel, caption, displayHeader]
          .filter(Boolean)
          .join(' — ');
        const percent =
          rubric === 'VI.B' && (row === 310 || 'KLM'.includes(column));
        const quantity =
          /quantit|tonnage|saisies? .*kg/i.test(header) ||
          (rubric === 'I.A.1' ? row !== 9 : rubric === 'I.C.2');
        if (formulas[address]) calculatedCells.set(address, { rubric, label });
        else if (!labelAt(address))
          numericCells.set(address, {
            rubric,
            label,
            percent,
            integer: !percent && (!quantity || [76, 199, 247].includes(row)),
          });
      }
    }
  }
}

export function readNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim()))
    return;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

export function calculate(
  address: string,
  data: Record<string, unknown>,
): number | undefined {
  const formula = formulas[address];
  if (!formula) return readNumber(data[address]);
  const sum = /^SUM\(([A-Z])(\d+):([A-Z])(\d+)\)$/.exec(formula);
  const refs = sum
    ? range(Number(sum[2]), Number(sum[4])).flatMap((row) =>
        range(sum[1].charCodeAt(0), sum[3].charCodeAt(0)).map(
          (column) => String.fromCharCode(column) + row,
        ),
      )
    : formula.split('+');
  const values = refs.map((ref) => calculate(ref, data));
  return values.every((value) => value === undefined)
    ? undefined
    : Number(
        values
          .reduce<number>((total, value) => total + (value ?? 0), 0)
          .toPrecision(14),
      );
}

export const dynamicFields: Record<
  string,
  { label: string; kind: 'number' | 'text' | 'date' }[]
> = Object.fromEntries(
  [
    ['I.D', 119, 'ABCD', 'ABC'],
    ['II.C', 166, 'ABCDEFGHIJKLMN', 'ACHIJ'],
  ].map(([id, row, columns, numbers]) => [
    id,
    Array.from(String(columns)).map((column) => ({
      label: labelAt(column + String(row)),
      kind:
        id === 'II.C' && column === 'D'
          ? 'date'
          : String(numbers).includes(column)
            ? 'number'
            : 'text',
    })),
  ]),
);

export const rubricIds = RUBRICS.map(([id]) => id);
export function enabledRubrics(
  rights: { rubricId: string; enabled: boolean }[],
) {
  return rubricIds.filter(
    (id) =>
      !rights.length ||
      rights.some((right) => right.rubricId === id && right.enabled),
  );
}
export function defaultRubricsForKind(kind?: string | null) {
  return rubricIds.filter((id) =>
    kind === 'FRONTALIER' ? id === 'IV' : id !== 'IV',
  );
}
export function effectiveRubrics(
  rights: { rubricId: string; enabled: boolean }[],
  kind?: string | null,
) {
  if (!rights.length) {
    return kind ? defaultRubricsForKind(kind) : [...rubricIds];
  }
  return rubricIds.filter((id) =>
    rights.some((right) => right.rubricId === id && right.enabled),
  );
}
export function isValidCompletedProgression(
  expected: readonly string[],
  previousCompleted: readonly string[],
  nextCompleted: readonly string[],
) {
  if (new Set(nextCompleted).size !== nextCompleted.length) return false;
  if (nextCompleted.some((id) => !expected.includes(id))) return false;
  const prevValid = new Set(
    previousCompleted.filter((id) => expected.includes(id)),
  );
  // Every newly completed step must be unlocked in order (no jumping past earlier uncompleted steps)
  const working = new Set(prevValid);
  const newlyAdded = expected.filter(
    (id) => nextCompleted.includes(id) && !prevValid.has(id),
  );
  for (const id of newlyAdded) {
    const firstMissing = expected.find((candidate) => !working.has(candidate));
    if (firstMissing !== id) return false;
    working.add(id);
  }
  return true;
}
export function cellRubric(address: string) {
  return rubricForRow(Number(/\d+$/.exec(address)?.[0]));
}

export function reportCompletionPercent(
  report: { status?: string; data?: unknown } | null | undefined,
  rights: { rubricId: string; enabled: boolean }[] = [],
  kind?: string | null,
): number {
  if (!report) return 0;
  const permitted = effectiveRubrics(rights, kind);
  if (!permitted.length) return 0;
  if (report.status === 'VALIDE' || report.status === 'SOUMIS') return 100;
  const rawData =
    report.data && typeof report.data === 'object' && !Array.isArray(report.data)
      ? (report.data as Record<string, unknown>)
      : {};
  const stored = Array.isArray(rawData.__completed)
    ? rawData.__completed.map(String)
    : [];
  const validCount = permitted.filter((id) => stored.includes(id)).length;
  return Math.round((validCount / permitted.length) * 100);
}

