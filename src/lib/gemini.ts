import { GoogleGenAI, ThinkingLevel, type Schema } from '@google/genai';

export const VETRA_AI_MODEL =
  process.env.GEMINI_MODEL?.trim() || 'gemini-4-hydrogen';

const FALLBACK_MODELS = ['gemini-2.5-flash'];

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
  const upper = `${code} ${message}`.toUpperCase();
  const detail = [httpStatus ? `HTTP ${httpStatus}` : '', code]
    .filter(Boolean)
    .join(' · ');

  if (isAuthError(error)) {
    return new AiServiceError(
      `Clé GEMINI_API_KEY refusée par Google${detail ? ` (${detail})` : ''}. Vérifiez la clé enregistrée dans Railway → Variables (sans espace autour) ou générez-en une nouvelle sur aistudio.google.com/apikey.`,
      403,
    );
  }
  if (
    httpStatus === 429 ||
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('QUOTA')
  ) {
    return new AiServiceError(
      'Le quota de votre clé GEMINI_API_KEY est atteint ou la facturation n’est pas activée pour ce volume. Réessayez dans un instant ou vérifiez votre quota Google AI Studio.',
      429,
    );
  }
  if (isModelUnavailable(error)) {
    return new AiServiceError(
      `Le modèle IA configuré n’est pas accessible avec cette clé API${detail ? ` (${detail})` : ''}.`,
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

function isRetryable(error: unknown): boolean {
  const { httpStatus, code, message } = extractErrorDetails(error);
  const upper = `${code} ${message}`.toUpperCase();
  return (
    httpStatus === 429 ||
    httpStatus === 503 ||
    upper.includes('UNAVAILABLE') ||
    upper.includes('ECONNRESET') ||
    upper.includes('ETIMEDOUT') ||
    upper.includes('FETCH FAILED')
  );
}

function supportsThinkingLevel(model: string): boolean {
  return model.startsWith('gemini-3') || model.startsWith('gemini-4');
}

async function runWithModelFallback<T>(
  runner: (ai: GoogleGenAI, model: string) => Promise<T>,
): Promise<T> {
  const { apiKey, devClient, vertexClient } = getClients();
  const devModels = [
    VETRA_AI_MODEL,
    ...FALLBACK_MODELS.filter((m) => m !== VETRA_AI_MODEL),
  ];

  // Build ordered endpoint + model attempts:
  // 1) Standard Gemini Developer API (works for both AIza... and newer AI Studio AQ. keys)
  // 2) Vertex AI Express fallback (for Google Cloud Vertex AI Express AQ. keys if Developer API rejects auth)
  const attempts: Array<{ client: GoogleGenAI; model: string; mode: 'dev' | 'vertex' }> =
    devModels.map((model) => ({ client: devClient, model, mode: 'dev' }));

  if (apiKey.startsWith('AQ.')) {
    attempts.push({
      client: vertexClient,
      model: 'gemini-2.5-flash',
      mode: 'vertex',
    });
  }

  let lastError: unknown;
  for (let idx = 0; idx < attempts.length; idx++) {
    const { client, model, mode } = attempts[idx];
    for (let retry = 1; retry <= 2; retry++) {
      try {
        return await runner(client, model);
      } catch (error) {
        lastError = error;
        const hasMore = idx < attempts.length - 1;
        const nextIsVertex = hasMore && attempts[idx + 1].mode === 'vertex';

        // On model 404/unavailable, try next model in list
        if (isModelUnavailable(error) && hasMore) {
          console.warn(
            `VETRA Gemini (${mode}/${model}) indisponible, essai suivant.`,
          );
          break;
        }
        // If standard Developer API rejects an AQ. key auth, jump directly to Vertex AI Express attempt
        if (mode === 'dev' && isAuthError(error) && apiKey.startsWith('AQ.')) {
          const vertexIdx = attempts.findIndex((a) => a.mode === 'vertex');
          if (vertexIdx > idx) {
            console.warn(
              'VETRA Gemini Developer API auth refusée pour clé AQ., essai en mode Vertex AI Express.',
            );
            idx = vertexIdx - 1;
            break;
          }
        }
        if (retry < 2 && isRetryable(error) && !nextIsVertex) {
          await new Promise((resolve) => setTimeout(resolve, 450));
          continue;
        }
        throw classifyError(error);
      }
    }
  }
  throw classifyError(lastError);
}

export async function generateStructuredJson<T>(options: {
  systemInstruction: string;
  prompt: string;
  schema: Schema;
  thinkingLevel?: ThinkingLevel;
}): Promise<T> {
  const response = await runWithModelFallback((ai, model) =>
    ai.models.generateContent({
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
    }),
  );
  const raw = (response.text ?? '').trim();
  if (!raw) {
    throw new AiServiceError(
      'Réponse vide reçue du moteur d’analyse. Veuillez relancer l’analyse.',
      502,
    );
  }
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
  const response = await runWithModelFallback((ai, model) =>
    ai.models.generateContent({
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
    }),
  );
  const text = (response.text ?? '').trim();
  if (!text) {
    throw new AiServiceError(
      'Réponse vide reçue du moteur d’analyse. Veuillez reformuler votre question.',
      502,
    );
  }
  return text;
}
