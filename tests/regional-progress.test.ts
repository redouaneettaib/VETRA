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
  it('classe les 12 régions dans l’ordre défini pour VETRA', () => {
    const shuffled = [
      { id: '11', name: 'Dakhla-Oued Ed-Dahab' },
      { id: '3', name: 'Casablanca-Settat' },
      { id: '2', name: 'Tanger-Tétouan-Al Hoceïma' },
      { id: '6', name: 'Souss-Massa' },
      { id: '4', name: "L'Oriental" },
      { id: '7', name: 'Laâyoune-Sakia El Hamra' },
      { id: '1', name: 'Rabat-Salé-Kénitra' },
      { id: '8', name: 'Marrakech-Safi' },
      { id: '10', name: 'Fès-Meknès' },
      { id: '12', name: 'Guelmim-Oued Noun' },
      { id: '9', name: 'Béni Mellal-Khénifra' },
      { id: '5', name: 'Drâa-Tafilalet' },
    ];
    expect(sortRegionsOfficial(shuffled).map((r) => r.name)).toEqual([
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
    ]);
    expect(sortRegionsOfficial(shuffled).map((r) => r.name)).toEqual([
      ...OFFICIAL_REGION_ORDER,
    ]);
    expect(officialRegionRank('Rabat-Salé-Kénitra')).toBe(1);
    expect(officialRegionRank('Tanger - Tétouan - Al Hoceima')).toBe(2);
    expect(officialRegionRank('Oriental')).toBe(4);
    expect(officialRegionRank('Sous Massa')).toBe(6);
    expect(officialRegionRank('Laayoune - Sakia - Lhamra')).toBe(7);
    expect(officialRegionRank('Dakhla - Oued Eddahab')).toBe(11);
    expect(officialRegionRank('Guelmim - Oued Noun')).toBe(12);
    expect(officialRegionRank('Autre région')).toBe(99);
  });
});

