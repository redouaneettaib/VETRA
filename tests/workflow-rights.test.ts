import { describe, expect, it } from 'vitest';
import {
  defaultRubricsForKind,
  effectiveRubrics,
  isValidCompletedProgression,
} from '../src/lib/forms';

describe('Habilitations par profil et progression du workflow', () => {
  it('exclut par défaut la rubrique IV pour les services provinciaux et ne garde que IV pour les frontaliers', () => {
    const provincial = defaultRubricsForKind('PROVINCIAL');
    const frontalier = defaultRubricsForKind('FRONTALIER');

    expect(provincial).toHaveLength(19);
    expect(provincial).not.toContain('IV');
    expect(frontalier).toEqual(['IV']);
  });

  it('applique strictement les habilitations configurées par Admin et masque toute rubrique/section non allouée', () => {
    const customProvincial = effectiveRubrics(
      [
        { rubricId: 'I.A.1', enabled: true },
        { rubricId: 'I.A.2', enabled: true },
        { rubricId: 'I.A.3', enabled: false },
        { rubricId: 'IV', enabled: false },
        { rubricId: 'V', enabled: true },
      ],
      'PROVINCIAL',
    );
    expect(customProvincial).toEqual(['I.A.1', 'I.A.2', 'V']);

    // Aucun droit enregistré en base → défaut cohérent selon le type de service
    expect(effectiveRubrics([], 'PROVINCIAL')).not.toContain('IV');
    expect(effectiveRubrics([], 'FRONTALIER')).toEqual(['IV']);

    // Toutes les rubriques explicitement désactivées par Admin → aucune rubrique visible
    expect(
      effectiveRubrics(
        [{ rubricId: 'I.A.1', enabled: false }],
        'PROVINCIAL',
      ),
    ).toEqual([]);
  });

  it('valide la progression séquentielle tout en préservant les rubriques déjà complétées après changement d’habilitations', () => {
    const expected = ['I.A.1', 'I.A.2', 'I.A.3', 'I.A.4', 'V'];

    // Progression normale étape par étape
    expect(isValidCompletedProgression(expected, [], ['I.A.1'])).toBe(true);
    expect(
      isValidCompletedProgression(expected, ['I.A.1'], ['I.A.1', 'I.A.2']),
    ).toBe(true);

    // Interdiction de sauter une étape non complétée
    expect(
      isValidCompletedProgression(expected, ['I.A.1'], ['I.A.1', 'I.A.3']),
    ).toBe(false);

    // Interdiction d'inclure une rubrique non habilitée (ex: IV)
    expect(
      isValidCompletedProgression(expected, ['I.A.1'], ['I.A.1', 'IV']),
    ).toBe(false);

    // Si Admin active I.A.3 après que I.A.4 a déjà été complétée :
    // sauvegarder l'existant reste valide, et compléter I.A.3 débloque la suite sans perdre I.A.4
    expect(
      isValidCompletedProgression(
        expected,
        ['I.A.1', 'I.A.2', 'I.A.4'],
        ['I.A.1', 'I.A.2', 'I.A.4'],
      ),
    ).toBe(true);
    expect(
      isValidCompletedProgression(
        expected,
        ['I.A.1', 'I.A.2', 'I.A.4'],
        ['I.A.1', 'I.A.2', 'I.A.3', 'I.A.4'],
      ),
    ).toBe(true);
    // Toujours interdit de sauter I.A.3 pour aller directement à V
    expect(
      isValidCompletedProgression(
        expected,
        ['I.A.1', 'I.A.2', 'I.A.4'],
        ['I.A.1', 'I.A.2', 'I.A.4', 'V'],
      ),
    ).toBe(false);
  });
});
