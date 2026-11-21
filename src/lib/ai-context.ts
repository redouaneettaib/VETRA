import {
  analyze,
  metrics,
  months,
  rubricLabels,
  type Filters,
  type Service,
} from './analytics';
import {
  calculate,
  dynamicFields,
  numericCells,
  readNumber,
} from './forms';

export interface ScopedService extends Service {
  kind: 'PROVINCIAL' | 'FRONTALIER';
}

export interface ScopedReport {
  id: string;
  serviceId: string;
  year: number;
  month: number;
  status: string;
  reason?: string | null;
  data: unknown;
}

export interface StatisticalAnomaly {
  id: string;
  kind:
    | 'SPIKE'
    | 'DROP_TO_ZERO'
    | 'OUT_OF_RANGE_PERCENT'
    | 'REVOKED'
    | 'MISSING_SUBMISSION';
  severityHint: 'HAUTE' | 'MOYENNE' | 'INFO';
  reportId: string | null;
  serviceId: string;
  serviceName: string;
  serviceKind: 'PROVINCIAL' | 'FRONTALIER';
  regionName: string;
  status: string;
  rubric: string;
  rubricLabel: string;
  metricId: string;
  metricLabel: string;
  observed: number | null;
  baselineMedian: number | null;
  ratio: number | null;
  historyMonths: number;
  note: string;
}

export interface WeakSignalCandidate {
  id: string;
  pattern:
    | 'CONSECUTIVE_RISE'
    | 'MULTI_REGION_SURGE'
    | 'COVERAGE_DECLINE';
  rubric: string;
  rubricLabel: string;
  metricId: string;
  metricLabel: string;
  regions: string[];
  series: Array<{ period: string; value: number }>;
  changePercent: number | null;
  summary: string;
}

export function extractReportNumbers(data: unknown): Record<string, number> {
  if (!data || typeof data !== 'object') return {};
  const record = data as Record<string, unknown>;
  const sums: Record<string, number> = {};
  const add = (id: string, value: number | undefined) => {
    if (value === undefined) return;
    sums[id] = (sums[id] ?? 0) + value;
  };
  for (const [id] of numericCells) add(id, readNumber(record[id]));
  for (const row of Array.isArray(record.__tables) ? record.__tables : []) {
    if (!row || typeof row !== 'object' || !Array.isArray((row as { values?: unknown[] }).values))
      continue;
    const typedRow = row as { rubric?: string; values: unknown[] };
    if (!typedRow.rubric) continue;
    dynamicFields[typedRow.rubric]?.forEach((field, index) => {
      if (field.kind === 'number') {
        add(`${typedRow.rubric}:${index}`, readNumber(typedRow.values[index]));
      }
    });
  }
  const out: Record<string, number> = {};
  for (const [id] of metrics) {
    const val = calculate(id, sums);
    if (val !== undefined && Number.isFinite(val)) {
      out[id] = Number(val.toPrecision(12));
    }
  }
  return out;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function trailingPeriods(
  year: number,
  month: number,
  count: number,
): Array<{ year: number; month: number; label: string }> {
  const list: Array<{ year: number; month: number; label: string }> = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const totalMonths = year * 12 + (month - 1) - offset;
    const y = Math.floor(totalMonths / 12);
    const m = (totalMonths % 12) + 1;
    list.push({
      year: y,
      month: m,
      label: `${months[m - 1]} ${y}`,
    });
  }
  return list;
}

export function detectStatisticalAnomalies(
  services: ScopedService[],
  reports: ScopedReport[],
  year: number,
  month: number,
): StatisticalAnomaly[] {
  const serviceMap = new Map(services.map((s) => [s.id, s]));
  const targetYM = year * 12 + (month - 1);
  const currentByService = new Map<string, ScopedReport>();
  const historyByService = new Map<string, Array<Record<string, number>>>();

  for (const report of reports) {
    if (!serviceMap.has(report.serviceId)) continue;
    const ym = report.year * 12 + (report.month - 1);
    if (ym === targetYM) {
      currentByService.set(report.serviceId, report);
    } else if (
      ym < targetYM &&
      ym >= targetYM - 12 &&
      report.status === 'VALIDE'
    ) {
      const list = historyByService.get(report.serviceId) ?? [];
      list.push(extractReportNumbers(report.data));
      historyByService.set(report.serviceId, list);
    }
  }

  const anomalies: StatisticalAnomaly[] = [];

  for (const service of services) {
    const report = currentByService.get(service.id);
    const history = historyByService.get(service.id) ?? [];

    if (!report) {
      if (history.length >= 3) {
        anomalies.push({
          id: `missing:${service.id}`,
          kind: 'MISSING_SUBMISSION',
          severityHint: 'MOYENNE',
          reportId: null,
          serviceId: service.id,
          serviceName: service.name,
          serviceKind: service.kind,
          regionName: service.region.name,
          status: 'NON INTRODUIT',
          rubric: 'GLOBAL',
          rubricLabel: 'Suivi de transmission',
          metricId: 'coverage',
          metricLabel: 'Rapport mensuel non introduit',
          observed: 0,
          baselineMedian: 1,
          ratio: 0,
          historyMonths: history.length,
          note: `Service habituellement actif (${history.length} rapports validés sur les 12 derniers mois), aucun rapport saisi pour ${months[month - 1]} ${year}.`,
        });
      }
      continue;
    }

    if (report.status === 'REVOQUE') {
      anomalies.push({
        id: `revoked:${report.id}`,
        kind: 'REVOKED',
        severityHint: 'MOYENNE',
        reportId: report.id,
        serviceId: service.id,
        serviceName: service.name,
        serviceKind: service.kind,
        regionName: service.region.name,
        status: report.status,
        rubric: 'GLOBAL',
        rubricLabel: 'Validation hiérarchique',
        metricId: 'workflow',
        metricLabel: 'Rapport révoqué en attente de correction',
        observed: null,
        baselineMedian: null,
        ratio: null,
        historyMonths: history.length,
        note: report.reason?.trim()
          ? `Motif enregistré : ${report.reason.trim()}`
          : 'Rapport révoqué non encore resoumis.',
      });
    }

    const currentVals = extractReportNumbers(report.data);
    for (const [metricId, value] of Object.entries(currentVals)) {
      const meta = metrics.get(metricId);
      if (!meta) continue;
      if (meta.percent && (value < 0 || value > 100)) {
        anomalies.push({
          id: `pct:${report.id}:${metricId}`,
          kind: 'OUT_OF_RANGE_PERCENT',
          severityHint: 'HAUTE',
          reportId: report.id,
          serviceId: service.id,
          serviceName: service.name,
          serviceKind: service.kind,
          regionName: service.region.name,
          status: report.status,
          rubric: meta.rubric,
          rubricLabel: rubricLabels[meta.rubric] ?? meta.rubric,
          metricId,
          metricLabel: meta.label,
          observed: value,
          baselineMedian: null,
          ratio: null,
          historyMonths: history.length,
          note: `Pourcentage hors bornes [0–100 %] : ${value} %.`,
        });
        continue;
      }

      if (meta.percent) continue;
      const pastValues = history
        .map((entry) => entry[metricId])
        .filter((v): v is number => v !== undefined && Number.isFinite(v));
      if (pastValues.length < 2) continue;

      const positivePast = pastValues.filter((v) => v > 0);
      const base = positivePast.length ? median(positivePast) : 0;

      if (base > 0 && value >= base * 3.5 && value - base >= 10) {
        const ratio = Number((value / base).toFixed(2));
        anomalies.push({
          id: `spike:${report.id}:${metricId}`,
          kind: 'SPIKE',
          severityHint: ratio >= 8 ? 'HAUTE' : 'MOYENNE',
          reportId: report.id,
          serviceId: service.id,
          serviceName: service.name,
          serviceKind: service.kind,
          regionName: service.region.name,
          status: report.status,
          rubric: meta.rubric,
          rubricLabel: rubricLabels[meta.rubric] ?? meta.rubric,
          metricId,
          metricLabel: meta.label,
          observed: value,
          baselineMedian: Number(base.toFixed(2)),
          ratio,
          historyMonths: pastValues.length,
          note: `Valeur ${ratio}× supérieure à la médiane historique (${base.toLocaleString('fr-FR')} sur ${pastValues.length} mois).`,
        });
      } else if (
        value === 0 &&
        positivePast.length >= 3 &&
        base >= 15
      ) {
        anomalies.push({
          id: `drop:${report.id}:${metricId}`,
          kind: 'DROP_TO_ZERO',
          severityHint: 'MOYENNE',
          reportId: report.id,
          serviceId: service.id,
          serviceName: service.name,
          serviceKind: service.kind,
          regionName: service.region.name,
          status: report.status,
          rubric: meta.rubric,
          rubricLabel: rubricLabels[meta.rubric] ?? meta.rubric,
          metricId,
          metricLabel: meta.label,
          observed: 0,
          baselineMedian: Number(base.toFixed(2)),
          ratio: 0,
          historyMonths: positivePast.length,
          note: `Chute à zéro alors que la médiane historique est de ${base.toLocaleString('fr-FR')} (${positivePast.length} mois actifs).`,
        });
      }
    }
  }

  const weight = (a: StatisticalAnomaly) => {
    const sev = a.severityHint === 'HAUTE' ? 300 : a.severityHint === 'MOYENNE' ? 200 : 100;
    const typeBonus =
      a.kind === 'OUT_OF_RANGE_PERCENT'
        ? 50
        : a.kind === 'SPIKE'
          ? 40 + Math.min(40, a.ratio ?? 0)
          : a.kind === 'DROP_TO_ZERO'
            ? 30
            : a.kind === 'REVOKED'
              ? 20
              : 10;
    return sev + typeBonus;
  };

  return anomalies.sort((a, b) => weight(b) - weight(a)).slice(0, 28);
}

export function detectWeakSignals(
  services: ScopedService[],
  reports: ScopedReport[],
  year: number,
  month: number,
): WeakSignalCandidate[] {
  const windowPeriods = trailingPeriods(year, month, 6);
  const periodKeys = windowPeriods.map((p) => `${p.year}-${p.month}`);
  const serviceMap = new Map(services.map((s) => [s.id, s]));
  const regions = [
    ...new Map(services.map((s) => [s.region.id, s.region.name])).entries(),
  ];

  // regionId -> metricId -> periodIndex -> sum
  const regionMetricTotals = new Map<
    string,
    Map<string, number[]>
  >();
  // regionId -> periodIndex -> validated count
  const regionValidatedCount = new Map<string, number[]>();
  const regionServiceTotal = new Map<string, number>();

  for (const s of services) {
    regionServiceTotal.set(
      s.region.id,
      (regionServiceTotal.get(s.region.id) ?? 0) + 1,
    );
  }

  for (const report of reports) {
    if (report.status !== 'VALIDE') continue;
    const service = serviceMap.get(report.serviceId);
    if (!service) continue;
    const pIdx = periodKeys.indexOf(`${report.year}-${report.month}`);
    if (pIdx < 0) continue;

    const rId = service.region.id;
    const counts = regionValidatedCount.get(rId) ?? Array(6).fill(0);
    counts[pIdx] += 1;
    regionValidatedCount.set(rId, counts);

    const vals = extractReportNumbers(report.data);
    let mMap = regionMetricTotals.get(rId);
    if (!mMap) {
      mMap = new Map();
      regionMetricTotals.set(rId, mMap);
    }
    for (const [metricId, value] of Object.entries(vals)) {
      const meta = metrics.get(metricId);
      if (!meta || meta.percent || value <= 0) continue;
      const arr = mMap.get(metricId) ?? Array(6).fill(0);
      arr[pIdx] += value;
      mMap.set(metricId, arr);
    }
  }

  const candidates: WeakSignalCandidate[] = [];

  // 1. Multi-region simultaneous surge in latest period vs trailing 3-month average
  const surgingRegionsByMetric = new Map<
    string,
    Array<{ regionName: string; latest: number; avgPrev: number; pct: number }>
  >();

  for (const [rId, rName] of regions) {
    const mMap = regionMetricTotals.get(rId);
    if (!mMap) continue;
    for (const [metricId, arr] of mMap.entries()) {
      const latest = arr[5];
      const prev3 = arr.slice(2, 5);
      const avgPrev = prev3.reduce((s, v) => s + v, 0) / 3;
      if (avgPrev >= 5 && latest >= avgPrev * 1.4 && latest - avgPrev >= 5) {
        const pct = Math.round(((latest - avgPrev) / avgPrev) * 100);
        const list = surgingRegionsByMetric.get(metricId) ?? [];
        list.push({ regionName: rName, latest, avgPrev, pct });
        surgingRegionsByMetric.set(metricId, list);
      }

      // 2. Consecutive 3-month rise within a region (indices 2 -> 3 -> 4 -> 5)
      if (
        arr[2] > 0 &&
        arr[3] > arr[2] &&
        arr[4] > arr[3] &&
        arr[5] > arr[4] &&
        arr[5] >= arr[2] * 1.25 &&
        arr[5] - arr[2] >= 5
      ) {
        const meta = metrics.get(metricId);
        if (meta) {
          const pct = Math.round(((arr[5] - arr[2]) / arr[2]) * 100);
          candidates.push({
            id: `rise:${rId}:${metricId}`,
            pattern: 'CONSECUTIVE_RISE',
            rubric: meta.rubric,
            rubricLabel: rubricLabels[meta.rubric] ?? meta.rubric,
            metricId,
            metricLabel: meta.label,
            regions: [rName],
            series: windowPeriods.map((p, idx) => ({
              period: p.label,
              value: Number(arr[idx].toPrecision(10)),
            })),
            changePercent: pct,
            summary: `Hausse continue sur 3 mois consécutifs dans la région ${rName} (+${pct} % entre ${windowPeriods[2].label} et ${windowPeriods[5].label}).`,
          });
        }
      }
    }
  }

  for (const [metricId, hits] of surgingRegionsByMetric.entries()) {
    if (hits.length < 2) continue;
    const meta = metrics.get(metricId);
    if (!meta) continue;
    const natSeries = windowPeriods.map((p, idx) => {
      let total = 0;
      for (const [rId] of regions) {
        total += regionMetricTotals.get(rId)?.get(metricId)?.[idx] ?? 0;
      }
      return { period: p.label, value: Number(total.toPrecision(10)) };
    });
    const avgPct = Math.round(
      hits.reduce((s, h) => s + h.pct, 0) / hits.length,
    );
    candidates.push({
      id: `surge:${metricId}`,
      pattern: 'MULTI_REGION_SURGE',
      rubric: meta.rubric,
      rubricLabel: rubricLabels[meta.rubric] ?? meta.rubric,
      metricId,
      metricLabel: meta.label,
      regions: hits.map((h) => h.regionName),
      series: natSeries,
      changePercent: avgPct,
      summary: `Progression simultanée dans ${hits.length} régions (${hits.map((h) => `${h.regionName} +${h.pct}%`).join(', ')}) par rapport à leur moyenne des 3 mois précédents.`,
    });
  }

  // 3. Regional coverage decline
  for (const [rId, rName] of regions) {
    const totalServices = regionServiceTotal.get(rId) ?? 0;
    if (totalServices < 2) continue;
    const counts = regionValidatedCount.get(rId) ?? Array(6).fill(0);
    const rates = counts.map((c) => Math.round((c / totalServices) * 100));
    const prevAvg = (rates[2] + rates[3] + rates[4]) / 3;
    const latestRate = rates[5];
    if (prevAvg >= 60 && latestRate <= prevAvg - 25) {
      candidates.push({
        id: `cov:${rId}`,
        pattern: 'COVERAGE_DECLINE',
        rubric: 'GLOBAL',
        rubricLabel: 'Couverture de reporting',
        metricId: 'validation_rate',
        metricLabel: 'Taux de validation régional',
        regions: [rName],
        series: windowPeriods.map((p, idx) => ({
          period: p.label,
          value: rates[idx],
        })),
        changePercent: Math.round(latestRate - prevAvg),
        summary: `Baisse du taux de validation dans la région ${rName} (${latestRate} % en ${windowPeriods[5].label} contre ${Math.round(prevAvg)} % en moyenne sur les 3 mois précédents).`,
      });
    }
  }

  const score = (c: WeakSignalCandidate) =>
    (c.pattern === 'MULTI_REGION_SURGE' ? 200 + c.regions.length * 25 : c.pattern === 'CONSECUTIVE_RISE' ? 140 : 120) +
    Math.min(100, Math.abs(c.changePercent ?? 0));

  return candidates.sort((a, b) => score(b) - score(a)).slice(0, 16);
}

export function buildExecutiveContext(
  services: ScopedService[],
  reports: ScopedReport[],
  filters: Filters,
) {
  const validated = reports.filter((r) => r.status === 'VALIDE');
  const workflow = reports.map((r) => ({
    serviceId: r.serviceId,
    year: r.year,
    month: r.month,
    status: r.status,
  }));

  const mainAnalysis = analyze(filters, services, validated, workflow);

  const regionIds = [...new Set(services.map((s) => s.region.id))];
  const regionalAnalysis = analyze(
    { ...filters, group: 'region', ids: regionIds },
    services,
    validated,
    workflow,
  );

  // Build top indicators with non-null current or previous values
  const topIndicators = mainAnalysis.indicators
    .map((ind) => {
      const primary = mainAnalysis.results[0];
      const current = primary?.current.values[ind.id] ?? null;
      const previous = primary?.previous.values[ind.id] ?? null;
      const delta =
        current != null && previous != null
          ? Number((current - previous).toPrecision(10))
          : null;
      const pct =
        delta != null && previous && previous !== 0
          ? Math.round((delta / Math.abs(previous)) * 100)
          : null;
      return {
        id: ind.id,
        rubric: ind.rubric,
        rubricLabel: rubricLabels[ind.rubric] ?? ind.rubric,
        label: ind.label,
        percent: ind.percent,
        current,
        previous,
        delta,
        pct,
      };
    })
    .filter((i) => (i.current ?? 0) !== 0 || (i.previous ?? 0) !== 0)
    .sort((a, b) => Math.abs(b.delta ?? b.current ?? 0) - Math.abs(a.delta ?? a.current ?? 0))
    .slice(0, 40);

  const opRegionMap = new Map(
    regionalAnalysis.operational.regions.map((reg) => [reg.id, reg]),
  );
  const periodFactor = filters.mode === 'year' ? 12 : 1;
  const regionalCoverage = regionalAnalysis.results.map((r) => {
    const op = opRegionMap.get(r.id);
    const expected = op?.expected ?? r.services * periodFactor;
    const transmitted = op?.transmitted ?? r.current.count;
    return {
      region: r.name,
      validatedReports: r.current.count,
      expectedReports: expected,
      transmittedReports: transmitted,
      validationRate: expected
        ? Math.round((r.current.count / expected) * 100)
        : 0,
    };
  });

  // Workflow breakdown for target period
  const targetReports = reports.filter(
    (r) =>
      r.year === filters.year &&
      (filters.mode === 'year' || r.month === filters.month),
  );
  const statusCounts: Record<string, number> = {
    VALIDE: 0,
    SOUMIS: 0,
    REVOQUE: 0,
    CORRIGE: 0,
    BROUILLON: 0,
  };
  for (const r of targetReports) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  }

  return {
    periodLabel: mainAnalysis.period,
    comparisonLabel:
      filters.mode === 'year'
        ? `Année ${filters.year - 1}`
        : `${months[filters.month === 1 ? 11 : filters.month - 2]} ${filters.month === 1 ? filters.year - 1 : filters.year}`,
    totalServices: services.length,
    provincialServices: services.filter((s) => s.kind === 'PROVINCIAL').length,
    borderServices: services.filter((s) => s.kind === 'FRONTALIER').length,
    statusCounts,
    groups: mainAnalysis.results.map((g) => ({
      name: g.name,
      servicesCount: g.services,
      validatedReports: g.current.count,
      expectedReports: g.services * periodFactor,
    })),
    regionalCoverage,
    topIndicators,
  };
}

export function buildQaContext(
  services: ScopedService[],
  reports: ScopedReport[],
  year: number,
  month: number,
) {
  const serviceMap = new Map(services.map((s) => [s.id, s]));
  const currentMonthReports = reports.filter(
    (r) => r.year === year && r.month === month,
  );
  const byStatus: Record<string, number> = {
    VALIDE: 0,
    SOUMIS: 0,
    REVOQUE: 0,
    CORRIGE: 0,
    BROUILLON: 0,
  };
  const reportedServiceIds = new Set<string>();
  for (const r of currentMonthReports) {
    if (!serviceMap.has(r.serviceId)) continue;
    reportedServiceIds.add(r.serviceId);
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }
  const missingServices = services
    .filter((s) => !reportedServiceIds.has(s.id))
    .map((s) => `${s.name} (${s.region.name}, ${s.kind})`);

  const validated = reports.filter((r) => r.status === 'VALIDE');
  const workflow = reports.map((r) => ({
    serviceId: r.serviceId,
    year: r.year,
    month: r.month,
    status: r.status,
  }));

  const yearAnalysis = analyze(
    {
      year,
      month,
      mode: 'year',
      trend: 'months',
      span: 5,
      group: 'all',
      ids: [],
      rubrics: [],
      metric: '',
    },
    services,
    validated,
    workflow,
  );

  const monthAnalysis = analyze(
    {
      year,
      month,
      mode: 'month',
      trend: 'months',
      span: 5,
      group: 'all',
      ids: [],
      rubrics: [],
      metric: '',
    },
    services,
    validated,
    workflow,
  );

  const regionIds = [...new Set(services.map((s) => s.region.id))];
  const regionYearAnalysis = analyze(
    {
      year,
      month,
      mode: 'year',
      trend: 'months',
      span: 5,
      group: 'region',
      ids: regionIds,
      rubrics: [],
      metric: '',
    },
    services,
    validated,
    workflow,
  );

  const kindBreakdown = (['PROVINCIAL', 'FRONTALIER'] as const).map((kind) => {
    const subset = services.filter((s) => s.kind === kind);
    const subIds = new Set(subset.map((s) => s.id));
    const subMonth = currentMonthReports.filter((r) => subIds.has(r.serviceId));
    const subYearValid = validated.filter(
      (r) => r.year === year && subIds.has(r.serviceId),
    );
    return {
      kind,
      serviceCount: subset.length,
      currentMonthValidated: subMonth.filter((r) => r.status === 'VALIDE').length,
      currentMonthSubmitted: subMonth.filter((r) => r.status === 'SOUMIS').length,
      yearValidatedReports: subYearValid.length,
    };
  });

  const activeIndicators = yearAnalysis.indicators
    .map((ind) => {
      const yCur = yearAnalysis.results[0]?.current.values[ind.id] ?? null;
      const yPrev = yearAnalysis.results[0]?.previous.values[ind.id] ?? null;
      const mCur = monthAnalysis.results[0]?.current.values[ind.id] ?? null;
      const mPrev = monthAnalysis.results[0]?.previous.values[ind.id] ?? null;
      return {
        rubric: ind.rubric,
        rubricLabel: rubricLabels[ind.rubric] ?? ind.rubric,
        label: ind.label,
        percent: ind.percent,
        monthCurrent: mCur,
        monthPrevious: mPrev,
        yearCurrent: yCur,
        yearPrevious: yPrev,
      };
    })
    .filter(
      (i) =>
        (i.yearCurrent ?? 0) !== 0 ||
        (i.yearPrevious ?? 0) !== 0 ||
        (i.monthCurrent ?? 0) !== 0,
    )
    .slice(0, 60);

  const regionSummary = regionYearAnalysis.results.map((r) => {
    const regionServices = services.filter((s) => s.region.name === r.name);
    const rServiceIds = new Set(regionServices.map((s) => s.id));
    const rMonthReports = currentMonthReports.filter((rep) =>
      rServiceIds.has(rep.serviceId),
    );
    const topRegionMetrics = Object.entries(r.current.values)
      .filter(([, val]) => val != null && val !== 0)
      .sort((a, b) => Math.abs((b[1] ?? 0)) - Math.abs((a[1] ?? 0)))
      .slice(0, 8)
      .map(([id, val]) => ({
        label: metrics.get(id)?.label ?? id,
        rubric: metrics.get(id)?.rubric ?? '',
        value: val,
      }));
    return {
      region: r.name,
      servicesCount: regionServices.length,
      currentMonthValidated: rMonthReports.filter((rep) => rep.status === 'VALIDE').length,
      currentMonthSubmitted: rMonthReports.filter((rep) => rep.status === 'SOUMIS').length,
      currentMonthRevoked: rMonthReports.filter((rep) => rep.status === 'REVOQUE').length,
      currentMonthMissing:
        regionServices.length - rMonthReports.length,
      yearValidatedReports: r.current.count,
      yearExpectedReports: r.services * 12,
      topYearMetrics: topRegionMetrics,
    };
  });

  return {
    referencePeriod: `${months[month - 1]} ${year}`,
    year,
    month,
    nationalServicesCount: services.length,
    currentMonthWorkflow: {
      ...byStatus,
      NON_INTRODUIT: missingServices.length,
    },
    missingServicesSample: missingServices.slice(0, 30),
    kindBreakdown,
    regionSummary,
    activeIndicators,
  };
}
