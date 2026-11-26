import type { Kind, Status } from '@prisma/client';
import { buildDcspDemoReportData } from './demo-dcsp';
import type { RubricId } from './canevas';

export const REGION_NAMES = [
  'Rabat-Salé-Kénitra',
  'Casablanca-Settat',
  'Fès-Meknès',
  'Tanger-Tétouan-Al Hoceïma',
  'Marrakech-Safi',
  'Béni Mellal-Khénifra',
  'Drâa-Tafilalet',
  'Souss-Massa',
  'Guelmim-Oued Noun',
  'Laâyoune-Sakia El Hamra',
  'Dakhla-Oued Ed-Dahab',
  'L’Oriental',
] as const;

export type RegionName = (typeof REGION_NAMES)[number];

export type PresentationServiceSeed = {
  id: string;
  name: string;
  kind: Kind;
  regionName: RegionName;
};

export type PresentationChefAccountSeed = {
  id: string;
  firstName: string;
  name: string;
  email: string;
  phone: string;
  serviceId: string;
  regionName: RegionName;
};

/**
 * 43 services vétérinaires répartis sur les 12 directions régionales (3 à 4
 * services par région) afin de permettre de véritables pourcentages régionaux
 * intermédiaires (25 %, 33 %, 50 %, 67 %, 75 %, 100 %) sur la carte du Maroc
 * et dans le reporting officiel.
 */
export const PRESENTATION_SERVICES: readonly PresentationServiceSeed[] = [
  // Casablanca-Settat (4)
  {
    id: 'srv-dcsp-casa',
    name: 'Service vétérinaire de la DCSP de Casablanca',
    kind: 'FRONTALIER',
    regionName: 'Casablanca-Settat',
  },
  {
    id: 'srv-pref-casa',
    name: 'Service vétérinaire préfectoral de Casablanca',
    kind: 'PROVINCIAL',
    regionName: 'Casablanca-Settat',
  },
  {
    id: 'srv-el-jadida',
    name: "Service vétérinaire d'El Jadida",
    kind: 'PROVINCIAL',
    regionName: 'Casablanca-Settat',
  },
  {
    id: 'srv-mohammedia',
    name: 'Service vétérinaire provincial de Mohammedia',
    kind: 'PROVINCIAL',
    regionName: 'Casablanca-Settat',
  },

  // Rabat-Salé-Kénitra (4)
  {
    id: 'srv-kenitra',
    name: 'Service vétérinaire provincial de Kénitra',
    kind: 'PROVINCIAL',
    regionName: 'Rabat-Salé-Kénitra',
  },
  {
    id: 'srv-rabat',
    name: 'Service vétérinaire préfectoral de Rabat',
    kind: 'PROVINCIAL',
    regionName: 'Rabat-Salé-Kénitra',
  },
  {
    id: 'srv-sale',
    name: 'Service vétérinaire préfectoral de Salé',
    kind: 'PROVINCIAL',
    regionName: 'Rabat-Salé-Kénitra',
  },
  {
    id: 'srv-khemisset',
    name: 'Service vétérinaire provincial de Khémisset',
    kind: 'PROVINCIAL',
    regionName: 'Rabat-Salé-Kénitra',
  },

  // Fès-Meknès (4)
  {
    id: 'srv-fes',
    name: 'Service vétérinaire provincial de Fès',
    kind: 'PROVINCIAL',
    regionName: 'Fès-Meknès',
  },
  {
    id: 'srv-meknes',
    name: 'Service vétérinaire préfectoral de Meknès',
    kind: 'PROVINCIAL',
    regionName: 'Fès-Meknès',
  },
  {
    id: 'srv-taza',
    name: 'Service vétérinaire provincial de Taza',
    kind: 'PROVINCIAL',
    regionName: 'Fès-Meknès',
  },
  {
    id: 'srv-ifrane',
    name: 'Service vétérinaire provincial d’Ifrane',
    kind: 'PROVINCIAL',
    regionName: 'Fès-Meknès',
  },

  // Tanger-Tétouan-Al Hoceïma (4)
  {
    id: 'srv-tanger',
    name: 'Service vétérinaire provincial de Tanger',
    kind: 'PROVINCIAL',
    regionName: 'Tanger-Tétouan-Al Hoceïma',
  },
  {
    id: 'srv-tetouan',
    name: 'Service vétérinaire provincial de Tétouan',
    kind: 'PROVINCIAL',
    regionName: 'Tanger-Tétouan-Al Hoceïma',
  },
  {
    id: 'srv-larache',
    name: 'Service vétérinaire provincial de Larache',
    kind: 'PROVINCIAL',
    regionName: 'Tanger-Tétouan-Al Hoceïma',
  },
  {
    id: 'srv-alhoceima',
    name: 'Service vétérinaire provincial d’Al Hoceïma',
    kind: 'PROVINCIAL',
    regionName: 'Tanger-Tétouan-Al Hoceïma',
  },

  // Marrakech-Safi (4)
  {
    id: 'srv-marrakech',
    name: 'Service vétérinaire préfectoral de Marrakech',
    kind: 'PROVINCIAL',
    regionName: 'Marrakech-Safi',
  },
  {
    id: 'srv-safi',
    name: 'Service vétérinaire provincial de Safi',
    kind: 'PROVINCIAL',
    regionName: 'Marrakech-Safi',
  },
  {
    id: 'srv-essaouira',
    name: 'Service vétérinaire provincial d’Essaouira',
    kind: 'PROVINCIAL',
    regionName: 'Marrakech-Safi',
  },
  {
    id: 'srv-kelaa',
    name: 'Service vétérinaire provincial d’El Kelâa des Sraghna',
    kind: 'PROVINCIAL',
    regionName: 'Marrakech-Safi',
  },

  // Souss-Massa (4)
  {
    id: 'srv-agadir',
    name: 'Service vétérinaire préfectoral d’Agadir',
    kind: 'PROVINCIAL',
    regionName: 'Souss-Massa',
  },
  {
    id: 'srv-taroudant',
    name: 'Service vétérinaire provincial de Taroudant',
    kind: 'PROVINCIAL',
    regionName: 'Souss-Massa',
  },
  {
    id: 'srv-tiznit',
    name: 'Service vétérinaire provincial de Tiznit',
    kind: 'PROVINCIAL',
    regionName: 'Souss-Massa',
  },
  {
    id: 'srv-inezgane',
    name: 'Service vétérinaire provincial d’Inezgane-Aït Melloul',
    kind: 'PROVINCIAL',
    regionName: 'Souss-Massa',
  },

  // L’Oriental (4)
  {
    id: 'srv-nador',
    name: 'Service vétérinaire provincial de Nador',
    kind: 'PROVINCIAL',
    regionName: 'L’Oriental',
  },
  {
    id: 'srv-oujda',
    name: 'Service vétérinaire préfectoral d’Oujda-Angad',
    kind: 'PROVINCIAL',
    regionName: 'L’Oriental',
  },
  {
    id: 'srv-berkane',
    name: 'Service vétérinaire provincial de Berkane',
    kind: 'PROVINCIAL',
    regionName: 'L’Oriental',
  },
  {
    id: 'srv-taourirt',
    name: 'Service vétérinaire provincial de Taourirt',
    kind: 'PROVINCIAL',
    regionName: 'L’Oriental',
  },

  // Béni Mellal-Khénifra (3)
  {
    id: 'srv-benimellal',
    name: 'Service vétérinaire provincial de Béni Mellal',
    kind: 'PROVINCIAL',
    regionName: 'Béni Mellal-Khénifra',
  },
  {
    id: 'srv-khouribga',
    name: 'Service vétérinaire provincial de Khouribga',
    kind: 'PROVINCIAL',
    regionName: 'Béni Mellal-Khénifra',
  },
  {
    id: 'srv-khenifra',
    name: 'Service vétérinaire provincial de Khénifra',
    kind: 'PROVINCIAL',
    regionName: 'Béni Mellal-Khénifra',
  },

  // Drâa-Tafilalet (3)
  {
    id: 'srv-errachidia',
    name: 'Service vétérinaire provincial d’Errachidia',
    kind: 'PROVINCIAL',
    regionName: 'Drâa-Tafilalet',
  },
  {
    id: 'srv-ouarzazate',
    name: 'Service vétérinaire provincial d’Ouarzazate',
    kind: 'PROVINCIAL',
    regionName: 'Drâa-Tafilalet',
  },
  {
    id: 'srv-midelt',
    name: 'Service vétérinaire provincial de Midelt',
    kind: 'PROVINCIAL',
    regionName: 'Drâa-Tafilalet',
  },

  // Guelmim-Oued Noun (3)
  {
    id: 'srv-guelmim',
    name: 'Service vétérinaire provincial de Guelmim',
    kind: 'PROVINCIAL',
    regionName: 'Guelmim-Oued Noun',
  },
  {
    id: 'srv-tantan',
    name: 'Service vétérinaire provincial de Tan-Tan',
    kind: 'PROVINCIAL',
    regionName: 'Guelmim-Oued Noun',
  },
  {
    id: 'srv-sidiifni',
    name: 'Service vétérinaire provincial de Sidi Ifni',
    kind: 'PROVINCIAL',
    regionName: 'Guelmim-Oued Noun',
  },

  // Laâyoune-Sakia El Hamra (3)
  {
    id: 'srv-laayoune',
    name: 'Service vétérinaire provincial de Laâyoune',
    kind: 'PROVINCIAL',
    regionName: 'Laâyoune-Sakia El Hamra',
  },
  {
    id: 'srv-boujdour',
    name: 'Service vétérinaire provincial de Boujdour',
    kind: 'PROVINCIAL',
    regionName: 'Laâyoune-Sakia El Hamra',
  },
  {
    id: 'srv-essemara',
    name: 'Service vétérinaire provincial d’Es-Semara',
    kind: 'PROVINCIAL',
    regionName: 'Laâyoune-Sakia El Hamra',
  },

  // Dakhla-Oued Ed-Dahab (3)
  {
    id: 'srv-dakhla',
    name: 'Service vétérinaire provincial de Dakhla',
    kind: 'PROVINCIAL',
    regionName: 'Dakhla-Oued Ed-Dahab',
  },
  {
    id: 'srv-ouededdahab',
    name: 'Service vétérinaire provincial d’Oued Ed-Dahab',
    kind: 'PROVINCIAL',
    regionName: 'Dakhla-Oued Ed-Dahab',
  },
  {
    id: 'srv-aousserd',
    name: 'Service vétérinaire provincial d’Aousserd',
    kind: 'PROVINCIAL',
    regionName: 'Dakhla-Oued Ed-Dahab',
  },
];

/**
 * Un compte Chef de service fictif dédié pour chacune des 12 directions
 * régionales (plus le compte DCSP Casablanca pour la démonstration frontalière).
 */
export const PRESENTATION_CHEF_ACCOUNTS: readonly PresentationChefAccountSeed[] =
  [
    {
      id: 'usr-dcsp-casa',
      firstName: 'Karim',
      name: 'El Idrissi',
      email: 'dcsp.casa@vetra.local',
      phone: '0522 30 41 12',
      serviceId: 'srv-dcsp-casa',
      regionName: 'Casablanca-Settat',
    },
    {
      id: 'usr-chef-casa',
      firstName: 'Salma',
      name: 'Tazi',
      email: 'chef.casa@vetra.local',
      phone: '0522 44 19 80',
      serviceId: 'srv-pref-casa',
      regionName: 'Casablanca-Settat',
    },
    {
      id: 'usr-sv-kenitra',
      firstName: 'Rachid',
      name: 'Benali',
      email: 'sv.kenitra@vetra.local',
      phone: '0537 37 18 40',
      serviceId: 'srv-kenitra',
      regionName: 'Rabat-Salé-Kénitra',
    },
    {
      id: 'usr-sv-fes',
      firstName: 'Driss',
      name: 'Berrada',
      email: 'sv.fes@vetra.local',
      phone: '0535 62 45 11',
      serviceId: 'srv-fes',
      regionName: 'Fès-Meknès',
    },
    {
      id: 'usr-sv-tanger',
      firstName: 'Houda',
      name: 'El Amrani',
      email: 'sv.tanger@vetra.local',
      phone: '0539 94 21 63',
      serviceId: 'srv-tanger',
      regionName: 'Tanger-Tétouan-Al Hoceïma',
    },
    {
      id: 'usr-sv-marrakech',
      firstName: 'Yassine',
      name: 'Ouazzani',
      email: 'sv.marrakech@vetra.local',
      phone: '0524 43 58 20',
      serviceId: 'srv-marrakech',
      regionName: 'Marrakech-Safi',
    },
    {
      id: 'usr-sv-benimellal',
      firstName: 'Nadia',
      name: 'Mansouri',
      email: 'sv.benimellal@vetra.local',
      phone: '0523 48 31 09',
      serviceId: 'srv-benimellal',
      regionName: 'Béni Mellal-Khénifra',
    },
    {
      id: 'usr-sv-errachidia',
      firstName: 'Omar',
      name: 'Alaoui',
      email: 'sv.errachidia@vetra.local',
      phone: '0535 57 26 84',
      serviceId: 'srv-errachidia',
      regionName: 'Drâa-Tafilalet',
    },
    {
      id: 'usr-sv-agadir',
      firstName: 'Fatima Zahra',
      name: 'Amine',
      email: 'sv.agadir@vetra.local',
      phone: '0528 84 15 72',
      serviceId: 'srv-agadir',
      regionName: 'Souss-Massa',
    },
    {
      id: 'usr-sv-guelmim',
      firstName: 'Tarik',
      name: 'Naciri',
      email: 'sv.guelmim@vetra.local',
      phone: '0528 87 22 49',
      serviceId: 'srv-guelmim',
      regionName: 'Guelmim-Oued Noun',
    },
    {
      id: 'usr-sv-laayoune',
      firstName: 'Meriem',
      name: 'Chafik',
      email: 'sv.laayoune@vetra.local',
      phone: '0528 89 34 16',
      serviceId: 'srv-laayoune',
      regionName: 'Laâyoune-Sakia El Hamra',
    },
    {
      id: 'usr-sv-dakhla',
      firstName: 'Mehdi',
      name: 'Lahlou',
      email: 'sv.dakhla@vetra.local',
      phone: '0528 93 11 58',
      serviceId: 'srv-dakhla',
      regionName: 'Dakhla-Oued Ed-Dahab',
    },
    {
      id: 'usr-sv-nador',
      firstName: 'Loubna',
      name: 'El Fassi',
      email: 'sv.nador@vetra.local',
      phone: '0536 60 47 25',
      serviceId: 'srv-nador',
      regionName: 'L’Oriental',
    },
  ];

/**
 * Cible de taux de saisie régional (ratio 0..1) pour chaque mois incomplet de
 * l'année en cours (hors août=8 et octobre=10 qui sont toujours à 100 %).
 * Chaque mois présente un dégradé réaliste couvrant les tranches 1–49 %,
 * 50–74 %, 75–99 % et 100 % sur la carte du Maroc et dans le reporting.
 */
const REGION_INCOMPLETE_MONTH_RATIOS: Record<RegionName, readonly number[]> = {
  // Indexés par mois incomplet : [Jan, Fév, Mar, Avr, Mai, Jun, Jul, Sep, Nov, Déc]
  'Rabat-Salé-Kénitra': [0.75, 1.0, 0.75, 0.75, 1.0, 0.75, 1.0, 1.0, 0.75, 0.5],
  'Casablanca-Settat': [1.0, 0.75, 0.75, 1.0, 0.75, 0.75, 0.75, 0.75, 0.75, 0.5],
  'Tanger-Tétouan-Al Hoceïma': [0.5, 0.75, 0.75, 0.5, 0.75, 1.0, 0.75, 0.75, 0.75, 0.25],
  'Souss-Massa': [0.75, 0.5, 0.75, 0.75, 0.75, 0.75, 0.5, 0.75, 1.0, 0.5],
  'Fès-Meknès': [0.5, 0.5, 0.75, 0.5, 0.75, 0.5, 0.75, 0.5, 0.5, 0.25],
  'Marrakech-Safi': [0.5, 0.75, 0.5, 0.5, 0.5, 0.75, 0.5, 0.5, 0.5, 0.25],
  'L’Oriental': [0.25, 0.5, 0.5, 0.75, 0.5, 0.5, 0.75, 0.5, 0.25, 0.25],
  'Béni Mellal-Khénifra': [0.67, 0.33, 0.67, 0.67, 0.33, 0.67, 0.67, 0.67, 0.67, 0.33],
  'Laâyoune-Sakia El Hamra': [0.33, 0.67, 0.33, 0.67, 0.67, 0.33, 0.67, 0.67, 0.67, 0.33],
  'Drâa-Tafilalet': [0.33, 0.33, 0.67, 0.33, 0.67, 0.33, 0.33, 0.33, 0.33, 0.33],
  'Dakhla-Oued Ed-Dahab': [0.33, 0.67, 0.33, 0.33, 0.33, 0.67, 0.33, 0.33, 0.33, 0.33],
  'Guelmim-Oued Noun': [0.33, 0.33, 0.33, 0.33, 0.67, 0.33, 0.33, 0.33, 0.33, 0.33],
};

const INCOMPLETE_MONTH_SLOTS: Record<number, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  9: 7,
  11: 8,
  12: 9,
};

export function isFullReportingPeriod(
  year: number,
  month: number,
  currentYear: number,
): boolean {
  // Toute l'année 2025 (et années antérieures) + Août et Octobre de l'année en cours = 100 %
  if (year < currentYear) return true;
  return month === 8 || month === 10;
}

export function isFullReportingMonth(month: number): boolean {
  return month === 8 || month === 10;
}

/**
 * Construit un jeu de données multi-rubriques réaliste pour un service provincial,
 * ne renseignant strictement que les cellules éditables des rubriques complétées.
 */
export function buildProvincialDemoReportData(
  serviceIndex: number,
  year: number,
  month: number,
  completedRubrics: readonly RubricId[],
  regionName = '',
): Record<string, unknown> {
  const done = new Set<string>(completedRubrics);
  const s = Math.max(0, serviceIndex);
  const yShift = Math.max(0, year - 2025);
  const season = 1 + ((month + s) % 5) * 0.06 + yShift * 0.04;
  const n = (base: number, step: number) =>
    Math.max(
      1,
      Math.round((base + ((s * 5 + month * 3 + yShift * 4) % 11) * step) * season),
    );
  const dec = (base: number, step: number) =>
    Number(
      (
        (base + ((s * 3 + month * 2 + yShift * 5) % 9) * step) *
        season
      ).toFixed(1),
    );

  const data: Record<string, unknown> = {
    __demo: true,
    __completed: [...completedRubrics],
  };
  const dynamicRows: { rubric: string; values: unknown[] }[] = [];

  if (done.has('I.A.1')) {
    const bovins = n(140, 18);
    const ovins = n(420, 45);
    const caprins = n(95, 14);
    const camelins = s % 3 === 0 ? n(12, 3) : 0;
    data.B9 = bovins;
    data.C9 = ovins;
    data.D9 = caprins;
    if (camelins > 0) data.E9 = camelins;
    data.B10 = Math.round(bovins * 245);
    data.C10 = Math.round(ovins * 18.5);
    data.D10 = Math.round(caprins * 13);
    data.B11 = Math.max(1, Math.round(bovins * 0.015));
    data.C11 = Math.max(1, Math.round(ovins * 0.012));
  }

  if (done.has('I.A.2')) {
    data.B17 = dec(4800, 420);
    data.C17 = n(24, 3);
    data.D17 = (s + month) % 3;
    data.B18 = dec(2100, 190);
  }

  if (done.has('I.A.3')) {
    const poulets = n(38000, 3200);
    data.B24 = poulets;
    data.C24 = Math.round(poulets * 1.9);
    data.D24 = Math.round(poulets * 1.45);
    data.E24 = Math.round(poulets * 0.012);
  }

  if (done.has('I.A.4')) {
    const lapins = n(320, 35);
    data.B34 = lapins;
    data.C34 = Math.round(lapins * 2.2);
    data.D34 = Math.round(lapins * 1.35);
    data.E34 = Math.max(1, Math.round(lapins * 0.01));
  }

  if (done.has('I.A.5')) {
    data.B38 = n(18, 2);
    data.C38 = dec(12500, 950);
    data.D38 = dec(48, 8);
    data.B39 = n(26, 3);
  }

  if (done.has('I.A.6')) {
    data.B50 = ((s + month) % 5) + 1;
    data.C50 = (s + month * 2) % 4;
    data.D50 = (s + month) % 3;
    data.E50 = (s + month + 1) % 2;
  }

  if (done.has('I.A.7')) {
    data.B60 = n(42, 6);
    data.B61 = n(68, 9);
  }

  if (done.has('I.B.1')) {
    data.A68 = n(14, 2);
    data.B68 = n(22, 3);
    data.E68 = n(36, 5);
    data.E69 = n(28, 4);
  }

  if (done.has('I.B.2')) {
    data.B82 = ((s + month) % 4) + 1;
    data.C82 = (s + month) % 3;
    data.D82 = (s + month + 1) % 3;
  }

  if (done.has('I.C.1')) {
    data.B94 = n(11, 2);
    data.C94 = n(4, 1);
    data.D94 = (s + month) % 2;
    data.B95 = n(8, 2);
  }

  if (done.has('I.C.2')) {
    data.B114 = dec(1450, 140);
    data.C114 = dec(980, 110);
    data.D114 = dec(620, 85);
    data.E114 = dec(740, 95);
  }

  if (done.has('I.D') && (s + month) % 3 === 0) {
    dynamicRows.push({
      rubric: 'I.D',
      values: [
        1,
        4 + ((s + month) % 9),
        (s + month) % 2,
        regionName || 'Zone urbaine',
      ],
    });
  }

  if (done.has('II.A')) {
    data.B127 = n(4, 1);
    data.B128 = n(6, 1);
    data.B129 = n(5, 1);
    data.B130 = n(9, 2);
  }

  if (done.has('II.B')) {
    const deposited = n(12, 2);
    data.B160 = deposited;
    data.C160 = Math.max(1, deposited - ((s + month) % 3));
  }

  if (done.has('II.C') && (s + month) % 4 === 0) {
    const padMonth = String(month).padStart(2, '0');
    dynamicRows.push({
      rubric: 'II.C',
      values: [
        1,
        `Établissement agréé ${regionName || 'ONSSA'}`,
        dec(120, 25),
        `${year}-${padMonth}-12`,
        'Produit laitier',
        'Non-conformité étiquetage',
        'Autocontrôle',
        1,
        0,
        0,
        'Lot isolé',
        'Rappel ciblé',
        'Clôturé',
        'Vérification documentaire effectuée',
      ],
    });
  }

  if (done.has('III')) {
    data.B175 = n(28, 4);
    data.B176 = n(6, 1);
    data.B177 = n(4, 1);
  }

  if (done.has('V')) {
    data.C230 = dec(6400, 520);
    data.D230 = 0;
    data.C231 = dec(1850, 210);
    data.D231 = 0;
  }

  if (done.has('VI.A')) {
    data.C277 = n(16, 3);
    data.C278 = n(14, 2);
    data.C279 = n(9, 2);
    data.C280 = n(7, 1);
  }

  if (done.has('VI.B')) {
    const samples = n(24, 3);
    data.B297 = samples;
    data.C297 = Math.round(samples * 0.65);
    data.D297 = Math.round(samples * 0.35);
    data.E297 = 0;
  }

  if (dynamicRows.length) {
    data.__tables = dynamicRows;
  }

  return data;
}

export type PlannedDemoReport = {
  status: Status;
  completedRubrics: RubricId[];
  data: Record<string, unknown>;
  reason: string | null;
};

/**
 * Planifie de manière déterministe l'état, la complétude et les données d'un
 * rapport de démonstration pour un service donné et un mois donné :
 * - Toute l'année 2025 (12 mois) : 100 % VALIDE pour tous les services et régions.
 * - Août (8) et Octobre (10) de l'année en cours : 100 % VALIDE pour tous les services et régions.
 * - Autres mois de l'année en cours : pourcentages de complétude régionaux
 *   intermédiaires et différenciés (25 %, 33 %, 50 %, 67 %, 75 %, 100 %) ainsi
 *   que des complétudes de rubriques variées par service.
 */
export function planDemoReport(input: {
  serviceName: string;
  serviceIndex: number;
  serviceIndexInRegion: number;
  regionServiceCount: number;
  serviceKind: Kind;
  regionName: string;
  year: number;
  month: number;
  currentYear: number;
  currentMonth: number;
  permittedRubrics: readonly RubricId[];
}): PlannedDemoReport | null {
  const {
    serviceName,
    serviceIndex,
    serviceIndexInRegion,
    regionServiceCount,
    serviceKind,
    regionName,
    year,
    month,
    currentYear,
    currentMonth,
    permittedRubrics,
  } = input;

  const isDcsp = serviceKind === 'FRONTALIER' || /\bdcsp\b/i.test(serviceName);
  const fullRubrics = [...permittedRubrics];

  const makePayload = (
    status: Status,
    completedCount: number,
  ): PlannedDemoReport => {
    const effectiveCount =
      status === 'VALIDE' || status === 'SOUMIS'
        ? fullRubrics.length
        : Math.max(1, Math.min(fullRubrics.length, completedCount));
    const completedRubrics = fullRubrics.slice(0, effectiveCount);
    const data = isDcsp
      ? buildDcspDemoReportData(serviceIndex, year, month)
      : buildProvincialDemoReportData(
          serviceIndex,
          year,
          month,
          completedRubrics,
          regionName,
        );
    return {
      status,
      completedRubrics,
      data,
      reason:
        status === 'REVOQUE'
          ? 'Vérifier la cohérence des saisies partielles avant re-soumission.'
          : null,
    };
  };

  // 1. Année 2025 complète (tous les 12 mois à 100 %) + Août & Octobre 2026 à 100 %
  if (isFullReportingPeriod(year, month, currentYear)) {
    return makePayload('VALIDE', fullRubrics.length);
  }

  // 2. Autres mois de l'année en cours : taux régional intermédiaire différencié (25 % à 100 %)
  const slot = INCOMPLETE_MONTH_SLOTS[month] ?? 0;
  const regionRatios =
    REGION_INCOMPLETE_MONTH_RATIOS[regionName as RegionName];
  const targetRatio = regionRatios
    ? regionRatios[slot % regionRatios.length]
    : 0.67;

  const count = Math.max(1, regionServiceCount);
  const recordedTarget = Math.max(
    1,
    Math.min(count, Math.round(count * targetRatio)),
  );

  // Les services au-delà du quota régional du mois restent « NON INTRODUIT »
  // afin que la carte « Progression de la saisie par région » affiche des
  // pourcentages intermédiaires (25 %, 33 %, 50 %, 67 %, 75 %, 100 %).
  if (serviceIndexInRegion >= recordedTarget) {
    return null;
  }

  // Parmi les services introduits, varier les statuts et les % de complétude par rubrique
  const isCurrent = year === currentYear && month === currentMonth;
  if (isDcsp) {
    return makePayload(isCurrent ? 'VALIDE' : 'VALIDE', fullRubrics.length);
  }

  if (isCurrent) {
    // Mois courant : belle diversité de statuts & % de complétude (32 % à 100 %)
    const currentProfiles: { status: Status; rubrics: number }[] = [
      { status: 'VALIDE', rubrics: 19 },
      { status: 'SOUMIS', rubrics: 19 },
      { status: 'CORRIGE', rubrics: 17 }, // 89 %
      { status: 'BROUILLON', rubrics: 14 }, // 74 %
      { status: 'REVOQUE', rubrics: 12 }, // 63 %
      { status: 'BROUILLON', rubrics: 9 }, // 47 %
      { status: 'VALIDE', rubrics: 19 },
      { status: 'BROUILLON', rubrics: 6 }, // 32 %
    ];
    const profile =
      currentProfiles[(serviceIndex + serviceIndexInRegion) % currentProfiles.length];
    return makePayload(profile.status, profile.rubrics);
  }

  // Mois passés incomplets (Jan–Jul, Sep) : majoritairement VALIDE/SOUMIS/CORRIGE
  // (tous transmis dans le reporting) + quelques brouillons partiels
  const pastProfiles: { status: Status; rubrics: number }[] = [
    { status: 'VALIDE', rubrics: 19 },
    { status: 'VALIDE', rubrics: 19 },
    { status: 'SOUMIS', rubrics: 19 },
    { status: 'CORRIGE', rubrics: 16 }, // 84 %
    { status: 'VALIDE', rubrics: 19 },
    { status: 'REVOQUE', rubrics: 13 }, // 68 %
  ];
  const profile =
    pastProfiles[(serviceIndex + month) % pastProfiles.length];
  return makePayload(profile.status, profile.rubrics);
}
