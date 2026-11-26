import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_REGION_ORDER,
  officialRegionRank,
  previousPeriod,
  regionalProgress,
  regionKey,
  sortRegionsOfficial,
} from '../src/lib/regional-progress';
import geography from '../src/lib/regions-maroc.json';

describe('Progression régionale', () => {
  it('calcule le taux et la variation pour les seuls services du périmètre', () => {
    const regions = [
      { id: 'r', name: 'Rabat-Salé-Kénitra' },
      { id: 'outside', name: 'Hors périmètre' },
    ];
    const services = ['s1', 's2'].map((id) => ({
      id,
      kind: 'PROVINCIAL',
      division: { regionId: 'r' },
    }));
    expect(
      regionalProgress(
        regions,
        services,
        new Set(['s1', 's3']),
        new Set(['s1', 's2']),
      ),
    ).toEqual([
      {
        ...regions[0],
        expected: 2,
        current: 1,
        previous: 2,
        rate: 50,
        delta: -50,
      },
    ]);
    expect(
      regionalProgress(regions, services, new Set(), null)[0],
    ).toMatchObject({ rate: 0, delta: null });
  });
  it('relie les douze contours aux libellés du référentiel VETRA', () => {
    expect(previousPeriod(2026, 1)).toEqual({ year: 2025, month: 12 });
    expect(regionKey('L’Oriental')).toBe(regionKey("L'Oriental"));
    expect(geography.regions).toHaveLength(12);
    expect(
      new Set(geography.regions.map((region) => regionKey(region.name))).size,
    ).toBe(12);
    expect(
      geography.regions.every((region) => /^M.+Z$/.test(region.path)),
    ).toBe(true);
  });
  it('classe les 12 régions dans l’ordre officiel de l’article 35 de l’ONSSA', () => {
    const shuffled = [
      { id: '12', name: 'Dakhla-Oued Ed-Dahab' },
      { id: '6', name: 'Casablanca-Settat' },
      { id: '1', name: 'Tanger-Tétouan-Al Hoceïma' },
      { id: '9', name: 'Souss-Massa' },
      { id: '2', name: "L'Oriental" },
      { id: '11', name: 'Laâyoune-Sakia El Hamra' },
      { id: '4', name: 'Rabat-Salé-Kénitra' },
      { id: '7', name: 'Marrakech-Safi' },
      { id: '3', name: 'Fès-Meknès' },
      { id: '10', name: 'Guelmim-Oued Noun' },
      { id: '5', name: 'Béni Mellal-Khénifra' },
      { id: '8', name: 'Drâa-Tafilalet' },
    ];
    expect(sortRegionsOfficial(shuffled).map((r) => r.name)).toEqual([
      ...OFFICIAL_REGION_ORDER,
    ]);
    expect(officialRegionRank('Tanger-Tétouan-Al Hoceima')).toBe(1);
    expect(officialRegionRank("L'Oriental")).toBe(2);
    expect(officialRegionRank('Laayoune-Sakia Hamra')).toBe(11);
    expect(officialRegionRank('Dakhla Oued Eddahhab')).toBe(12);
    expect(officialRegionRank('Autre région')).toBe(99);
  });
});

