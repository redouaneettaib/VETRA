import { GoogleGenAI, ThinkingLevel, type Schema } from '@google/genai';

export const VETRA_AI_MODEL = 'gemini-4-hydrogen';

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
    cachedClient = new GoogleGenAI({
      apiKey,
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

function classifyError(error: unknown): AiServiceError {
  if (error instanceof AiServiceError) return error;
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const upper = raw.toUpperCase();
  if (upper.includes('API_KEY_INVALID') || upper.includes('PERMISSION_DENIED') || upper.includes('403')) {
    return new AiServiceError(
      'La clé d’accès au service IA est invalide ou refusée. Vérifiez la variable GEMINI_API_KEY sur le serveur.',
      403,
    );
  }
  if (upper.includes('RESOURCE_EXHAUSTED') || upper.includes('429')) {
    return new AiServiceError(
      'Le quota du service d’analyse IA est momentanément atteint. Réessayez dans quelques instants.',
      429,
    );
  }
  if (upper.includes('NOT_FOUND') || upper.includes('404')) {
    return new AiServiceError(
      'Le modèle d’analyse configuré n’est pas disponible sur ce compte.',
      502,
    );
  }
  return new AiServiceError(
    'Le service d’analyse IA est temporairement indisponible. Réessayez dans un instant.',
    502,
  );
}

function isRetryable(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const upper = raw.toUpperCase();
  return (
    upper.includes('429') ||
    upper.includes('503') ||
    upper.includes('UNAVAILABLE') ||
    upper.includes('ECONNRESET') ||
    upper.includes('ETIMEDOUT') ||
    upper.includes('FETCH FAILED')
  );
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !isRetryable(error)) {
        throw classifyError(error);
      }
      await new Promise((resolve) =>
        setTimeout(resolve, 400 * Math.pow(2, attempt - 1)),
      );
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
  const ai = getClient();
  const response = await withRetry(() =>
    ai.models.generateContent({
      model: VETRA_AI_MODEL,
      contents: options.prompt,
      config: {
        systemInstruction: options.systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: options.schema,
        thinkingConfig: {
          thinkingLevel: options.thinkingLevel ?? ThinkingLevel.LOW,
        },
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
  const ai = getClient();
  const response = await withRetry(() =>
    ai.models.generateContent({
      model: VETRA_AI_MODEL,
      contents: options.prompt,
      config: {
        systemInstruction: options.systemInstruction,
        thinkingConfig: {
          thinkingLevel: options.thinkingLevel ?? ThinkingLevel.LOW,
        },
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
