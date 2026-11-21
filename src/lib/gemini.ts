import { GoogleGenAI, ThinkingLevel, type Schema } from '@google/genai';

export const VETRA_AI_MODEL =
  process.env.GEMINI_MODEL?.trim() || 'gemini-4-hydrogen';

const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

export class AiServiceError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'AiServiceError';
    this.status = status;
  }
}

let cachedDevClient: GoogleGenAI | null = null;
let cachedVertexClient: GoogleGenAI | null = null;
let cachedKey = '';

let preferredTargetKey = '';
let detectedMode: 'dev' | 'vertex' | null = null;
const unavailableTargets = new Set<string>();
const responseCache = new Map<string, { expiresAt: number; value: unknown }>();

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || '';
  if (!apiKey) {
    throw new AiServiceError(
      'Le service d’analyse IA n’est pas encore activé sur ce serveur (variable GEMINI_API_KEY non renseignée).',
      503,
    );
  }
  return apiKey;
}

function getClients(): {
  apiKey: string;
  devClient: GoogleGenAI;
  vertexClient: GoogleGenAI;
} {
  const apiKey = getApiKey();
  if (!cachedDevClient || !cachedVertexClient || cachedKey !== apiKey) {
    const httpOptions = {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    };
    cachedDevClient = new GoogleGenAI({ apiKey, httpOptions });
    cachedVertexClient = new GoogleGenAI({
      apiKey,
      vertexai: true,
      httpOptions,
    });
    cachedKey = apiKey;
    preferredTargetKey = '';
    detectedMode = null;
    unavailableTargets.clear();
  }
  return {
    apiKey,
    devClient: cachedDevClient,
    vertexClient: cachedVertexClient,
  };
}

function extractErrorDetails(error: unknown): {
  httpStatus: number | null;
  code: string;
  message: string;
} {
  const errObj =
    error && typeof error === 'object'
      ? (error as { status?: unknown; code?: unknown; message?: unknown })
      : null;
  let httpStatus =
    typeof errObj?.status === 'number'
      ? errObj.status
      : typeof errObj?.code === 'number'
        ? errObj.code
        : null;
  let rawMessage =
    error instanceof Error
      ? error.message
      : typeof errObj?.message === 'string'
        ? errObj.message
        : String(error ?? '');
  let code = '';

  const jsonStart = rawMessage.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(rawMessage.slice(jsonStart)) as {
        error?: { code?: number; status?: string; message?: string };
      };
      if (parsed?.error) {
        if (typeof parsed.error.code === 'number') httpStatus = parsed.error.code;
        if (typeof parsed.error.status === 'string') code = parsed.error.status;
        if (typeof parsed.error.message === 'string')
          rawMessage = parsed.error.message;
      }
    } catch {
      // keep rawMessage as-is
    }
  }

  return { httpStatus, code, message: rawMessage };
}

function sanitizeMessage(message: string): string {
  return message
    .replace(/(?:AIza|AQ\.)[A-Za-z0-9._-]+/g, '[CLÉ_MASQUÉE]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function isKeyDefinitivelyBlocked(error: unknown): boolean {
  const { code, message } = extractErrorDetails(error);
  const upper = `${code} ${message}`.toUpperCase();
  return (
    upper.includes('LEAKED') ||
    upper.includes('REVOKED') ||
    upper.includes('SUSPENDED') ||
    upper.includes('EXPIRED')
  );
}

function isModelUnavailable(error: unknown, model: string): boolean {
  if (isKeyDefinitivelyBlocked(error)) return false;
  const { httpStatus, code, message } = extractErrorDetails(error);
  const upper = `${code} ${message}`.toUpperCase();
  if (
    httpStatus === 404 ||
    upper.includes('NOT_FOUND') ||
    upper.includes('IS NOT FOUND') ||
    upper.includes('NOT SUPPORTED FOR GENERATECONTENT')
  ) {
    return true;
  }
  // A 403 on a non-GA/preview model (e.g. gemini-4-hydrogen) on an external key
  // should try standard GA models (gemini-2.5-flash) rather than failing auth immediately
  if (
    httpStatus === 403 &&
    model !== 'gemini-2.5-flash' &&
    model !== 'gemini-2.5-flash-lite'
  ) {
    return true;
  }
  return (
    httpStatus === 403 &&
    (upper.includes('MODEL') || upper.includes('PUBLISHER'))
  );
}

function isAuthError(error: unknown): boolean {
  const { httpStatus, code, message } = extractErrorDetails(error);
  const upper = `${code} ${message}`.toUpperCase();
  return (
    httpStatus === 401 ||
    httpStatus === 403 ||
    upper.includes('API_KEY_INVALID') ||
    upper.includes('API KEY NOT VALID') ||
    upper.includes('API KEY EXPIRED') ||
    upper.includes('PERMISSION_DENIED') ||
    upper.includes('UNAUTHENTICATED')
  );
}

function isQuotaError(error: unknown): boolean {
  const { httpStatus, code, message } = extractErrorDetails(error);
  const upper = `${code} ${message}`.toUpperCase();
  return (
    httpStatus === 429 ||
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('QUOTA')
  );
}

function isOverloaded(error: unknown): boolean {
  const { httpStatus, code, message } = extractErrorDetails(error);
  const upper = `${code} ${message}`.toUpperCase();
  return (
    httpStatus === 503 ||
    upper.includes('UNAVAILABLE') ||
    upper.includes('HIGH DEMAND') ||
    upper.includes('OVERLOADED')
  );
}

function isTransientNetwork(error: unknown): boolean {
  const { message } = extractErrorDetails(error);
  const upper = message.toUpperCase();
  return (
    upper.includes('ECONNRESET') ||
    upper.includes('ETIMEDOUT') ||
    upper.includes('FETCH FAILED')
  );
}

function classifyError(error: unknown, targetLabel = ''): AiServiceError {
  if (error instanceof AiServiceError) return error;
  const { httpStatus, code, message } = extractErrorDetails(error);
  const safeMsg = sanitizeMessage(message);
  console.error('VETRA Gemini API error:', {
    target: targetLabel,
    httpStatus,
    code,
    message: safeMsg,
  });
  const detail = [targetLabel, httpStatus ? `HTTP ${httpStatus}` : '', code]
    .filter(Boolean)
    .join(' · ');

  if (isQuotaError(error)) {
    return new AiServiceError(
      `Limite de quota atteinte sur Google (${detail}${safeMsg ? ` — ${safeMsg}` : ''}). Patientez 30 à 60 secondes puis réessayez.`,
      429,
    );
  }
  if (isOverloaded(error)) {
    return new AiServiceError(
      `Serveurs Google temporairement surchargés (${detail}). Réessayez dans quelques secondes.`,
      503,
    );
  }
  if (isAuthError(error)) {
    return new AiServiceError(
      `Accès refusé par Google (${detail}${safeMsg ? ` — ${safeMsg}` : ''}).`,
      403,
    );
  }
  return new AiServiceError(
    detail
      ? `Erreur du service IA (${detail}${safeMsg ? ` — ${safeMsg}` : ''}).`
      : 'Le service d’analyse IA est temporairement indisponible. Réessayez dans un instant.',
    502,
  );
}

function supportsThinkingLevel(model: string): boolean {
  return model.startsWith('gemini-3') || model.startsWith('gemini-4');
}

type Attempt = {
  key: string;
  client: GoogleGenAI;
  model: string;
  mode: 'dev' | 'vertex';
};

async function runWithModelFallback<T>(
  runner: (ai: GoogleGenAI, model: string) => Promise<T>,
  cacheKey?: string,
): Promise<T> {
  if (cacheKey) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }
  }

  const { apiKey, devClient, vertexClient } = getClients();
  const orderedModels = [
    VETRA_AI_MODEL,
    ...FALLBACK_MODELS.filter((m) => m !== VETRA_AI_MODEL),
  ];

  let attempts: Attempt[] = [];

  if (detectedMode !== 'vertex') {
    attempts.push(
      ...orderedModels.map((model) => ({
        key: `dev:${model}`,
        client: devClient,
        model,
        mode: 'dev' as const,
      })),
    );
  }

  if (apiKey.startsWith('AQ.') && detectedMode !== 'dev') {
    attempts.push(
      {
        key: 'vertex:gemini-2.5-flash',
        client: vertexClient,
        model: 'gemini-2.5-flash',
        mode: 'vertex',
      },
      {
        key: 'vertex:gemini-2.5-flash-lite',
        client: vertexClient,
        model: 'gemini-2.5-flash-lite',
        mode: 'vertex',
      },
    );
  }

  attempts = attempts.filter((a) => !unavailableTargets.has(a.key));

  if (preferredTargetKey) {
    const prefIdx = attempts.findIndex((a) => a.key === preferredTargetKey);
    if (prefIdx > 0) {
      const [pref] = attempts.splice(prefIdx, 1);
      attempts.unshift(pref);
    }
  }

  let bestFailure: { error: unknown; key: string } | null = null;
  let lastFailure: { error: unknown; key: string } | null = null;
  let authenticatedModeInRun: 'dev' | 'vertex' | null = detectedMode;

  for (let idx = 0; idx < attempts.length; idx++) {
    const attempt = attempts[idx];

    // Never cross over to the opposite endpoint once one endpoint has authenticated this key
    if (authenticatedModeInRun && attempt.mode !== authenticatedModeInRun) {
      continue;
    }

    const maxTries = 2;
    for (let retry = 1; retry <= maxTries; retry++) {
      try {
        const result = await runner(attempt.client, attempt.model);
        preferredTargetKey = attempt.key;
        detectedMode = attempt.mode;
        if (cacheKey) {
          if (responseCache.size > 40) responseCache.clear();
          responseCache.set(cacheKey, {
            expiresAt: Date.now() + 90_000,
            value: result,
          });
        }
        return result;
      } catch (error) {
        lastFailure = { error, key: attempt.key };

        // 0. Definitively blocked key (leaked / revoked / expired) -> stop immediately with exact Google reason
        if (isKeyDefinitivelyBlocked(error)) {
          throw classifyError(error, attempt.key);
        }

        // 1. Model unavailable (404, or 403 on non-GA model like gemini-4-hydrogen) -> skip to next model in same mode
        if (isModelUnavailable(error, attempt.model)) {
          unavailableTargets.add(attempt.key);
          console.warn(
            `VETRA Gemini (${attempt.key}) non disponible, essai du modèle suivant.`,
          );
          break;
        }

        // 2. If GA model on dev endpoint fails auth for an AQ. key -> switch cleanly to vertex endpoints
        if (
          attempt.mode === 'dev' &&
          !authenticatedModeInRun &&
          isAuthError(error) &&
          apiKey.startsWith('AQ.')
        ) {
          const vertexIdx = attempts.findIndex((a) => a.mode === 'vertex');
          if (vertexIdx > idx) {
            bestFailure = { error, key: attempt.key };
            idx = vertexIdx - 1;
            break;
          }
        }

        // Quota (429) or Overload (503) proves this endpoint authenticated the key
        if (isQuotaError(error) || isOverloaded(error)) {
          authenticatedModeInRun = attempt.mode;
          detectedMode = attempt.mode;
        }

        // Track meaningful failures (quota / overload take priority over secondary auth errors)
        if (
          !bestFailure ||
          isQuotaError(error) ||
          (isOverloaded(error) && !isQuotaError(bestFailure.error))
        ) {
          bestFailure = { error, key: attempt.key };
        }

        // 3. Quota hit (429) -> try next model in same endpoint with separate quota bucket
        if (isQuotaError(error)) {
          console.warn(
            `VETRA Gemini (${attempt.key}) quota atteint (429), essai du modèle suivant.`,
          );
          break;
        }

        // 4. Overload (503) or transient network -> 1 short retry, then next model
        if (isOverloaded(error) || isTransientNetwork(error)) {
          if (retry < maxTries) {
            await new Promise((resolve) => setTimeout(resolve, 650));
            continue;
          }
          console.warn(
            `VETRA Gemini (${attempt.key}) surchargé (503), essai du modèle suivant.`,
          );
          break;
        }

        // Preserve earlier quota/overload error if a later attempt failed differently
        const chosen = bestFailure ?? lastFailure;
        throw classifyError(chosen?.error, chosen?.key ?? attempt.key);
      }
    }
  }

  const chosen = bestFailure ?? lastFailure;
  throw classifyError(chosen?.error, chosen?.key ?? '');
}

export async function generateStructuredJson<T>(options: {
  systemInstruction: string;
  prompt: string;
  schema: Schema;
  thinkingLevel?: ThinkingLevel;
  cacheKey?: string;
}): Promise<T> {
  const raw = await runWithModelFallback(async (ai, model) => {
    const response = await ai.models.generateContent({
      model,
      contents: options.prompt,
      config: {
        systemInstruction: options.systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: options.schema,
        ...(supportsThinkingLevel(model)
          ? {
              thinkingConfig: {
                thinkingLevel: options.thinkingLevel ?? ThinkingLevel.LOW,
              },
            }
          : {}),
      },
    });
    const text = (response.text ?? '').trim();
    if (!text) {
      throw new AiServiceError(
        'Réponse vide reçue du moteur d’analyse. Veuillez relancer l’analyse.',
        502,
      );
    }
    return text;
  }, options.cacheKey);

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new AiServiceError(
      'Le moteur d’analyse a renvoyé un format inattendu. Veuillez relancer l’analyse.',
      502,
    );
  }
}

export async function generateGroundedText(options: {
  systemInstruction: string;
  prompt: string;
  thinkingLevel?: ThinkingLevel;
}): Promise<string> {
  return runWithModelFallback(async (ai, model) => {
    const response = await ai.models.generateContent({
      model,
      contents: options.prompt,
      config: {
        systemInstruction: options.systemInstruction,
        ...(supportsThinkingLevel(model)
          ? {
              thinkingConfig: {
                thinkingLevel: options.thinkingLevel ?? ThinkingLevel.LOW,
              },
            }
          : {}),
      },
    });
    const text = (response.text ?? '').trim();
    if (!text) {
      throw new AiServiceError(
        'Réponse vide reçue du moteur d’analyse. Veuillez reformuler votre question.',
        502,
      );
    }
    return text;
  });
}
