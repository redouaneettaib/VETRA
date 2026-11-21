import type { Kind, Role, Status, User } from '@prisma/client';
import { buildDcspDemoReportData } from './demo-dcsp';
import { rubricIds } from './forms';

export const PREVIEW_PASSWORD = 'VetraPreview2026!';

/**
 * Mode aperçu autonome strictement réservé à l'environnement de prévisualisation
 * sans base de données configurée (jamais actif en production ni dès que DATABASE_URL est défini).
 */
export function isPreviewMode(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    !process.env.DATABASE_URL?.trim()
  );
}

export type PreviewRegion = { id: string; name: string };
export type PreviewDivision = { id: string; name: string; regionId: string };
export type PreviewRight = {
  serviceId: string;
  rubricId: string;
  enabled: boolean;
};
export type PreviewService = {
  id: string;
  name: string;
  kind: Kind;
  divisionId: string;
  rights: PreviewRight[];
};
export type PreviewReport = {
  id: string;
  serviceId: string;
  year: number;
  month: number;
  status: Status;
  data: Record<string, unknown>;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
};
export type PreviewEvent = {
  id: string;
  userId: string;
  reportId: string | null;
  action: string;
  oldStatus: Status | null;
  newStatus: Status | null;
  reason: string | null;
  createdAt: Date;
};
export type PreviewAccountSummary = {
  email: string;
  label: string;
  role: Role;
  detail: string;
};

type PreviewState = {
  regions: PreviewRegion[];
  divisions: PreviewDivision[];
  services: PreviewService[];
  users: User[];
  reports: PreviewReport[];
  events: PreviewEvent[];
  activeUserId: string | null;
  seq: number;
};

const REGION_NAMES = [
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

const SERVICE_SEEDS: {
  id: string;
  name: string;
  kind: Kind;
  regionName: string;
}[] = [
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
  {
    id: 'srv-kenitra',
    name: 'Service vétérinaire provincial de Kénitra',
    kind: 'PROVINCIAL',
    regionName: 'Rabat-Salé-Kénitra',
  },
  {
    id: 'srv-fes',
    name: 'Service vétérinaire provincial de Fès',
    kind: 'PROVINCIAL',
    regionName: 'Fès-Meknès',
  },
  {
    id: 'srv-tanger',
    name: 'Service vétérinaire provincial de Tanger',
    kind: 'PROVINCIAL',
    regionName: 'Tanger-Tétouan-Al Hoceïma',
  },
  {
    id: 'srv-nador',
    name: 'Service vétérinaire provincial de Nador',
    kind: 'PROVINCIAL',
    regionName: 'L’Oriental',
  },
];

const STATUS_CYCLE: Status[] = [
  'VALIDE',
  'VALIDE',
  'SOUMIS',
  'VALIDE',
  'CORRIGE',
  'REVOQUE',
  'BROUILLON',
];

function createInitialState(): PreviewState {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const regions: PreviewRegion[] = REGION_NAMES.map((name, idx) => ({
    id: `reg-${idx + 1}`,
    name,
  }));
  const regionByName = new Map(regions.map((r) => [r.name, r]));

  const divisions: PreviewDivision[] = regions.map((r, idx) => ({
    id: `div-${idx + 1}`,
    name: `Division vétérinaire — ${r.name}`,
    regionId: r.id,
  }));
  const divisionByRegionId = new Map(divisions.map((d) => [d.regionId, d]));

  const services: PreviewService[] = SERVICE_SEEDS.map((seed) => {
    const region = regionByName.get(seed.regionName)!;
    const division = divisionByRegionId.get(region.id)!;
    const rights: PreviewRight[] =
      seed.kind === 'FRONTALIER'
        ? rubricIds.map((rubricId) => ({
            serviceId: seed.id,
            rubricId,
            enabled: rubricId === 'IV',
          }))
        : rubricIds.map((rubricId) => ({
            serviceId: seed.id,
            rubricId,
            enabled: true,
          }));
    return {
      id: seed.id,
      name: seed.name,
      kind: seed.kind,
      divisionId: division.id,
      rights,
    };
  });

  const casaRegion = regionByName.get('Casablanca-Settat')!;
  const casaDivision = divisionByRegionId.get(casaRegion.id)!;

  const users: User[] = [
    {
      id: 'usr-direction',
      name: 'Bennani',
      firstName: 'Nadia',
      email: 'direction@vetra.local',
      phone: '0537 67 65 00',
      role: 'DIRECTION_CENTRALE',
      passwordHash: '',
      verified: true,
      regionId: null,
      divisionId: null,
      serviceId: null,
      active: true,
      createdAt: now,
    },
    {
      id: 'usr-admin',
      name: 'Administrateur',
      firstName: 'National',
      email: 'admin@vetra.local',
      phone: '0537 67 65 01',
      role: 'ADMIN_NATIONAL',
      passwordHash: '',
      verified: true,
      regionId: null,
      divisionId: null,
      serviceId: null,
      active: true,
      createdAt: now,
    },
    {
      id: 'usr-dcsp-casa',
      name: 'El Idrissi',
      firstName: 'Karim',
      email: 'dcsp.casa@vetra.local',
      phone: '0522 30 41 12',
      role: 'CHEF_SERVICE',
      passwordHash: '',
      verified: true,
      regionId: casaRegion.id,
      divisionId: casaDivision.id,
      serviceId: 'srv-dcsp-casa',
      active: true,
      createdAt: now,
    },
    {
      id: 'usr-chef-casa',
      name: 'Tazi',
      firstName: 'Salma',
      email: 'chef.casa@vetra.local',
      phone: '0522 44 19 80',
      role: 'CHEF_SERVICE',
      passwordHash: '',
      verified: true,
      regionId: casaRegion.id,
      divisionId: casaDivision.id,
      serviceId: 'srv-pref-casa',
      active: true,
      createdAt: now,
    },
    {
      id: 'usr-div-casa',
      name: 'Chraibi',
      firstName: 'Youssef',
      email: 'division.casa@vetra.local',
      phone: '0522 25 71 04',
      role: 'CHEF_DIVISION',
      passwordHash: '',
      verified: true,
      regionId: casaRegion.id,
      divisionId: casaDivision.id,
      serviceId: null,
      active: true,
      createdAt: now,
    },
    {
      id: 'usr-dr-casa',
      name: 'Alami',
      firstName: 'Hassan',
      email: 'dr.casa@vetra.local',
      phone: '0522 25 71 00',
      role: 'DIRECTEUR_REGIONAL',
      passwordHash: '',
      verified: true,
      regionId: casaRegion.id,
      divisionId: null,
      serviceId: null,
      active: true,
      createdAt: now,
    },
  ];

  const reports: PreviewReport[] = [];
  const events: PreviewEvent[] = [];
  let seq = 1;

  const yearRanges: [number, number][] = [
    [currentYear - 1, 12],
    [currentYear, Math.max(currentMonth, 10)],
  ];

  for (const [serviceIndex, service] of services.entries()) {
    for (const [year, lastMonth] of yearRanges) {
      for (let month = 1; month <= lastMonth; month++) {
        // Garder quelques absences sur les mois passés pour tester « non introduit »
        if (
          !(year === currentYear && month === currentMonth) &&
          (serviceIndex + month + year) % 9 === 0
        ) {
          continue;
        }
        const status: Status =
          year === currentYear && month === currentMonth
            ? (['VALIDE', 'SOUMIS', 'BROUILLON', 'VALIDE', 'SOUMIS', 'REVOQUE', 'CORRIGE', 'VALIDE'][
                serviceIndex % 8
              ] as Status)
            : year < currentYear
              ? 'VALIDE'
              : STATUS_CYCLE[(serviceIndex * 3 + month + year) % STATUS_CYCLE.length];

        const base = (serviceIndex + 1) * 100 + (year - (currentYear - 1)) * 25 + month * 4;
        const data: Record<string, unknown> =
          service.kind === 'FRONTALIER'
            ? buildDcspDemoReportData(serviceIndex, year, month)
            : {
                __demo: true,
                __completed:
                  status === 'BROUILLON' ? ['I.A.1'] : [...rubricIds],
                B9: base,
                C9: base + 12,
                D9: base + 4,
                B10: base * 10,
                C10: base * 3,
                D10: base,
                B11: (serviceIndex + month) % 8,
                C11: (serviceIndex + month * 2) % 11,
              };

        const stamp = new Date(year, month - 1, Math.min(25, 8 + serviceIndex));
        const id = `rep-${seq++}`;
        reports.push({
          id,
          serviceId: service.id,
          year,
          month,
          status,
          data,
          reason:
            status === 'REVOQUE'
              ? 'Vérifier la cohérence des saisies partielles avant re-soumission.'
              : null,
          createdAt: stamp,
          updatedAt: stamp,
        });
        events.push({
          id: `evt-${seq++}`,
          userId:
            service.kind === 'FRONTALIER' ? 'usr-dcsp-casa' : 'usr-chef-casa',
          reportId: id,
          action: status === 'VALIDE' ? 'valider' : 'CREATION',
          oldStatus: null,
          newStatus: status,
          reason:
            status === 'REVOQUE'
              ? 'Vérifier la cohérence des saisies partielles avant re-soumission.'
              : null,
          createdAt: stamp,
        });
      }
    }
  }

  // Exemple d'une demande de réinitialisation en attente pour l'écran Administration
  events.push({
    id: `evt-${seq++}`,
    userId: 'usr-chef-casa',
    reportId: null,
    action: 'PASSWORD_RESET_REQUEST',
    oldStatus: null,
    newStatus: null,
    reason: '0522 44 19 80 · Service vétérinaire préfectoral de Casablanca',
    createdAt: new Date(now.getTime() - 15 * 60_000),
  });

  return {
    regions,
    divisions,
    services,
    users,
    reports,
    events,
    activeUserId: null,
    seq,
  };
}

const g = globalThis as unknown as { __vetraPreview?: PreviewState };

export function getPreviewStore(): PreviewState {
  if (!g.__vetraPreview) {
    g.__vetraPreview = createInitialState();
  }
  return g.__vetraPreview;
}

export function previewAccounts(): PreviewAccountSummary[] {
  return [
    {
      email: 'direction@vetra.local',
      label: 'Direction centrale',
      role: 'DIRECTION_CENTRALE',
      detail: 'Tableau de bord, Reporting & Veille IA',
    },
    {
      email: 'admin@vetra.local',
      label: 'Administrateur national',
      role: 'ADMIN_NATIONAL',
      detail: 'Administration, services & habilitations',
    },
    {
      email: 'dcsp.casa@vetra.local',
      label: 'Chef de service DCSP',
      role: 'CHEF_SERVICE',
      detail: 'DCSP Casablanca · Rubrique IV uniquement',
    },
    {
      email: 'chef.casa@vetra.local',
      label: 'Chef de service provincial',
      role: 'CHEF_SERVICE',
      detail: 'Service préfectoral de Casablanca',
    },
    {
      email: 'division.casa@vetra.local',
      label: 'Chef de division',
      role: 'CHEF_DIVISION',
      detail: 'Validation régionale · Casablanca-Settat',
    },
    {
      email: 'dr.casa@vetra.local',
      label: 'Directeur régional',
      role: 'DIRECTEUR_REGIONAL',
      detail: 'Suivi & Reporting · Casablanca-Settat',
    },
  ];
}

export function previewFindUserByEmail(email: string): User | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return (
    getPreviewStore().users.find(
      (u) => u.email.toLowerCase() === normalized,
    ) ?? null
  );
}

export function previewFindUserById(id: string): User | null {
  return getPreviewStore().users.find((u) => u.id === id) ?? null;
}

export function previewSetActiveUser(id: string | null) {
  getPreviewStore().activeUserId = id;
}

export function previewGetActiveUser(): User | null {
  const store = getPreviewStore();
  if (!store.activeUserId) return null;
  return store.users.find((u) => u.id === store.activeUserId && u.active) ?? null;
}

export function previewAllowedServices(user: User): string[] {
  const store = getPreviewStore();
  if (user.role === 'ADMIN_NATIONAL' || user.role === 'DIRECTION_CENTRALE') {
    return store.services.map((s) => s.id);
  }
  if (user.role === 'CHEF_SERVICE') {
    return user.serviceId ? [user.serviceId] : [];
  }
  if (user.role === 'CHEF_DIVISION') {
    return store.services
      .filter((s) => s.divisionId === (user.divisionId || '---'))
      .map((s) => s.id);
  }
  if (user.role === 'DIRECTEUR_REGIONAL') {
    const divIds = new Set(
      store.divisions
        .filter((d) => d.regionId === (user.regionId || '---'))
        .map((d) => d.id),
    );
    return store.services
      .filter((s) => divIds.has(s.divisionId))
      .map((s) => s.id);
  }
  return [];
}

export function previewHydrateService(service: PreviewService) {
  const store = getPreviewStore();
  const division = store.divisions.find((d) => d.id === service.divisionId)!;
  const region = store.regions.find((r) => r.id === division.regionId)!;
  return {
    ...service,
    division: {
      ...division,
      region,
    },
  };
}

export function previewHydrateReport(report: PreviewReport) {
  const store = getPreviewStore();
  const service = store.services.find((s) => s.id === report.serviceId)!;
  return {
    ...report,
    service: previewHydrateService(service),
  };
}

export function previewNextId(prefix: string): string {
  const store = getPreviewStore();
  return `${prefix}-${store.seq++}`;
}
