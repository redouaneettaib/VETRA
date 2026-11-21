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

let cachedClient: GoogleGenAI | null = null;
let cachedKey = '';

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || '';
  if (!apiKey) {
    throw new AiServiceError(
      'Le service d’analyse IA n’est pas encore activé sur ce serveur (variable GEMINI_API_KEY non renseignée).',
      503,
    );
  }
  if (!cachedClient || cachedKey !== apiKey) {
    const isVertexExpressKey = apiKey.startsWith('AQ.');
    cachedClient = new GoogleGenAI({
      apiKey,
      ...(isVertexExpressKey ? { vertexai: true } : {}),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedKey = apiKey;
  }
  return cachedClient;
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

function classifyError(error: unknown): AiServiceError {
  if (error instanceof AiServiceError) return error;
  const { httpStatus, code, message } = extractErrorDetails(error);
  console.error('VETRA Gemini API error:', {
    httpStatus,
    code,
    message: message.slice(0, 300),
  });
  const upper = `${code} ${message}`.toUpperCase();
  const detail = [httpStatus ? `HTTP ${httpStatus}` : '', code]
    .filter(Boolean)
    .join(' · ');

  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    upper.includes('API_KEY_INVALID') ||
    upper.includes('API KEY NOT VALID') ||
    upper.includes('API KEY EXPIRED') ||
    upper.includes('PERMISSION_DENIED') ||
    upper.includes('UNAUTHENTICATED')
  ) {
    return new AiServiceError(
      `Clé GEMINI_API_KEY refusée par Google${detail ? ` (${detail})` : ''}. Créez une clé API Gemini sur aistudio.google.com/apikey (commençant par AIza...) et enregistrez-la dans Railway → Variables.`,
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
      `Le modèle IA configuré n’est pas accessible avec cette clé API${detail ? ` (${detail})` : ''}. Vérifiez les permissions du projet Google AI Studio.`,
      502,
    );
  }
  return new AiServiceError(
    detail
      ? `Le service d’analyse IA a renvoyé une erreur (${detail}). Vérifiez la variable GEMINI_API_KEY sur Railway.`
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
  const ai = getClient();
  const isVertexExpressKey = (process.env.GEMINI_API_KEY?.trim() || '').startsWith('AQ.');
  const primaryModel = isVertexExpressKey && !process.env.GEMINI_MODEL
    ? 'gemini-2.5-flash'
    : VETRA_AI_MODEL;
  const candidates = [
    primaryModel,
    ...FALLBACK_MODELS.filter((m) => m !== primaryModel),
  ];

  let lastError: unknown;
  for (let mIdx = 0; mIdx < candidates.length; mIdx++) {
    const model = candidates[mIdx];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await runner(ai, model);
      } catch (error) {
        lastError = error;
        if (isModelUnavailable(error) && mIdx < candidates.length - 1) {
          console.warn(
            `VETRA Gemini model "${model}" indisponible, bascule vers "${candidates[mIdx + 1]}".`,
          );
          break;
        }
        if (attempt < 2 && isRetryable(error)) {
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
