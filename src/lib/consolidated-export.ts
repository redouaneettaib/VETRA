import { dynamicFields, numericCells, readNumber } from './forms';

export const CONSOLIDATED_STATUS_FILTERS = [
  'TOUS',
  'SAISIS',
  'SOUMIS',
  'VALIDE',
] as const;

export type ConsolidatedStatusFilter =
  (typeof CONSOLIDATED_STATUS_FILTERS)[number];

export type ConsolidatedExportParams = {
  year: number;
  month: number;
  status: ConsolidatedStatusFilter;
  regionId: string;
};

export type DynamicTableEntry = {
  rubric: string;
  values: unknown[];
};

export type ConsolidatedServiceItem = {
  serviceId: string;
  serviceName: string;
  serviceKind: string;
  divisionName: string;
  regionName: string;
  status: string;
};

export type AggregatedReportData = {
  data: Record<string, unknown>;
  numericCellCount: number;
  dynamicRowCount: number;
};

export function parseConsolidatedParams(
  params: URLSearchParams,
): ConsolidatedExportParams {
  const year = Number(params.get('year'));
  const month = Number(params.get('month'));
  if (
    !Number.isInteger(year) ||
    year < 1900 ||
    year > 9999 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error('Période invalide pour la consolidation.');
  }
  const rawStatus = (params.get('status') || 'TOUS').trim().toUpperCase();
  if (
    !CONSOLIDATED_STATUS_FILTERS.includes(
      rawStatus as ConsolidatedStatusFilter,
    )
  ) {
    throw new Error(
      'Filtre d’état invalide pour la consolidation (utilisez TOUS, SAISIS, SOUMIS ou VALIDE).',
    );
  }
  const regionId = (params.get('regionId') || '').trim();
  if (regionId.length > 120) {
    throw new Error('Identifiant de direction régionale invalide.');
  }
  return {
    year,
    month,
    status: rawStatus as ConsolidatedStatusFilter,
    regionId,
  };
}

export function filterReportsForConsolidation<T extends { status: string }>(
  reports: readonly T[],
  statusFilter: ConsolidatedStatusFilter,
): T[] {
  if (statusFilter === 'TOUS' || statusFilter === 'SAISIS') {
    return [...reports];
  }
  return reports.filter((report) => report.status === statusFilter);
}

/**
 * Agrège (somme) les données numériques de plusieurs rapports mensuels VETRA.
 * - Somme toutes les cellules numériques non-pourcentages avec précision IEEE-754 contrôlée.
 * - Les cellules de taux (%) ne sont jamais additionnées entre plusieurs services (conservées uniquement s'il n'y a qu'une seule observation).
 * - Concatène les lignes des tableaux dynamiques (I.D TIAC et II.C Retraits/Rappels).
 */
export function aggregateReportsData(
  reports: readonly { data: unknown }[],
): AggregatedReportData {
  const sums: Record<string, number> = {};
  const observations: Record<string, number> = {};
  const tables: DynamicTableEntry[] = [];

  for (const report of reports) {
    if (
      !report.data ||
      typeof report.data !== 'object' ||
      Array.isArray(report.data)
    ) {
      continue;
    }
    const raw = report.data as Record<string, unknown>;
    for (const [address] of numericCells) {
      const value = readNumber(raw[address]);
      if (value === undefined) continue;
      sums[address] = Number(((sums[address] ?? 0) + value).toPrecision(14));
      observations[address] = (observations[address] ?? 0) + 1;
    }
    if (Array.isArray(raw.__tables)) {
      for (const entry of raw.__tables) {
        if (
          entry &&
          typeof entry === 'object' &&
          typeof (entry as { rubric?: unknown }).rubric === 'string' &&
          Object.hasOwn(dynamicFields, (entry as { rubric: string }).rubric) &&
          Array.isArray((entry as { values?: unknown }).values)
        ) {
          tables.push({
            rubric: (entry as { rubric: string }).rubric,
            values: [...(entry as { values: unknown[] }).values],
          });
        }
      }
    }
  }

  const aggregated: Record<string, unknown> = {};
  let numericCellCount = 0;
  for (const [address, meta] of numericCells) {
    const count = observations[address] ?? 0;
    if (!count) continue;
    // Ne pas additionner des pourcentages issus de plusieurs services
    if (meta.percent && count > 1) continue;
    aggregated[address] = sums[address];
    numericCellCount += 1;
  }
  if (tables.length) {
    aggregated.__tables = tables;
  }
  return {
    data: aggregated,
    numericCellCount,
    dynamicRowCount: tables.length,
  };
}

export function sanitizeFilenamePart(input: string): string {
  const cleaned = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
    .toUpperCase();
  return cleaned || 'CONSOLIDE';
}

export function describeConsolidatedScope(input: {
  role: string;
  year: number;
  month: number;
  statusFilter: ConsolidatedStatusFilter;
  includedCount: number;
  totalServiceCount: number;
  regionFilterName?: string;
  regionName?: string;
  divisionName?: string;
}) {
  const {
    role,
    year,
    month,
    statusFilter,
    includedCount,
    totalServiceCount,
    regionFilterName,
    regionName,
    divisionName,
  } = input;

  let scopeLabel: string;
  let filenameSlug: string;

  if (role === 'DIRECTEUR_REGIONAL') {
    const name = regionName || 'Direction régionale';
    scopeLabel = `Direction régionale · ${name}`;
    filenameSlug = `TOTAL_DR_${sanitizeFilenamePart(name)}`;
  } else if (role === 'CHEF_DIVISION') {
    const name = divisionName || regionName || 'Division vétérinaire';
    scopeLabel = `Division vétérinaire · ${name}`;
    filenameSlug = `TOTAL_DIV_${sanitizeFilenamePart(name)}`;
  } else if (regionFilterName) {
    scopeLabel = `Direction régionale · ${regionFilterName}`;
    filenameSlug = `TOTAL_${sanitizeFilenamePart(regionFilterName)}`;
  } else {
    scopeLabel = 'Périmètre national · Ensemble des directions régionales';
    filenameSlug = 'TOTAL_NATIONAL';
  }

  const statusLabel =
    statusFilter === 'VALIDE'
      ? 'Rapports validés uniquement'
      : statusFilter === 'SOUMIS'
        ? 'Rapports en validation uniquement'
        : 'Tous les rapports introduits';

  if (statusFilter === 'VALIDE') {
    filenameSlug += '_VALIDES';
  } else if (statusFilter === 'SOUMIS') {
    filenameSlug += '_SOUMIS';
  }

  const serviceWord = includedCount > 1 ? 'services inclus' : 'service inclus';
  const subtitle = `${scopeLabel} · ${includedCount}/${totalServiceCount} ${serviceWord} · ${statusLabel}`;
  const emailSubject = `Rapport consolidé ${month}/${year} · ${scopeLabel}`;

  return {
    scopeLabel,
    statusLabel,
    subtitle,
    filenameSlug,
    emailSubject,
  };
}
