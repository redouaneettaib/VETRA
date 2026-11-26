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
    .replace(/^loriental$/, 'oriental')
    .replace(/^sousmassa$/, 'soussmassa')
    .replace(/^laayounesakia(el|l)?hamra$/, 'laayounesakiaelhamra')
    .replace(/^dakhlaouededdahhab$/, 'dakhlaouededdahab');

/**
 * Ordre des 12 Directions Régionales affiché dans le reporting VETRA.
 */
export const OFFICIAL_REGION_ORDER = [
  'Rabat-Salé-Kénitra',
  'Tanger-Tétouan-Al Hoceïma',
  'Casablanca-Settat',
  "L'Oriental",
  'Drâa-Tafilalet',
  'Souss-Massa',
  'Laâyoune-Sakia El Hamra',
  'Marrakech-Safi',
  'Béni Mellal-Khénifra',
  'Fès-Meknès',
  'Dakhla-Oued Ed-Dahab',
  'Guelmim-Oued Noun',
] as const;

const OFFICIAL_REGION_RANK = new Map<string, number>(
  OFFICIAL_REGION_ORDER.map((name, index) => [regionKey(name), index + 1]),
);

export const officialRegionRank = (name: string) =>
  OFFICIAL_REGION_RANK.get(regionKey(name)) ?? 99;

export function sortRegionsOfficial<T extends { name: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) =>
      officialRegionRank(a.name) - officialRegionRank(b.name) ||
      a.name.localeCompare(b.name, 'fr'),
  );
}

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
