/**
 * Jeu de données de présentation Direction Générale pour VETRA.
 *
 * - Initialise les 12 régions, 12 divisions et 43 services vétérinaires (3 à 4
 *   services par direction régionale) pour obtenir des pourcentages régionaux
 *   intermédiaires réalistes (25 %, 33 %, 50 %, 67 %, 75 %, 100 %) sur la carte
 *   du Maroc et dans le reporting officiel.
 * - Crée un compte fictif « Chef de service » pour un service vétérinaire de
 *   chacune des 12 régions (mot de passe lu depuis DEMO_USER_PASSWORD ou
 *   SEED_ADMIN_PASSWORD, jamais codé en dur).
 * - Complète à 100 % (VALIDE) tous les 12 mois de 2025 ainsi que les mois
 *   d'août et d'octobre de l'année en cours pour tous les services actifs.
 * - Génère des taux régionaux intermédiaires et variés sur les autres mois de
 *   l'année en cours.
 *
 * Sécurité : ne remplace et ne supprime jamais un rapport réel (non marqué __demo).
 */
import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  isDcspService,
  needsDcspDemoNormalization,
} from '../src/lib/demo-dcsp';
import {
  isFullReportingPeriod,
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

function isDemoRecord(data: unknown): boolean {
  return (
    Boolean(data) &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    (data as Record<string, unknown>).__demo === true
  );
}

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

  // 2. S'assurer que les 43 services vétérinaires (3 à 4 par région) existent
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

  // 4. Charger tous les services présents en base et regrouper par région
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
      .filter((report) => isDemoRecord(report.data))
      .map((report) => report.id);
    if (ids.length) await db.report.deleteMany({ where: { id: { in: ids } } });
    console.log(`${ids.length} ancienne(s) donnée(s) fictive(s) supprimée(s).`);
  }

  // Précharger tous les rapports existants sur 2025..currentYear en une seule requête
  const existingReports = await db.report.findMany({
    where: {
      serviceId: { in: allServices.map((s) => s.id) },
      year: { gte: currentYear - 1, lte: currentYear },
    },
    select: {
      id: true,
      serviceId: true,
      year: true,
      month: true,
      status: true,
      data: true,
    },
  });
  const existingMap = new Map(
    existingReports.map((r) => [`${r.serviceId}:${r.year}:${r.month}`, r]),
  );

  // Regrouper les services par région pour calculer l'index dans chaque région
  const servicesByRegion = new Map<string, typeof allServices>();
  for (const service of allServices) {
    const regionName = service.division.region.name;
    const list = servicesByRegion.get(regionName) ?? [];
    list.push(service);
    servicesByRegion.set(regionName, list);
  }

  const yearRanges: [number, number][] = [
    [currentYear - 1, 12],
    [currentYear, Math.max(currentMonth, 10)],
  ];

  const toCreate: Prisma.ReportCreateManyInput[] = [];
  const toUpdate: {
    id: string;
    data: Prisma.ReportUpdateInput;
  }[] = [];
  const toDeleteDemoIds: string[] = [];
  let skipped = 0;

  for (const [serviceIndex, service] of allServices.entries()) {
    const dcsp = isDcspService(service);
    const regionName = service.division.region.name;
    const regionList = servicesByRegion.get(regionName) ?? [service];
    const serviceIndexInRegion = regionList.findIndex(
      (s) => s.id === service.id,
    );
    const permittedRubrics = effectiveRubrics(service.rights, service.kind);

    for (const [year, lastMonth] of yearRanges) {
      for (let month = 1; month <= lastMonth; month++) {
        const key = `${service.id}:${year}:${month}`;
        const existing = existingMap.get(key);
        const isDemo = existing ? isDemoRecord(existing.data) : false;

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

        if (!planned) {
          // Si overwrite est actif et qu'un ancien rapport __demo existe sur un mois
          // désormais volontairement non introduit, on le retire (jamais un rapport réel).
          if (existing && isDemo && overwrite) {
            toDeleteDemoIds.push(existing.id);
          } else {
            skipped++;
          }
          continue;
        }

        const fixNonCompliantDcsp =
          dcsp && existing ? needsDcspDemoNormalization(existing.data) : false;
        const completeFullPeriod =
          existing &&
          isDemo &&
          isFullReportingPeriod(year, month, currentYear) &&
          existing.status !== 'VALIDE';

        if (
          existing &&
          !fixNonCompliantDcsp &&
          !completeFullPeriod &&
          (!overwrite || !isDemo)
        ) {
          skipped++;
          continue;
        }

        const payload = planned.data as Prisma.InputJsonValue;
        if (existing) {
          toUpdate.push({
            id: existing.id,
            data: fixNonCompliantDcsp
              ? { data: payload }
              : {
                  status: planned.status,
                  data: payload,
                  reason: planned.reason,
                },
          });
        } else {
          toCreate.push({
            serviceId: service.id,
            year,
            month,
            status: planned.status,
            data: payload,
            reason: planned.reason,
          });
        }
      }
    }
  }

  if (toDeleteDemoIds.length) {
    await db.report.deleteMany({ where: { id: { in: toDeleteDemoIds } } });
  }
  if (toCreate.length) {
    await db.report.createMany({ data: toCreate, skipDuplicates: true });
  }
  const chunkSize = 50;
  for (let i = 0; i < toUpdate.length; i += chunkSize) {
    const batch = toUpdate.slice(i, i + chunkSize);
    await db.$transaction(
      batch.map((item) =>
        db.report.update({ where: { id: item.id }, data: item.data }),
      ),
    );
  }

  console.log(
    `Présentation DG initialisée : ${servicesCreated} service(s) ajouté(s), ` +
      `${usersCreated} compte(s) Chef de service créé(s) (${usersSkipped} existant(s)), ` +
      `${toCreate.length} rapport(s) créé(s), ${toUpdate.length} mis à jour, ` +
      `${toDeleteDemoIds.length} ancien(s) démo retiré(s), ${skipped} conservé(s)/absent(s). ` +
      `Couverture : ${allServices.length} services sur ${regionCount}/12 régions — ` +
      `2025 complet à 100 % (12 mois), Août et Octobre ${currentYear} à 100 %, autres mois à taux régionaux intermédiaires.`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
