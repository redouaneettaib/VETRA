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

// Remember working / 404 targets per API key so we never waste latency or quota on unavailable models
let preferredTargetKey = '';
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

function isModelUnavailable(error: unknown): boolean {
  const { httpStatus, code, message } = extractErrorDetails(error);
  const upper = `${code} ${message}`.toUpperCase();
  return (
    httpStatus === 404 ||
    upper.includes('NOT_FOUND') ||
    upper.includes('IS NOT FOUND') ||
    upper.includes('NOT SUPPORTED FOR GENERATECONTENT') ||
    (httpStatus === 403 &&
      (upper.includes('MODEL') || upper.includes('PUBLISHER')))
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

function classifyError(error: unknown): AiServiceError {
  if (error instanceof AiServiceError) return error;
  const { httpStatus, code, message } = extractErrorDetails(error);
  const safeMsg = message
    .replace(/(?:AIza|AQ\.)[A-Za-z0-9._-]+/g, '[REDACTED]')
    .slice(0, 180);
  console.error('VETRA Gemini API error:', {
    httpStatus,
    code,
    message: safeMsg,
  });
  const detail = [httpStatus ? `HTTP ${httpStatus}` : '', code]
    .filter(Boolean)
    .join(' · ');

  if (isQuotaError(error)) {
    return new AiServiceError(
      'Limite de requêtes temporaire atteinte sur votre clé Google AI Studio (plan gratuit). Patientez environ 30 à 60 secondes puis réessayez, ou activez la facturation sur votre projet Google AI Studio.',
      429,
    );
  }
  if (isOverloaded(error)) {
    return new AiServiceError(
      'Les serveurs Google Gemini connaissent un pic de charge temporaire (HTTP 503). Réessayez dans quelques secondes.',
      503,
    );
  }
  if (isAuthError(error)) {
    return new AiServiceError(
      `Clé GEMINI_API_KEY refusée par Google${detail ? ` (${detail})` : ''}. Vérifiez la clé enregistrée dans Railway → Variables.`,
      403,
    );
  }
  if (isModelUnavailable(error)) {
    return new AiServiceError(
      `Aucun modèle Gemini compatible n’est accessible avec cette clé API${detail ? ` (${detail})` : ''}.`,
      502,
    );
  }
  return new AiServiceError(
    detail
      ? `Le service d’analyse IA a renvoyé une erreur (${detail}${safeMsg ? ` : ${safeMsg}` : ''}).`
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

  let attempts: Attempt[] = orderedModels.map((model) => ({
    key: `dev:${model}`,
    client: devClient,
    model,
    mode: 'dev',
  }));

  if (apiKey.startsWith('AQ.')) {
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

  // Skip models previously confirmed 404 for this API key
  attempts = attempts.filter((a) => !unavailableTargets.has(a.key));

  // Try the last known working (mode, model) first to avoid repeated probes
  if (preferredTargetKey) {
    const prefIdx = attempts.findIndex((a) => a.key === preferredTargetKey);
    if (prefIdx > 0) {
      const [pref] = attempts.splice(prefIdx, 1);
      attempts.unshift(pref);
    }
  }

  let bestError: unknown = null;
  let lastError: unknown = null;

  for (let idx = 0; idx < attempts.length; idx++) {
    const attempt = attempts[idx];
    const maxTries = 2;
    for (let retry = 1; retry <= maxTries; retry++) {
      try {
        const result = await runner(attempt.client, attempt.model);
        preferredTargetKey = attempt.key;
        if (cacheKey) {
          if (responseCache.size > 40) responseCache.clear();
          responseCache.set(cacheKey, {
            expiresAt: Date.now() + 90_000,
            value: result,
          });
        }
        return result;
      } catch (error) {
        lastError = error;

        // Track more informative errors (429 / 503) over secondary 404s
        if (
          !bestError ||
          isQuotaError(error) ||
          (isOverloaded(error) && !isQuotaError(bestError))
        ) {
          bestError = error;
        }

        if (isModelUnavailable(error)) {
          unavailableTargets.add(attempt.key);
          console.warn(
            `VETRA Gemini (${attempt.key}) indisponible (404), mis en cache comme ignoré.`,
          );
          break;
        }

        // On auth rejection with AQ. key on dev endpoint, skip straight to vertex endpoints
        if (
          attempt.mode === 'dev' &&
          isAuthError(error) &&
          apiKey.startsWith('AQ.')
        ) {
          const vertexIdx = attempts.findIndex((a) => a.mode === 'vertex');
          if (vertexIdx > idx) {
            idx = vertexIdx - 1;
            break;
          }
        }

        // On 429 quota hit: do NOT retry the same model immediately; try next model with separate quota bucket
        if (isQuotaError(error)) {
          console.warn(
            `VETRA Gemini (${attempt.key}) quota atteint (429), essai du modèle suivant.`,
          );
          break;
        }

        // On 503 overload or transient network error: 1 short retry, then fail over to next model
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

        throw classifyError(error);
      }
    }
  }

  throw classifyError(bestError ?? lastError);
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
