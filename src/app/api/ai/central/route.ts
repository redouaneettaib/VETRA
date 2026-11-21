import { NextRequest } from 'next/server';
import { ThinkingLevel, Type } from '@google/genai';
import { z } from 'zod';
import { currentUser, fail } from '@/lib/auth';
import { db } from '@/lib/prisma';
import { months, rubricLabels } from '@/lib/analytics';
import {
  buildExecutiveContext,
  buildQaContext,
  detectStatisticalAnomalies,
  detectWeakSignals,
  type ScopedReport,
  type ScopedService,
} from '@/lib/ai-context';
import {
  AiServiceError,
  generateGroundedText,
  generateStructuredJson,
} from '@/lib/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const summarySchema = z.object({
  action: z.literal('summary'),
  year: z.number().int().min(1900).max(9999),
  month: z.number().int().min(1).max(12),
  mode: z.enum(['month', 'year']).default('month'),
  group: z.enum(['all', 'region', 'service']).default('all'),
  ids: z.array(z.string().max(64)).max(50).default([]),
  rubrics: z.array(z.string().max(16)).max(30).default([]),
});

const anomaliesSchema = z.object({
  action: z.literal('anomalies'),
  year: z.number().int().min(1900).max(9999),
  month: z.number().int().min(1).max(12),
});

const signalsSchema = z.object({
  action: z.literal('signals'),
  year: z.number().int().min(1900).max(9999),
  month: z.number().int().min(1).max(12),
});

const qaSchema = z.object({
  action: z.literal('qa'),
  year: z.number().int().min(1900).max(9999),
  month: z.number().int().min(1).max(12),
  question: z.string().trim().min(3).max(800),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().trim().min(1).max(2000),
      }),
    )
    .max(8)
    .default([]),
});

const requestSchema = z.discriminatedUnion('action', [
  summarySchema,
  anomaliesSchema,
  signalsSchema,
  qaSchema,
]);

async function loadNationalData(minYear: number, maxYear: number) {
  const [rawServices, rawReports] = await Promise.all([
    db.service.findMany({
      select: {
        id: true,
        name: true,
        kind: true,
        division: {
          select: {
            region: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    db.report.findMany({
      where: { year: { gte: minYear, lte: maxYear } },
      select: {
        id: true,
        serviceId: true,
        year: true,
        month: true,
        status: true,
        reason: true,
        data: true,
      },
    }),
  ]);

  const services: ScopedService[] = rawServices.map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind,
    region: s.division.region,
  }));

  const reports: ScopedReport[] = rawReports.map((r) => ({
    id: r.id,
    serviceId: r.serviceId,
    year: r.year,
    month: r.month,
    status: r.status,
    reason: r.reason,
    data: r.data,
  }));

  return { services, reports };
}

const NO_CACHE = { 'Cache-Control': 'private, no-store' };

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || !user.active) return fail('Connexion requise', 401);
  if (user.role !== 'DIRECTION_CENTRALE') {
    return fail('Accès réservé au profil Direction centrale.', 403);
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return fail('Paramètres de requête invalides.', 400);
  }

  const payload = parsed.data;

  try {
    if (payload.action === 'summary') {
      const validRubrics = payload.rubrics.filter((id) =>
        Object.hasOwn(rubricLabels, id),
      );
      const { services, reports } = await loadNationalData(
        Math.max(1900, payload.year - 1),
        payload.year,
      );
      const eligible =
        payload.group === 'all' || !payload.ids.length
          ? services
          : services.filter((s) =>
              payload.ids.includes(
                payload.group === 'region' ? s.region.id : s.id,
              ),
            );
      const snapshot = buildExecutiveContext(eligible, reports, {
        year: payload.year,
        month: payload.month,
        mode: payload.mode,
        trend: 'months',
        span: 5,
        group: payload.ids.length ? payload.group : 'all',
        ids: payload.ids,
        rubrics: validRubrics,
        metric: '',
      });

      const result = await generateStructuredJson<{
        titre: string;
        synthese: string;
        faitsMarquants: string[];
        pointsVigilance: string[];
        recommandations: string[];
      }>({
        systemInstruction:
          'Tu es analyste vétérinaire senior à la Direction Centrale de l’ONSSA – DPA (Maroc). ' +
          'Rédige une note de synthèse institutionnelle en français administratif précis, clair et concis, ' +
          'strictement fondée sur les chiffres JSON fournis. Ne jamais inventer de chiffre, de région ou de pourcentage. ' +
          'Si peu ou pas de rapports sont validés pour la période, indique-le clairement comme point de vigilance prioritaire.',
        prompt:
          `Produis la synthèse exécutive pour la Direction centrale à partir de ces données consolidées VETRA :\n` +
          JSON.stringify(snapshot),
        schema: {
          type: Type.OBJECT,
          properties: {
            titre: {
              type: Type.STRING,
              description: 'Titre officiel court de la note de synthèse.',
            },
            synthese: {
              type: Type.STRING,
              description:
                'Paragraphe de synthèse générale (3 à 5 phrases) sur la couverture de reporting et l’activité globale.',
            },
            faitsMarquants: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 à 6 faits marquants chiffrés issus des données.',
            },
            pointsVigilance: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2 à 5 points de vigilance (retards de validation, écarts notables).',
            },
            recommandations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2 à 4 recommandations opérationnelles pour la Direction centrale.',
            },
          },
          required: [
            'titre',
            'synthese',
            'faitsMarquants',
            'pointsVigilance',
            'recommandations',
          ],
        },
        thinkingLevel: ThinkingLevel.LOW,
      });

      return Response.json(
        {
          ...result,
          periodLabel: snapshot.periodLabel,
          coverage: snapshot.statusCounts,
          totalServices: snapshot.totalServices,
        },
        { headers: NO_CACHE },
      );
    }

    if (payload.action === 'anomalies') {
      const { services, reports } = await loadNationalData(
        Math.max(1900, payload.year - 1),
        payload.year,
      );
      const candidates = detectStatisticalAnomalies(
        services,
        reports,
        payload.year,
        payload.month,
      );

      if (!candidates.length) {
        return Response.json(
          {
            periodLabel: `${months[payload.month - 1]} ${payload.year}`,
            resume:
              'Aucune anomalie statistique majeure (pic inhabituel, chute brutale à zéro, taux hors bornes ou défaut de transmission d’un service actif) n’a été détectée pour cette période.',
            anomalies: [],
            scannedServices: services.length,
          },
          { headers: NO_CACHE },
        );
      }

      const aiAudit = await generateStructuredJson<{
        resume: string;
        items: Array<{
          id: string;
          priorite: 'HAUTE' | 'MOYENNE' | 'INFO';
          diagnostic: string;
          motifSuggestion: string;
        }>;
      }>({
        systemInstruction:
          'Tu es auditeur qualité des données vétérinaires à la Direction Centrale de l’ONSSA – DPA (Maroc). ' +
          'On te fournit des anomalies statistiques pré-détectées sur des rapports mensuels VETRA. ' +
          'Pour chaque anomalie (en conservant exactement son `id`), précise sa priorité (HAUTE, MOYENNE ou INFO), ' +
          'un diagnostic métier concis (erreur de saisie probable vs événement sanitaire/activité terrain), ' +
          'et un court motif administratif prêt à être utilisé en cas de demande de vérification ou de révocation. ' +
          'Ne jamais inventer d’identifiant ou de chiffre absent des données.',
        prompt:
          `Période auditée : ${months[payload.month - 1]} ${payload.year}.\n` +
          `Anomalies détectées :\n` +
          JSON.stringify(candidates),
        schema: {
          type: Type.OBJECT,
          properties: {
            resume: {
              type: Type.STRING,
              description: 'Synthèse de 2 à 3 phrases sur la qualité des données de la période.',
            },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  priorite: {
                    type: Type.STRING,
                    enum: ['HAUTE', 'MOYENNE', 'INFO'],
                  },
                  diagnostic: { type: Type.STRING },
                  motifSuggestion: { type: Type.STRING },
                },
                required: ['id', 'priorite', 'diagnostic', 'motifSuggestion'],
              },
            },
          },
          required: ['resume', 'items'],
        },
        thinkingLevel: ThinkingLevel.LOW,
      });

      const byId = new Map(aiAudit.items.map((item) => [item.id, item]));
      const merged = candidates.map((c) => {
        const enriched = byId.get(c.id);
        return {
          ...c,
          priorite: enriched?.priorite ?? c.severityHint,
          diagnostic: enriched?.diagnostic ?? c.note,
          motifSuggestion:
            enriched?.motifSuggestion ??
            `Vérification demandée sur ${c.rubric} (${c.metricLabel}) : ${c.note}`,
        };
      });

      return Response.json(
        {
          periodLabel: `${months[payload.month - 1]} ${payload.year}`,
          resume: aiAudit.resume,
          anomalies: merged,
          scannedServices: services.length,
        },
        { headers: NO_CACHE },
      );
    }

    if (payload.action === 'signals') {
      const { services, reports } = await loadNationalData(
        Math.max(1900, payload.year - 1),
        payload.year,
      );
      const candidates = detectWeakSignals(
        services,
        reports,
        payload.year,
        payload.month,
      );

      if (!candidates.length) {
        return Response.json(
          {
            periodLabel: `${months[payload.month - 1]} ${payload.year}`,
            syntheseVeille:
              'Aucun signal faible significatif (hausse continue sur 3 mois, progression simultanée multi-régionale ou décrochage de couverture) n’a été relevé sur la fenêtre glissante de 6 mois.',
            signaux: [],
          },
          { headers: NO_CACHE },
        );
      }

      const aiSignals = await generateStructuredJson<{
        syntheseVeille: string;
        signaux: Array<{
          id: string;
          niveau: 'ALERTE' | 'VIGILANCE' | 'SUIVI';
          titre: string;
          interpretation: string;
          actionRecommandee: string;
        }>;
      }>({
        systemInstruction:
          'Tu es spécialiste en veille sanitaire vétérinaire à la Direction Centrale de l’ONSSA – DPA (Maroc). ' +
          'À partir des signaux faibles pré-calculés sur 6 mois glissants (hausses continues multi-mois, flambées simultanées dans plusieurs régions, baisses de couverture), ' +
          'synthétise une analyse de veille sanitaire structurée en français institutionnel. ' +
          'Conserve exactement les `id` fournis, classe chaque signal en ALERTE, VIGILANCE ou SUIVI, ' +
          'explique son enjeu sanitaire ou opérationnel et propose une action concrète pour la Direction centrale.',
        prompt:
          `Fenêtre de veille se terminant en ${months[payload.month - 1]} ${payload.year}.\n` +
          `Signaux pré-détectés :\n` +
          JSON.stringify(candidates),
        schema: {
          type: Type.OBJECT,
          properties: {
            syntheseVeille: {
              type: Type.STRING,
              description: 'Résumé global de la situation de veille sur 6 mois (2 à 4 phrases).',
            },
            signaux: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  niveau: {
                    type: Type.STRING,
                    enum: ['ALERTE', 'VIGILANCE', 'SUIVI'],
                  },
                  titre: { type: Type.STRING },
                  interpretation: { type: Type.STRING },
                  actionRecommandee: { type: Type.STRING },
                },
                required: [
                  'id',
                  'niveau',
                  'titre',
                  'interpretation',
                  'actionRecommandee',
                ],
              },
            },
          },
          required: ['syntheseVeille', 'signaux'],
        },
        thinkingLevel: ThinkingLevel.LOW,
      });

      const byId = new Map(aiSignals.signaux.map((s) => [s.id, s]));
      const merged = candidates.map((c) => {
        const enriched = byId.get(c.id);
        return {
          ...c,
          niveau:
            enriched?.niveau ??
            (c.pattern === 'MULTI_REGION_SURGE' ? 'ALERTE' : 'VIGILANCE'),
          titre: enriched?.titre ?? `${c.rubric} · ${c.metricLabel}`,
          interpretation: enriched?.interpretation ?? c.summary,
          actionRecommandee:
            enriched?.actionRecommandee ??
            'Demander un point de situation aux directions régionales concernées.',
        };
      });

      return Response.json(
        {
          periodLabel: `${months[payload.month - 1]} ${payload.year}`,
          syntheseVeille: aiSignals.syntheseVeille,
          signaux: merged,
        },
        { headers: NO_CACHE },
      );
    }

    // payload.action === 'qa'
    const { services, reports } = await loadNationalData(
      Math.max(1900, payload.year - 1),
      payload.year,
    );
    const context = buildQaContext(services, reports, payload.year, payload.month);
    const historyBlock = payload.history.length
      ? `\nHistorique récent de la conversation :\n${payload.history
          .map((turn) => `${turn.role === 'user' ? 'Direction centrale' : 'Assistant VETRA'} : ${turn.text}`)
          .join('\n')}\n`
      : '';

    const answer = await generateGroundedText({
      systemInstruction:
        'Tu es l’assistant analytique officiel de la Direction Centrale de l’ONSSA – DPA sur la plateforme VETRA. ' +
        'Réponds dans la langue de la question (français ou arabe) de façon claire, structurée en Markdown (listes à puces, chiffres mis en valeur) et concise. ' +
        'RÈGLE ABSOLUE : n’utilise STRICTEMENT que les chiffres présents dans le jeu de données JSON fourni. ' +
        'N’invente jamais un chiffre, une région ou un indicateur. Si une donnée demandée n’est pas disponible ou pas encore validée dans le périmètre chargé, dis-le explicitement.',
      prompt:
        `Données nationales VETRA consolidées (période de référence : ${context.referencePeriod}) :\n` +
        JSON.stringify(context) +
        historyBlock +
        `\nQuestion de la Direction centrale : ${payload.question}`,
      thinkingLevel: ThinkingLevel.LOW,
    });

    return Response.json(
      {
        answer,
        periodLabel: context.referencePeriod,
      },
      { headers: NO_CACHE },
    );
  } catch (error) {
    if (error instanceof AiServiceError) {
      return fail(error.message, error.status);
    }
    return fail(
      'Impossible de terminer l’analyse IA pour le moment.',
      502,
    );
  }
}
