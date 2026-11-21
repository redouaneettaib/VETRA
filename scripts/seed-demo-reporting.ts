/**
 * Jeu de données de démonstration pour vérifier le reporting VETRA.
 *
 * Sécurité : le script ne remplace jamais un rapport existant par défaut.
 * Pour supprimer les anciennes données fictives sélectionnées, utiliser
 * DEMO_RESET=true. DEMO_RESET_ALL=true supprime tous les rapports marqués
 * __demo, quel que soit le service.
 */
import { Prisma, PrismaClient, Status } from '@prisma/client';
import {
  buildDcspDemoReportData,
  isDcspService,
  needsDcspDemoNormalization,
} from '../src/lib/demo-dcsp';

const db = new PrismaClient();
const overwrite = process.env.DEMO_OVERWRITE === 'true';
const resetDemo = process.env.DEMO_RESET === 'true';
const resetAllDemo = process.env.DEMO_RESET_ALL === 'true';
const statuses: Status[] = ['VALIDE', 'SOUMIS', 'BROUILLON', 'REVOQUE', 'CORRIGE'];
const selectedServiceNames = [
  'Service vétérinaire de la DCSP de Casablanca',
  "Service vétérinaire d'El Jadida",
  'Service vétérinaire préfectoral de Casablanca',
  'Service vétérinaire provincial de Fès',
  'Service vétérinaire provincial de Kénitra',
  'Service vétérinaire provincial de Mohammedia',
  'Service vétérinaire provincial de Nador',
  'Service vétérinaire provincial de Tanger',
];

function statusFor(serviceIndex: number, year: number, month: number): Status {
  return statuses[(serviceIndex * 3 + month + year) % statuses.length];
}

async function main() {
  const services = await db.service.findMany({
    where: { name: { in: selectedServiceNames } },
    include: { rights: true, division: { include: { region: true } } },
    orderBy: [{ division: { region: { name: 'asc' } } }, { name: 'asc' }],
  });
  const foundNames = new Set(services.map((service) => service.name));
  const missing = selectedServiceNames.filter((name) => !foundNames.has(name));
  if (missing.length)
    throw new Error(
      `Services absents de la base : ${missing.join('; ')}. Création fictive annulée.`,
    );
  const regionCount = new Set(services.map((service) => service.division.regionId)).size;
  if (regionCount < 2)
    throw new Error('Les services doivent appartenir à au moins deux régions.');

  if (resetDemo) {
    const oldDemoReports = await db.report.findMany({
      where: resetAllDemo
        ? undefined
        : { serviceId: { in: services.map((service) => service.id) } },
      select: { id: true, data: true },
    });
    const ids = oldDemoReports
      .filter(
        (report) =>
          report.data &&
          typeof report.data === 'object' &&
          !Array.isArray(report.data) &&
          (report.data as Record<string, unknown>).__demo === true,
      )
      .map((report) => report.id);
    if (ids.length) await db.report.deleteMany({ where: { id: { in: ids } } });
    console.log(`${ids.length} ancienne(s) donnée(s) fictive(s) supprimée(s).`);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const [serviceIndex, service] of services.entries()) {
    const dcsp = isDcspService(service);
    for (const [year, lastMonth] of [
      [2025, 12],
      [2026, 10],
    ] as const) {
      for (let month = 1; month <= lastMonth; month++) {
        // Des absences volontaires alimentent le filtre « non introduit ».
        if ((serviceIndex + month + year) % 7 === 0) {
          skipped++;
          continue;
        }
        const existing = await db.report.findUnique({
          where: { serviceId_year_month: { serviceId: service.id, year, month } },
          select: { id: true, data: true },
        });
        const isDemo =
          existing?.data &&
          typeof existing.data === 'object' &&
          !Array.isArray(existing.data) &&
          (existing.data as Record<string, unknown>).__demo === true;
        const fixNonCompliantDcsp =
          dcsp && existing ? needsDcspDemoNormalization(existing.data) : false;
        if (existing && !fixNonCompliantDcsp && (!overwrite || !isDemo)) {
          skipped++;
          continue;
        }
        const base = (serviceIndex + 1) * 100 + (year - 2025) * 25 + month * 4;
        const data: Prisma.InputJsonValue = dcsp
          ? (buildDcspDemoReportData(
              serviceIndex,
              year,
              month,
            ) as Prisma.InputJsonValue)
          : {
              __demo: true,
              B9: base,
              C9: base + 12,
              D9: base + 4,
              B10: base * 10,
              C10: base * 3,
              D10: base,
              B11: (serviceIndex + month) % 8,
              C11: (serviceIndex + month * 2) % 11,
            };
        const status = statusFor(serviceIndex, year, month);
        if (existing) {
          await db.report.update({
            where: { id: existing.id },
            data: fixNonCompliantDcsp ? { data } : { status, data },
          });
          updated++;
        } else {
          await db.report.create({ data: { serviceId: service.id, year, month, status, data } });
          created++;
        }
      }
    }
  }
  console.log(
    `Données de démonstration injectées : ${created} créés, ${updated} mis à jour, ${skipped} conservés/absents. ` +
      `Périodes janvier-décembre 2025 et janvier-octobre 2026, ${services.length} services, ${regionCount} régions (rubrique IV uniquement pour les services DCSP/frontaliers).`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
