import type { KeyboardEvent } from 'react';
import { Inbox, Plus, Sigma, Trash2 } from 'lucide-react';
import {
  calculate,
  columnLabel,
  dynamicFields,
  formulas,
  labelAt,
  numericCells,
  readNumber,
  rowHeading,
  tables,
} from '@/lib/forms';

type Values = Record<string, any>;
type Entry = { rubric: string; values: (string | number)[] };
type Group = (typeof tables)[string][number];

function isTotalRow(group: Group, row: number) {
  if (rowHeading(row)) return false;
  const cols = Array.from(group.editableColumns);
  return cols.length > 0 && cols.every((col) => Boolean(formulas[col + row]));
}

function isTotalColumn(group: Group, column: string) {
  const dataRows = group.rows.filter((r) => !rowHeading(r));
  return (
    dataRows.length > 0 && dataRows.every((r) => Boolean(formulas[column + r]))
  );
}

function focusNextInput(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key !== 'Enter') return;
  const container = event.currentTarget.closest('table, section');
  if (!container) return;
  const inputs = Array.from(
    container.querySelectorAll<HTMLInputElement>(
      'input:not([disabled]):not([type="hidden"])',
    ),
  );
  const idx = inputs.indexOf(event.currentTarget);
  if (idx >= 0 && idx + 1 < inputs.length) {
    event.preventDefault();
    inputs[idx + 1].focus();
    inputs[idx + 1].select();
  }
}

export default function CanevasTable({
  rubric,
  values,
  setValues,
  editable,
}: {
  rubric: string;
  values: Values;
  setValues: (update: (old: Values) => Values) => void;
  editable: boolean;
}) {
  const fields = dynamicFields[rubric];
  const entries: Entry[] = Array.isArray(values.__tables)
    ? values.__tables
    : [];

  if (fields) {
    const rubricEntries = entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.rubric === rubric);

    function edit(index: number, update?: Entry) {
      setValues((old) => ({
        ...old,
        __tables:
          index === entries.length && update
            ? [...entries, update]
            : entries.flatMap((entry, i) =>
                i !== index ? [entry] : update ? [update] : [],
              ),
      }));
    }

    return (
      <section className="vetra-dynamic-wrap">
        <div className="vetra-dynamic-toolbar">
          <div className="vetra-table-meta">
            <span>
              {rubricEntries.length}{' '}
              {rubricEntries.length > 1
                ? 'lignes enregistrées'
                : 'ligne enregistrée'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Saisie libre structurée</span>
          </div>
          {editable && (
            <button
              type="button"
              className="vetra-dynamic-add"
              disabled={entries.length >= 200}
              onClick={() =>
                edit(entries.length, { rubric, values: fields.map(() => '') })
              }
            >
              <Plus size={16} aria-hidden="true" />
              <span>Ajouter une ligne</span>
            </button>
          )}
        </div>

        {rubricEntries.length === 0 && (
          <div className="vetra-dynamic-empty">
            <span className="vetra-dynamic-empty-icon" aria-hidden="true">
              <Inbox size={20} />
            </span>
            <div>
              <p className="font-semibold text-slate-800">
                Aucune ligne renseignée pour cette rubrique
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {editable
                  ? 'Cliquez sur « Ajouter une ligne » pour saisir une déclaration ou laissez vide si aucune activité n’est à signaler.'
                  : 'Aucune déclaration n’a été saisie pour cette période.'}
              </p>
            </div>
            {editable && (
              <button
                type="button"
                className="vetra-dynamic-add"
                disabled={entries.length >= 200}
                onClick={() =>
                  edit(entries.length, { rubric, values: fields.map(() => '') })
                }
              >
                <Plus size={16} aria-hidden="true" />
                <span>Ajouter une première ligne</span>
              </button>
            )}
          </div>
        )}

        {rubricEntries.map(({ entry, index }, displayIdx) => (
          <fieldset key={index} className="vetra-dynamic-card">
            <div className="vetra-dynamic-card-head">
              <legend className="vetra-dynamic-legend">
                Déclaration #{displayIdx + 1}
              </legend>
              {editable && (
                <button
                  type="button"
                  className="vetra-dynamic-remove"
                  onClick={() => edit(index)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  <span>Supprimer</span>
                </button>
              )}
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3 p-4">
              {fields.map((field, j) => (
                <label className="vetra-dyn-field" key={field.label}>
                  <span>{field.label}</span>
                  <input
                    disabled={!editable}
                    type={field.kind}
                    min={0}
                    step={
                      field.kind === 'number'
                        ? rubric === 'I.D' || j === 0
                          ? 1
                          : 'any'
                        : undefined
                    }
                    value={entry.values[j] ?? ''}
                    onWheel={
                      field.kind === 'number'
                        ? (e) => e.currentTarget.blur()
                        : undefined
                    }
                    onKeyDown={focusNextInput}
                    onChange={(event) => {
                      const next = fields.map((_, i) =>
                        i === j ? event.target.value : (entry.values[i] ?? ''),
                      );
                      edit(index, { ...entry, values: next });
                    }}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {(tables[rubric] || []).map((group) => {
        const columns = Array.from(group.columns);
        const editableSet = new Set(Array.from(group.editableColumns));
        const totalCols = new Set(
          columns.filter((col) => isTotalColumn(group, col)),
        );
        const totalRows = group.rows.filter((r) => isTotalRow(group, r));
        const totalRowSet = new Set(totalRows);
        const grandTotalRowSet = new Set(
          totalRows.filter((row) => {
            if (totalRows.length === 1) return true;
            return Array.from(group.editableColumns).some((col) => {
              const expr = formulas[col + row] || '';
              return totalRows.some(
                (other) => other !== row && expr.includes(col + other),
              );
            });
          }),
        );

        const isMultiCategoryTable =
          columns.length >= 3 &&
          columns[0] === 'A' &&
          columns[1] === 'B' &&
          !editableSet.has('A') &&
          !editableSet.has('B');

        const categoryByRow = new Map<number, string>();
        let activeCategory = '';
        for (const r of group.rows) {
          if (rowHeading(r)) continue;
          const catText = labelAt('A' + r);
          if (catText && !totalRowSet.has(r)) {
            activeCategory = catText;
          }
          if (activeCategory) {
            categoryByRow.set(r, activeCategory);
          }
        }

        let editableCount = 0;
        let filledCount = 0;
        let formulaCount = 0;
        for (const r of group.rows) {
          if (rowHeading(r)) continue;
          for (const c of group.editableColumns) {
            const addr = c + r;
            if (formulas[addr]) {
              formulaCount += 1;
            } else if (numericCells.has(addr)) {
              editableCount += 1;
              if (readNumber(values[addr]) !== undefined) filledCount += 1;
            }
          }
        }

        return (
          <section key={group.title} className="vetra-table-card">
            <div className="vetra-table-card-head">
              <h3 className="vetra-table-card-title">{group.title}</h3>
              <div className="vetra-table-meta">
                {editableCount > 0 && (
                  <span className="tabular-nums">
                    <strong className="text-slate-800">{filledCount}</strong> /{' '}
                    {editableCount} champs renseignés
                  </span>
                )}
                {editableCount > 0 && formulaCount > 0 && (
                  <span aria-hidden="true">·</span>
                )}
                {formulaCount > 0 && (
                  <span className="vetra-table-auto-hint">
                    <Sigma size={13} aria-hidden="true" />
                    <span>Totaux calculés automatiquement</span>
                  </span>
                )}
              </div>
            </div>

            <div className="scroll vetra-entry-scroll">
              <table className="vetra-data-table vetra-entry-table">
                <thead>
                  <tr>
                    {columns.map((column) => {
                      const isNumericCol = editableSet.has(column);
                      const isTotCol = totalCols.has(column);
                      return (
                        <th
                          key={column}
                          scope="col"
                          className={[
                            isNumericCol ? 'is-num-col' : 'is-text-col',
                            isTotCol ? 'is-total-col-head' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <span className="vetra-th-inner">
                            {isTotCol && (
                              <Sigma
                                size={13}
                                className="vetra-th-sigma"
                                aria-hidden="true"
                              />
                            )}
                            <span>{columnLabel(group, column)}</span>
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => {
                    if (rowHeading(row)) {
                      return (
                        <tr key={row} className="vetra-row-heading">
                          <th scope="row" colSpan={columns.length}>
                            {labelAt('A' + row)}
                          </th>
                        </tr>
                      );
                    }

                    const rowIsTotal = totalRowSet.has(row);
                    const rowIsGrand = grandTotalRowSet.has(row);
                    const rowIsSubtotal = rowIsTotal && !rowIsGrand;
                    const startsCategory =
                      isMultiCategoryTable &&
                      !rowIsTotal &&
                      Boolean(labelAt('A' + row));

                    const rowClass = [
                      rowIsGrand
                        ? 'vetra-row-grand-total'
                        : rowIsSubtotal
                          ? 'vetra-row-subtotal'
                          : 'vetra-row-entry',
                      startsCategory ? 'vetra-row-cat-start' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');

                    const rowFirstLabelCol = columns.find(
                      (c) => !formulas[c + row] && !numericCells.has(c + row) && Boolean(labelAt(c + row)),
                    );

                    return (
                      <tr key={row} className={rowClass}>
                        {columns.map((column, colIdx) => {
                          const address = column + row;
                          const field = numericCells.get(address);
                          const colIsTotal = totalCols.has(column);
                          const colLabel = columnLabel(group, column);

                          if (formulas[address]) {
                            const result = calculate(address, values);
                            const hasResult = result !== undefined;
                            const isIntersection = rowIsGrand && colIsTotal;
                            const outputClass = [
                              'vetra-total-output',
                              isIntersection
                                ? 'is-intersection'
                                : rowIsGrand
                                  ? 'is-grand'
                                  : rowIsSubtotal
                                    ? 'is-subtotal'
                                    : 'is-col-total',
                              hasResult ? 'has-value' : 'is-empty',
                            ].join(' ');

                            return (
                              <td
                                key={address}
                                data-label={colLabel}
                                className={[
                                  'is-num-col',
                                  'vetra-cell-formula',
                                  colIsTotal ? 'vetra-cell-total-col' : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                              >
                                <output
                                  className={outputClass}
                                  aria-label={`Total calculé — ${colLabel}`}
                                >
                                  {hasResult
                                    ? result.toLocaleString('fr-FR')
                                    : '—'}
                                </output>
                              </td>
                            );
                          }

                          if (!field) {
                            const rawText = labelAt(address);
                            const recallCategory =
                              isMultiCategoryTable &&
                              rowIsSubtotal &&
                              colIdx === 0 &&
                              !rawText
                                ? categoryByRow.get(row) || ''
                                : '';
                            const isPrimaryTotalLabelCell =
                              rowIsTotal && column === rowFirstLabelCol;
                            const cleanTotalText =
                              isPrimaryTotalLabelCell &&
                              isMultiCategoryTable &&
                              /^total\s*:?$/i.test(rawText)
                                ? 'Sous-total'
                                : rawText.replace(/\s*:\s*$/, '');

                            return (
                              <td
                                key={address}
                                data-label={colLabel}
                                className={[
                                  'is-text-col',
                                  isMultiCategoryTable &&
                                  colIdx === 0 &&
                                  rawText &&
                                  !rowIsTotal
                                    ? 'vetra-cat-cell'
                                    : '',
                                  recallCategory ? 'vetra-total-cat-recall' : '',
                                  isPrimaryTotalLabelCell
                                    ? 'vetra-total-label-cell'
                                    : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                              >
                                {isPrimaryTotalLabelCell ? (
                                  <span className="vetra-total-label">
                                    <Sigma
                                      size={14}
                                      className="vetra-total-sigma"
                                      aria-hidden="true"
                                    />
                                    <span>{cleanTotalText || 'Total'}</span>
                                  </span>
                                ) : recallCategory ? (
                                  <span>{recallCategory}</span>
                                ) : (
                                  rawText
                                )}
                              </td>
                            );
                          }

                          const rawVal = values[address] ?? '';
                          const isFilled =
                            rawVal !== '' &&
                            rawVal !== null &&
                            rawVal !== undefined;
                          const isUnitsCell =
                            /^(?:[GH]76|[CD](?:199|247))$/.test(address);
                          const unitBadge = isUnitsCell
                            ? 'unités'
                            : field.percent
                              ? '%'
                              : '';

                          return (
                            <td
                              key={address}
                              data-label={colLabel}
                              className="is-num-col vetra-cell-input"
                            >
                              <div className="vetra-input-wrap">
                                <input
                                  aria-label={field.label}
                                  disabled={!editable}
                                  type="number"
                                  inputMode={
                                    field.integer ? 'numeric' : 'decimal'
                                  }
                                  min={0}
                                  max={field.percent ? 100 : undefined}
                                  step={field.integer ? 1 : 'any'}
                                  placeholder={editable ? '0' : '—'}
                                  className={[
                                    'vetra-num-input',
                                    isFilled ? 'is-filled' : '',
                                    unitBadge ? 'has-unit' : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                  value={rawVal}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  onKeyDown={focusNextInput}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setValues((old) => ({
                                      ...old,
                                      [address]: value,
                                    }));
                                  }}
                                />
                                {unitBadge && (
                                  <span
                                    className="vetra-input-unit"
                                    aria-hidden="true"
                                  >
                                    {unitBadge}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
