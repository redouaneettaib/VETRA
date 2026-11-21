import type { Prisma, PrismaClient } from '@prisma/client';
import { cellRubric } from './forms';

const LEGACY_SEED_CELLS = new Set([
  'B9',
  'C9',
  'D9',
  'B10',
  'C10',
  'D10',
  'B11',
  'C11',
]);

export type DcspServiceLike = {
  name: string;
  kind?: string | null;
  rights?: { rubricId: string; enabled: boolean }[];
};

export function isDcspService(service: DcspServiceLike): boolean {
  if (service.kind === 'FRONTALIER') return true;
  if (/\bdcsp\b/i.test(service.name)) return true;
  if (service.rights && service.rights.length > 0) {
    const enabled = service.rights
      .filter((right) => right.enabled)
      .map((right) => right.rubricId);
    if (enabled.length === 1 && enabled[0] === 'IV') return true;
  }
  return false;
}

/**
 * Construit un jeu de données de démonstration réaliste et strictement
 * conforme à la rubrique IV (Activités relatives à l'importation) pour un
 * service frontalier / DCSP. Aucune cellule d'une autre rubrique ni aucune
 * cellule de formule calculée n'est renseignée.
 */
export function buildDcspDemoReportData(
  serviceIndex: number,
  year: number,
  month: number,
): Record<string, unknown> {
  const s = Math.max(0, serviceIndex);
  const yShift = Math.max(0, year - 2025);
  const season = 1 + ((month + s) % 4) * 0.08 + yShift * 0.05;
  const qty = (base: number, step: number) =>
    Math.round((base + ((s * 7 + month * 3 + yShift * 5) % 9) * step) * season);
  const rejected = (controlled: number, seedOffset: number) => {
    // Refoulement / non-admission ponctuel (0 à ~2,5 % des quantités contrôlées)
    if ((s + month + year + seedOffset) % 3 !== 0) return 0;
    return Math.max(
      1,
      Math.min(
        controlled,
        Math.round(controlled * (0.008 + ((month + seedOffset) % 4) * 0.004)),
      ),
    );
  };

  // Tableau 1 : Produits importés (Rubrique IV — lignes 182 à 216, hors totaux calculés)
  const c182 = qty(42000, 1800); // Aliments simples
  const c183 = qty(8500, 420); // Additifs et prémélanges
  const c184 = qty(6200, 310); // Aliments pour chiens et chats
  const c185 = qty(18400, 900); // Aliments composés
  const c186 = qty(4600, 250); // Lacto-remplaceurs
  const c188 = qty(9800, 480); // Autres produits comestibles
  const c190 = qty(3400, 190); // Boyaux
  const c192 = qty(24500, 1100); // Lait en poudre
  const c193 = qty(16800, 760); // Fromages
  const c194 = qty(11200, 520); // Beurre
  const c195 = qty(7400, 340); // Lait
  const c196 = qty(5900, 280); // Lait pour enfants
  const c197 = qty(6300, 300); // Autres produits laitiers
  const c199 = qty(125000, 6000); // Œufs de consommation (unités)
  const c200 = qty(4200, 210); // Ovo produits (kg)
  const c201 = qty(5100, 240); // Produits à base de viandes blanches et abats
  const c203 = qty(4800, 230); // Produits à base de viandes rouges et abats
  const c205 = qty(3900, 180); // Miel
  const c206 = qty(1200, 90); // Autres produits apicoles
  const c208 = qty(14600, 680); // Peaux et cuirs
  const c209 = qty(5400, 260); // Laines
  const c210 = qty(3100, 170); // Autres sous produits animaux
  const c212 = qty(19500, 880); // Viandes blanches
  const c213 = qty(4300, 210); // Abats (viandes blanches)
  const c215 = qty(6700, 320); // Abats (viandes rouges)
  const c216 = qty(28400, 1250); // Viandes rouges

  // Tableau 2 : Dossiers et certificats à l'importation (lignes 220 à 226)
  const admis = 95 + s * 14 + yShift * 8 + month * 4;
  const nonAdmis = 1 + ((s + month + year) % 4);
  const dossiersTraites = admis + nonAdmis;
  const refoulements = Math.max(1, nonAdmis - ((month + s) % 2));
  const prelevements = Math.min(
    dossiersTraites,
    Math.round(dossiersTraites * 0.24) + (month % 5),
  );
  const anomaliesDoc = Math.min(
    dossiersTraites,
    5 + ((s * 2 + month + year) % 9),
  );
  const regularises = Math.max(0, anomaliesDoc - Math.min(anomaliesDoc, nonAdmis));

  return {
    __demo: true,
    __completed: ['IV'],
    C182: c182,
    D182: rejected(c182, 1),
    C183: c183,
    D183: rejected(c183, 2),
    C184: c184,
    D184: rejected(c184, 3),
    C185: c185,
    D185: rejected(c185, 4),
    C186: c186,
    D186: rejected(c186, 5),
    C188: c188,
    D188: rejected(c188, 6),
    C190: c190,
    D190: rejected(c190, 7),
    C192: c192,
    D192: rejected(c192, 8),
    C193: c193,
    D193: rejected(c193, 9),
    C194: c194,
    D194: rejected(c194, 10),
    C195: c195,
    D195: rejected(c195, 11),
    C196: c196,
    D196: rejected(c196, 12),
    C197: c197,
    D197: rejected(c197, 13),
    C199: c199,
    D199: rejected(c199, 14),
    C200: c200,
    D200: rejected(c200, 15),
    C201: c201,
    D201: rejected(c201, 16),
    C203: c203,
    D203: rejected(c203, 17),
    C205: c205,
    D205: rejected(c205, 18),
    C206: c206,
    D206: rejected(c206, 19),
    C208: c208,
    D208: rejected(c208, 20),
    C209: c209,
    D209: rejected(c209, 21),
    C210: c210,
    D210: rejected(c210, 22),
    C212: c212,
    D212: rejected(c212, 23),
    C213: c213,
    D213: rejected(c213, 24),
    C215: c215,
    D215: rejected(c215, 25),
    C216: c216,
    D216: rejected(c216, 26),
    B220: dossiersTraites,
    B221: admis,
    B222: refoulements,
    B223: prelevements,
    B224: anomaliesDoc,
    B225: regularises,
    B226: nonAdmis,
  };
}

export function needsDcspDemoNormalization(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const record = data as Record<string, unknown>;
  const cellKeys = Object.keys(record).filter((key) => !key.startsWith('__'));
  const hasNonIvCells = cellKeys.some((key) => cellRubric(key) !== 'IV');
  const hasIvCells = cellKeys.some((key) => cellRubric(key) === 'IV');
  const hasNonIvTables =
    Array.isArray(record.__tables) &&
    record.__tables.some(
      (row: unknown) =>
        row &&
        typeof row === 'object' &&
        (row as { rubric?: unknown }).rubric !== 'IV',
    );
  const completed = Array.isArray(record.__completed) ? record.__completed : [];
  const hasNonIvCompleted = completed.some((rubric) => rubric !== 'IV');

  if (record.__demo === true) {
    return (
      hasNonIvCells ||
      hasNonIvTables ||
      hasNonIvCompleted ||
      !hasIvCells ||
      !completed.includes('IV')
    );
  }

  // Rattrape également d'anciens rapports de test injectés avec l'ancienne
  // signature B9..C11 (rubrique I.A.1) sans drapeau __demo et sans données IV.
  return (
    !hasIvCells &&
    hasNonIvCells &&
    cellKeys.length > 0 &&
    cellKeys.every((key) => LEGACY_SEED_CELLS.has(key))
  );
}

let normalizedOnce = false;
let normalizationInFlight: Promise<number> | null = null;

/**
 * Normalise de façon idempotente les rapports de test déjà présents en base
 * pour les services DCSP / frontaliers afin qu'ils ne contiennent que des
 * données de la rubrique IV (contrôle à l'importation).
 */
export async function ensureDcspDemoReportsNormalized(
  prisma: PrismaClient,
): Promise<number> {
  if (normalizedOnce) return 0;
  if (normalizationInFlight) return normalizationInFlight;

  normalizationInFlight = (async () => {
    const services = await prisma.service.findMany({
      include: { rights: true },
      orderBy: [{ name: 'asc' }],
    });
    const dcspServices = services.filter((service) => isDcspService(service));
    if (!dcspServices.length) {
      normalizedOnce = true;
      return 0;
    }

    const serviceIndexById = new Map(
      dcspServices.map((service, index) => [service.id, index]),
    );
    const reports = await prisma.report.findMany({
      where: { serviceId: { in: dcspServices.map((service) => service.id) } },
      select: { id: true, serviceId: true, year: true, month: true, data: true },
      orderBy: [{ serviceId: 'asc' }, { year: 'asc' }, { month: 'asc' }],
    });

    const toFix = reports.filter((report) =>
      needsDcspDemoNormalization(report.data),
    );
    if (toFix.length) {
      await prisma.$transaction(
        toFix.map((report) =>
          prisma.report.update({
            where: { id: report.id },
            data: {
              data: buildDcspDemoReportData(
                serviceIndexById.get(report.serviceId) ?? 0,
                report.year,
                report.month,
              ) as Prisma.InputJsonValue,
            },
          }),
        ),
      );
      console.log(
        `VETRA : ${toFix.length} rapport(s) de test DCSP normalisé(s) sur la rubrique IV uniquement.`,
      );
    }

    normalizedOnce = true;
    return toFix.length;
  })()
    .catch((error) => {
      console.warn(
        'VETRA : normalisation DCSP différée :',
        error instanceof Error ? error.message : error,
      );
      return 0;
    })
    .finally(() => {
      normalizationInFlight = null;
    });

  return normalizationInFlight;
}
