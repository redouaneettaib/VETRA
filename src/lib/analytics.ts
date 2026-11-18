import { RUBRICS } from './canevas';
import {
  calculate,
  calculatedCells,
  dynamicFields,
  numericCells,
  readNumber,
} from './forms';

export const months = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];
export const rubricLabels = Object.fromEntries(
  RUBRICS.map(([id, , , title]) => [id, title]),
);
export const metrics = new Map(
  [...numericCells].map(([id, field]) => [id, { ...field }] as const),
);
for (const [id, field] of calculatedCells)
  metrics.set(id, { ...field, percent: false, integer: false });
for (const [rubric, fields] of Object.entries(dynamicFields)) {
  fields.forEach((field, index) => {
    if (field.kind === 'number')
      metrics.set(`${rubric}:${index}`, {
        rubric,
        label: field.label,
        percent: false,
        integer: false,
      });
  });
}
export const format = (value: number | null | undefined, percent = false) =>
  value == null
    ? '—'
    : value.toLocaleString('fr-FR', { maximumFractionDigits: 8 }) +
      (percent ? ' %' : '');

export type Filters = {
  year: number;
  month: number;
  mode: 'month' | 'year';
  trend: 'months' | 'years';
  span: number;
  group: 'all' | 'region' | 'service';
  ids: string[];
  rubrics: string[];
  metric: string;
};
export type Entity = { id: string; name: string };
export type Service = Entity & { region: Entity };
export type Validated = {
  serviceId: string;
  year: number;
  month: number;
  data: unknown;
};
type WorkflowReport = Omit<Validated, 'data'> & { status: string };
const transmittedStatuses = new Set(['SOUMIS', 'REVOQUE', 'CORRIGE', 'VALIDE']);
type Bucket = { count: number; values: Record<string, number | null> };
export type Analysis = ReturnType<typeof analyze>;

export function parseFilters(params: URLSearchParams): Filters {
  const year = Number(params.get('year'));
  const month = Number(params.get('month') ?? 1);
  const span = Number(params.get('span') ?? 5);
  if (
    !Number.isInteger(year) ||
    year < 1900 ||
    year > 9999 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    ![3, 5, 10].includes(span)
  )
    throw Error('Période invalide');
  const rubrics = [...new Set(params.getAll('rubric'))];
  if (rubrics.some((id) => !Object.hasOwn(rubricLabels, id)))
    throw Error('Rubrique invalide');
  const group = params.get('group') ?? 'all';
  if (group !== 'all' && group !== 'region' && group !== 'service')
    throw Error('Comparaison invalide');
  const metric = params.get('metric') ?? '';
  if (metric && !metrics.has(metric)) throw Error('Indicateur invalide');
  return {
    year,
    month,
    span,
    group,
    rubrics,
    metric,
    ids: [...new Set(params.getAll('id'))],
    mode: params.get('mode') === 'year' ? 'year' : 'month',
    trend: params.get('trend') === 'years' ? 'years' : 'months',
  };
}

function summarize(reports: Validated[], selected: string[]): Bucket {
  const sums: Record<string, number> = {};
  const observations: Record<string, number> = {};
  for (const report of reports) {
    if (!report.data || typeof report.data !== 'object') continue;
    const data = report.data as Record<string, unknown>;
    function add(id: string, value: number | undefined) {
      if (value === undefined) return;
      sums[id] = (sums[id] ?? 0) + value;
      observations[id] = (observations[id] ?? 0) + 1;
    }
    for (const [id] of numericCells) add(id, readNumber(data[id]));
    for (const row of Array.isArray(data.__tables) ? data.__tables : []) {
      if (!row || !Array.isArray(row.values)) continue;
      dynamicFields[row.rubric]?.forEach((field, index) => {
        if (field.kind === 'number')
          add(`${row.rubric}:${index}`, readNumber(row.values[index]));
      });
    }
  }
  const values: Bucket['values'] = {};
  for (const id of selected) {
    const metric = metrics.get(id)!;
    const value =
      metric.percent && observations[id] !== 1
        ? undefined
        : calculate(id, sums);
    values[id] = value === undefined ? null : Number(value.toPrecision(14));
  }
  return { count: reports.length, values };
}

export function analyze(
  filters: Filters,
  services: Service[],
  reports: Validated[],
  workflow: WorkflowReport[] = reports.map((report) => ({
    ...report,
    status: 'VALIDE',
  })),
) {
  const serviceMap = new Map(services.map((service) => [service.id, service]));
  const catalog =
    filters.group === 'region'
      ? [
          ...new Map(
            services.map((service) => [service.region.id, service.region]),
          ).values(),
        ]
      : services.map((service) => ({
          id: service.id,
          name: service.name + ' · ' + service.region.name,
        }));
  const groups: Entity[] =
    filters.group === 'all'
      ? [{ id: 'all', name: 'Périmètre autorisé' }]
      : catalog
          .filter((entity) => filters.ids.includes(entity.id))
          .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const periods =
    filters.trend === 'months'
      ? months.map((label, index) => ({
          label,
          year: filters.year,
          month: index + 1,
        }))
      : Array.from(
          { length: filters.span },
          (_, index) => filters.year - filters.span + 1 + index,
        )
          .filter((year) => year >= 1900)
          .map((year) => ({ label: String(year), year, month: 0 }));
  const indicators = [...metrics].filter(
    ([, field]) =>
      !filters.rubrics.length || filters.rubrics.includes(field.rubric),
  );
  const keys = indicators.map(([id]) => id);
  const periodReports = <T extends Pick<Validated, 'year' | 'month'>>(
    data: T[],
    year: number,
    month: number,
  ) =>
    data.filter(
      (report) => report.year === year && (!month || report.month === month),
    );
  const results = groups.map((group) => {
    const members = services.filter(
      (service) =>
        filters.group === 'all' ||
        (filters.group === 'region' ? service.region.id : service.id) ===
          group.id,
    );
    const scoped = reports.filter((report) => {
      const service = serviceMap.get(report.serviceId);
      return (
        service &&
        (filters.group === 'all' ||
          (filters.group === 'region' ? service.region.id : service.id) ===
            group.id)
      );
    });
    const current = periodReports(
      scoped,
      filters.year,
      filters.mode === 'year' ? 0 : filters.month,
    );
    const previous =
      filters.mode === 'year'
        ? periodReports(scoped, filters.year - 1, 0)
        : periodReports(
            scoped,
            filters.year - (filters.month === 1 ? 1 : 0),
            filters.month === 1 ? 12 : filters.month - 1,
          );
    return {
      ...group,
      services: members.length,
      current: summarize(current, keys),
      previous: summarize(previous, keys),
      trend: periods.map((period) =>
        summarize(periodReports(scoped, period.year, period.month), keys),
      ),
    };
  });
  const scopedWorkflow = workflow.filter((report) => {
    const service = serviceMap.get(report.serviceId);
    return (
      service &&
      (filters.group === 'all' ||
        filters.ids.includes(
          filters.group === 'region' ? service.region.id : service.id,
        ))
    );
  });
  const workflowNow = periodReports(
    scopedWorkflow,
    filters.year,
    filters.mode === 'year' ? 0 : filters.month,
  );
  const regional = new Map<
    string,
    { id: string; name: string; expected: number; transmitted: number }
  >();
  for (const service of services) {
    if (
      filters.group !== 'all' &&
      !filters.ids.includes(
        filters.group === 'region' ? service.region.id : service.id,
      )
    )
      continue;
    const region = regional.get(service.region.id) ?? {
      ...service.region,
      expected: 0,
      transmitted: 0,
    };
    region.expected += filters.mode === 'year' ? 12 : 1;
    regional.set(region.id, region);
  }
  for (const report of workflowNow) {
    const region = regional.get(serviceMap.get(report.serviceId)!.region.id);
    if (region && transmittedStatuses.has(report.status))
      region.transmitted += 1;
  }
  const operational = {
    regions: [...regional.values()].sort(
      (a, b) =>
        b.transmitted / b.expected - a.transmitted / a.expected ||
        a.name.localeCompare(b.name, 'fr'),
    ),
    expected: [...regional.values()].reduce(
      (sum, region) => sum + region.expected,
      0,
    ),
    validated: workflowNow.filter((report) => report.status === 'VALIDE')
      .length,
    pending: workflowNow.filter((report) => report.status === 'SOUMIS').length,
    correction: workflowNow.filter(
      (report) => report.status === 'REVOQUE' || report.status === 'CORRIGE',
    ).length,
    transmitted: workflowNow.filter((report) =>
      transmittedStatuses.has(report.status),
    ).length,
    toReview: workflowNow
      .filter((report) =>
        ['SOUMIS', 'REVOQUE', 'CORRIGE'].includes(report.status),
      )
      .map((report) => {
        const service = serviceMap.get(report.serviceId)!;
        return {
          serviceId: service.id,
          region: service.region.name,
          service: service.name,
          month: report.month,
          status: report.status,
        };
      })
      .sort(
        (a, b) =>
          b.month - a.month ||
          a.region.localeCompare(b.region, 'fr') ||
          a.service.localeCompare(b.service, 'fr'),
      ),
    byMonth: months.map((label, index) => ({
      label,
      count: periodReports(scopedWorkflow, filters.year, index + 1).filter(
        (report) => transmittedStatuses.has(report.status),
      ).length,
    })),
  };
  const populated = indicators.filter(([id]) =>
    results.some(
      (result) =>
        result.current.values[id] != null ||
        result.previous.values[id] != null ||
        result.trend.some((point) => point.values[id] != null),
    ),
  );
  const choices = [...populated].sort(([a], [b]) => {
    const score = (id: string) =>
      Number(results.some((result) => result.current.values[id] != null)) * 2 +
      Number(calculatedCells.has(id));
    return score(b) - score(a);
  });
  const metric = choices.some(([id]) => id === filters.metric)
    ? filters.metric
    : (choices[0]?.[0] ?? '');
  const period =
    filters.mode === 'year'
      ? String(filters.year)
      : `${months[filters.month - 1]} ${filters.year}`;
  return {
    operational,
    filters,
    period,
    periods,
    metric,
    results,
    indicators: populated.map(([id, field]) => ({ id, ...field })),
  };
}
