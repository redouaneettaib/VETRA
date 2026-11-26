/**
 * Jeu de données de présentation Direction Générale pour VETRA.
 *
 * - Initialise les 12 régions, 12 divisions, et au moins un service vétérinaire
 *   dans chacune des 12 directions régionales (15 services au total).
 * - Crée un compte fictif « Chef de service » pour un service vétérinaire de
 *   chacune des 12 régions (mot de passe lu depuis DEMO_USER_PASSWORD ou
 *   SEED_ADMIN_PASSWORD, jamais codé en dur).
 * - Complète à 100 % (VALIDE) les mois d'août et d'octobre dans le reporting
 *   pour l'ensemble des services actifs (y compris les services déjà présents).
 * - Introduit des rapports avec des pourcentages de complétude différenciés
 *   par service et par région sur les autres mois.
 *
 * Sécurité : ne remplace jamais un rapport réel (non marqué __demo).
 * Utiliser DEMO_OVERWRITE=true pour régénérer les rapports __demo existants,
 * ou DEMO_RESET=true / DEMO_RESET_ALL=true pour nettoyer d'abord les __demo.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  isDcspService,
  needsDcspDemoNormalization,
} from '../src/lib/demo-dcsp';
import {
  isFullReportingMonth,
  planDemoReport,
  PRESENTATION_CHEF_ACCOUNTS,
  PRESENTATION_SERVICES,
  REGION_NAMES,
} from '../src/lib/demo-presentation';
import {
  defaultRubricsForKind,
  effectiveRubrics,
  rubricIds,
} from '../src/lib/forms';

const db = new PrismaClient();
const overwrite = process.env.DEMO_OVERWRITE === 'true';
const resetDemo = process.env.DEMO_RESET === 'true';
const resetAllDemo = process.env.DEMO_RESET_ALL === 'true';

async function main() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 1. S'assurer que les 12 régions et 12 divisions existent
  const regionByName = new Map<string, { id: string; name: string }>();
  const divisionByRegionId = new Map<string, { id: string; name: string }>();
  for (const name of REGION_NAMES) {
    const region = await db.region.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    const division = await db.division.upsert({
      where: { regionId: region.id },
      create: { name: `Division vétérinaire — ${name}`, regionId: region.id },
      update: {},
    });
    regionByName.set(name, region);
    divisionByRegionId.set(region.id, division);
  }

  // 2. S'assurer qu'un service vétérinaire représentatif existe dans chacune des 12 régions
  let servicesCreated = 0;
  const serviceIdBySeedId = new Map<string, string>();
  for (const seed of PRESENTATION_SERVICES) {
    const region = regionByName.get(seed.regionName)!;
    const division = divisionByRegionId.get(region.id)!;
    let service = await db.service.findUnique({
      where: {
        divisionId_name: { divisionId: division.id, name: seed.name },
      },
      include: { rights: true },
    });
    if (!service) {
      const enabled = new Set(defaultRubricsForKind(seed.kind));
      service = await db.service.create({
        data: {
          name: seed.name,
          kind: seed.kind,
          divisionId: division.id,
          rights: {
            create: rubricIds.map((rubricId) => ({
              rubricId,
              enabled: enabled.has(rubricId),
            })),
          },
        },
        include: { rights: true },
      });
      servicesCreated++;
    }
    serviceIdBySeedId.set(seed.id, service.id);
  }

  // 3. Créer les comptes fictifs Chef de service pour les 12 régions (si mot de passe fourni en env)
  const rawPassword =
    process.env.DEMO_USER_PASSWORD?.trim() ||
    process.env.SEED_ADMIN_PASSWORD?.trim() ||
    '';
  let usersCreated = 0;
  let usersSkipped = 0;
  if (rawPassword.length >= 12) {
    const passwordHash = await bcrypt.hash(rawPassword, 12);
    for (const acc of PRESENTATION_CHEF_ACCOUNTS) {
      const region = regionByName.get(acc.regionName)!;
      const division = divisionByRegionId.get(region.id)!;
      const serviceId = serviceIdBySeedId.get(acc.serviceId);
      if (!serviceId) continue;
      const existingUser = await db.user.findUnique({
        where: { email: acc.email },
        select: { id: true },
      });
      if (existingUser) {
        usersSkipped++;
        continue;
      }
      await db.user.create({
        data: {
          name: acc.name,
          firstName: acc.firstName,
          email: acc.email,
          phone: acc.phone,
          role: 'CHEF_SERVICE',
          passwordHash,
          verified: true,
          active: true,
          regionId: region.id,
          divisionId: division.id,
          serviceId,
        },
      });
      usersCreated++;
    }
  } else {
    console.warn(
      'Attention : définissez DEMO_USER_PASSWORD (12 caractères min.) pour créer les comptes fictifs des 12 régions.',
    );
  }

  // 4. Charger tous les services présents en base afin que les mois d'août et octobre atteignent 100 %
  const allServices = await db.service.findMany({
    include: { rights: true, division: { include: { region: true } } },
    orderBy: [{ division: { region: { name: 'asc' } } }, { name: 'asc' }],
  });
  const regionCount = new Set(
    allServices.map((service) => service.division.regionId),
  ).size;

  if (resetDemo) {
    const oldDemoReports = await db.report.findMany({
      where: resetAllDemo
        ? undefined
        : { serviceId: { in: allServices.map((service) => service.id) } },
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
  const yearRanges: [number, number][] = [
    [currentYear - 1, 12],
    [currentYear, Math.max(currentMonth, 10)],
  ];

  for (const [serviceIndex, service] of allServices.entries()) {
    const dcsp = isDcspService(service);
    const permittedRubrics = effectiveRubrics(service.rights, service.kind);

    for (const [year, lastMonth] of yearRanges) {
      for (let month = 1; month <= lastMonth; month++) {
        const planned = planDemoReport({
          serviceName: service.name,
          serviceIndex,
          serviceKind: service.kind,
          regionName: service.division.region.name,
          year,
          month,
          currentYear,
          currentMonth,
          permittedRubrics,
        });
        if (!planned) {
          skipped++;
          continue;
        }

        const existing = await db.report.findUnique({
          where: {
            serviceId_year_month: { serviceId: service.id, year, month },
          },
          select: { id: true, status: true, data: true },
        });
        const isDemo =
          existing?.data &&
          typeof existing.data === 'object' &&
          !Array.isArray(existing.data) &&
          (existing.data as Record<string, unknown>).__demo === true;
        const fixNonCompliantDcsp =
          dcsp && existing ? needsDcspDemoNormalization(existing.data) : false;
        const completeAugustOrOctober =
          existing &&
          isDemo &&
          isFullReportingMonth(month) &&
          existing.status !== 'VALIDE';

        if (
          existing &&
          !fixNonCompliantDcsp &&
          !completeAugustOrOctober &&
          (!overwrite || !isDemo)
        ) {
          skipped++;
          continue;
        }

        const payload = planned.data as Prisma.InputJsonValue;
        if (existing) {
          await db.report.update({
            where: { id: existing.id },
            data: fixNonCompliantDcsp
              ? { data: payload }
              : {
                  status: planned.status,
                  data: payload,
                  reason: planned.reason,
                },
          });
          updated++;
        } else {
          await db.report.create({
            data: {
              serviceId: service.id,
              year,
              month,
              status: planned.status,
              data: payload,
              reason: planned.reason,
            },
          });
          created++;
        }
      }
    }
  }

  console.log(
    `Présentation DG initialisée : ${servicesCreated} service(s) ajouté(s), ` +
      `${usersCreated} compte(s) Chef de service créé(s) (${usersSkipped} existant(s)), ` +
      `${created} rapport(s) créé(s), ${updated} mis à jour, ${skipped} conservé(s)/absent(s). ` +
      `Couverture : ${allServices.length} services sur ${regionCount}/12 régions — Août et Octobre complétés à 100 % (VALIDE).`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
