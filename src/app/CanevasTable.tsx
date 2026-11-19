import {
  calculate,
  columnLabel,
  dynamicFields,
  formulas,
  labelAt,
  numericCells,
  rowHeading,
  tables,
} from '@/lib/forms';

type Values = Record<string, any>;
type Entry = { rubric: string; values: (string | number)[] };

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
      <section className="space-y-4">
        {!entries.some((entry) => entry.rubric === rubric) && (
          <p>Aucune ligne renseignée.</p>
        )}
        {entries.map(
          (entry, index) =>
            entry.rubric === rubric && (
              <fieldset key={index} className="rounded-xl border p-4">
                <legend className="px-2 font-semibold">
                  Ligne{' '}
                  {
                    entries
                      .slice(0, index + 1)
                      .filter((item) => item.rubric === rubric).length
                  }
                </legend>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {fields.map((field, j) => (
                    <label className="field text-sm" key={field.label}>
                      {field.label}
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
                        onChange={(event) => {
                          const next = fields.map((_, i) =>
                            i === j
                              ? event.target.value
                              : (entry.values[i] ?? ''),
                          );
                          edit(index, { ...entry, values: next });
                        }}
                      />
                    </label>
                  ))}
                </div>
                {editable && (
                  <button className="btn red mt-4" onClick={() => edit(index)}>
                    Supprimer la ligne
                  </button>
                )}
              </fieldset>
            ),
        )}
        {editable && (
          <button
            className="btn alt"
            disabled={entries.length >= 200}
            onClick={() =>
              edit(entries.length, { rubric, values: fields.map(() => '') })
            }
          >
            Ajouter une ligne
          </button>
        )}
      </section>
    );
  }
  return (
    <div className="space-y-5">
      {(tables[rubric] || []).map((group) => (
        <section
          key={group.title}
          className="rounded-xl border overflow-hidden"
        >
          <h3 className="font-bold bg-slate-100 px-4 py-3">{group.title}</h3>
          <div className="scroll">
            <table className="vetra-data-table">
              <thead>
                <tr>
                  {Array.from(group.columns).map((column) => (
                    <th key={column} scope="col">
                      {columnLabel(group, column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) =>
                  rowHeading(row) ? (
                    <tr key={row}>
                      <th scope="row" colSpan={group.columns.length}>
                        {labelAt('A' + row)}
                      </th>
                    </tr>
                  ) : (
                    <tr key={row}>
                      {Array.from(group.columns).map((column) => {
                        const address = column + row;
                        const field = numericCells.get(address);
                        const result = calculate(address, values);
                        if (formulas[address])
                          return (
                            <td key={address}>
                              <output>
                                {result?.toLocaleString('fr-FR') ?? '—'}
                              </output>
                            </td>
                          );
                        if (!field)
                          return (
                            <td
                              key={address}
                              data-label={columnLabel(group, column)}
                            >
                              {labelAt(address)}
                            </td>
                          );
                        return (
                          <td
                            key={address}
                            data-label={columnLabel(group, column)}
                          >
                            <input
                              aria-label={field.label}
                              disabled={!editable}
                              type="number"
                              min={0}
                              max={field.percent ? 100 : undefined}
                              step={field.integer ? 1 : 'any'}
                              value={values[address] ?? ''}
                              onChange={(event) => {
                                const value = event.target.value;
                                setValues((old) => ({
                                  ...old,
                                  [address]: value,
                                }));
                              }}
                            />
                            {/^(?:[GH]76|[CD](?:199|247))$/.test(address) && (
                              <span className="block text-xs text-slate-600">
                                unités
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
