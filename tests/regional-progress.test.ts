import { describe, expect, it } from 'vitest';
import {
  previousPeriod,
  regionalProgress,
  regionKey,
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
});
