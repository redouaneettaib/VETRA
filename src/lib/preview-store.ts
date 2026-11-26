import type { Kind, Role, Status, User } from '@prisma/client';
import {
  planDemoReport,
  PRESENTATION_CHEF_ACCOUNTS,
  PRESENTATION_SERVICES,
  REGION_NAMES,
} from './demo-presentation';
import { defaultRubricsForKind, effectiveRubrics, rubricIds } from './forms';

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

  const services: PreviewService[] = PRESENTATION_SERVICES.map((seed) => {
    const region = regionByName.get(seed.regionName)!;
    const division = divisionByRegionId.get(region.id)!;
    const defaultEnabled = new Set(defaultRubricsForKind(seed.kind));
    const rights: PreviewRight[] = rubricIds.map((rubricId) => ({
      serviceId: seed.id,
      rubricId,
      enabled: defaultEnabled.has(rubricId),
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

  const regionalChefUsers: User[] = PRESENTATION_CHEF_ACCOUNTS.map((acc) => {
    const region = regionByName.get(acc.regionName)!;
    const division = divisionByRegionId.get(region.id)!;
    return {
      id: acc.id,
      name: acc.name,
      firstName: acc.firstName,
      email: acc.email,
      phone: acc.phone,
      role: 'CHEF_SERVICE',
      passwordHash: '',
      verified: true,
      regionId: region.id,
      divisionId: division.id,
      serviceId: acc.serviceId,
      active: true,
      createdAt: now,
    };
  });

  const users: User[] = [
    {
      id: 'usr-direction',
      name: 'ALIBOU',
      firstName: 'HICHAM',
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
    ...regionalChefUsers,
    {
      id: 'usr-div-casa',
      name: 'HACHI',
      firstName: 'ABDERRAHMANE',
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
      name: 'SERTANY',
      firstName: 'MOUNIR',
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

  const userIdByServiceId = new Map(
    regionalChefUsers
      .filter((u) => u.serviceId)
      .map((u) => [u.serviceId as string, u.id]),
  );
  const regionNameByDivisionId = new Map(
    divisions.map((d) => [
      d.id,
      regions.find((r) => r.id === d.regionId)?.name ?? '',
    ]),
  );

  const reports: PreviewReport[] = [];
  const events: PreviewEvent[] = [];
  let seq = 1;

  const yearRanges: [number, number][] = [
    [currentYear - 1, 12],
    [currentYear, Math.max(currentMonth, 10)],
  ];

  const servicesByRegion = new Map<string, PreviewService[]>();
  for (const service of services) {
    const regionName = regionNameByDivisionId.get(service.divisionId) ?? '';
    const list = servicesByRegion.get(regionName) ?? [];
    list.push(service);
    servicesByRegion.set(regionName, list);
  }

  for (const [serviceIndex, service] of services.entries()) {
    const regionName = regionNameByDivisionId.get(service.divisionId) ?? '';
    const regionList = servicesByRegion.get(regionName) ?? [service];
    const serviceIndexInRegion = regionList.findIndex((s) => s.id === service.id);
    const permittedRubrics = effectiveRubrics(service.rights, service.kind);
    const authorId = userIdByServiceId.get(service.id) ?? 'usr-chef-casa';

    for (const [year, lastMonth] of yearRanges) {
      for (let month = 1; month <= lastMonth; month++) {
        const planned = planDemoReport({
          serviceName: service.name,
          serviceIndex,
          serviceIndexInRegion: Math.max(0, serviceIndexInRegion),
          regionServiceCount: regionList.length,
          serviceKind: service.kind,
          regionName,
          year,
          month,
          currentYear,
          currentMonth,
          permittedRubrics,
        });
        if (!planned) continue;

        const stamp = new Date(
          year,
          month - 1,
          Math.min(25, 6 + (serviceIndex % 18)),
        );
        const id = `rep-${seq++}`;
        reports.push({
          id,
          serviceId: service.id,
          year,
          month,
          status: planned.status,
          data: planned.data,
          reason: planned.reason,
          createdAt: stamp,
          updatedAt: stamp,
        });
        events.push({
          id: `evt-${seq++}`,
          userId: authorId,
          reportId: id,
          action: planned.status === 'VALIDE' ? 'valider' : 'CREATION',
          oldStatus: null,
          newStatus: planned.status,
          reason: planned.reason,
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
