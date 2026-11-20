export type Region = { id: string; name: string };
export type RegionalService = {
  id: string;
  division: { regionId: string };
  kind: string;
};
export const previousPeriod = (year: number, month: number) =>
  month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
export const regionKey = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/^loriental$/, 'oriental');

export function regionalProgress(
  regions: Region[],
  services: RegionalService[],
  currentIds: Set<string>,
  previousIds: Set<string> | null,
) {
  const totals = new Map<
    string,
    { expected: number; current: number; previous: number }
  >();
  for (const service of services) {
    const id = service.division.regionId;
    const row = totals.get(id) ?? { expected: 0, current: 0, previous: 0 };
    row.expected++;
    if (currentIds.has(service.id)) row.current++;
    if (previousIds?.has(service.id)) row.previous++;
    totals.set(id, row);
  }
  return regions.flatMap((region) => {
    const count = totals.get(region.id);
    if (!count) return [];
    const percent = (value: number) => {
      if (value === 0) return 0;
      if (value === count.expected) return 100;
      return Math.max(1, Math.min(99, Math.round((value / count.expected) * 100)));
    };
    const rate = percent(count.current);
    return [
      {
        ...region,
        ...count,
        rate,
        delta: previousIds === null ? null : rate - percent(count.previous),
      },
    ];
  });
}
