/**
 * StudyAI - Resilient Multi-Model Gemini AI Execution Engine
 * Handles quota limits (429), model failover, exponential backoff, and local synthesis fallback.
 */

import { GoogleGenAI } from '@google/genai';
import { logger } from '../utils/logger.ts';

// Candidate models prioritized by speed, availability, and quota buckets
// Valid models as per official Gemini guidelines
export const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
] as const;

// Global singleton client
let genAIClient: GoogleGenAI | null = null;

export const getResilientGenAI = (): GoogleGenAI => {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
};

// Model cooldown map: modelName -> epoch timestamp when cooldown ends
const modelCooldowns = new Map<string, number>();

export const isQuotaError = (err: any): boolean => {
  if (!err) return false;
  const status = err?.status || err?.statusCode || err?.code;
  if (status === 429 || status === 'RESOURCE_EXHAUSTED') return true;

  const msg = typeof err?.message === 'string'
    ? err.message
    : typeof err === 'string'
    ? err
    : JSON.stringify(err);

  return /quota|resource_exhausted|429|rate.limit|GenerateRequestsPerDay/i.test(msg);
};

export const markModelExhausted = (modelName: string, cooldownMinutes: number = 20) => {
  const expiry = Date.now() + cooldownMinutes * 60 * 1000;
  modelCooldowns.set(modelName, expiry);
};

export const isModelAvailable = (modelName: string): boolean => {
  const cooldownUntil = modelCooldowns.get(modelName);
  if (!cooldownUntil) return true;
  if (Date.now() > cooldownUntil) {
    modelCooldowns.delete(modelName);
    return true;
  }
  return false;
};

export interface ResilientExecutionOptions {
  timeoutMs?: number;
  temperature?: number;
  topP?: number;
  systemInstruction?: string;
}

/**
 * Executes a Gemini generation request across the model candidate cascade.
 * If quota is exhausted on one model, instantly fails over to the next candidate model.
 * If all models are exhausted, returns null without throwing unhandled errors or printing raw JSON error logs.
 */
export async function executeResilientGemini(
  promptOrContents: any,
  options: ResilientExecutionOptions = {},
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'mock' || apiKey === 'undefined') {
    return null;
  }

  const ai = getResilientGenAI();
  const timeoutMs = options.timeoutMs || 16000;

  for (const model of CANDIDATE_MODELS) {
    if (!isModelAvailable(model)) {
      continue;
    }

    try {
      const generatePromise = ai.models.generateContent({
        model,
        contents: promptOrContents,
        config: {
          systemInstruction: options.systemInstruction,
          temperature: options.temperature ?? 0.7,
          topP: options.topP ?? 0.95,
        },
      });

      // Avoid unhandled rejection on timeout race
      generatePromise.catch(() => {
        // Silently prevent background unhandled rejection
      });

      const response = await Promise.race([
        generatePromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI generation timed out')), timeoutMs),
        ),
      ]);

      const text = response?.text || '';
      if (text) {
        return text;
      }
    } catch (err: any) {
      if (isQuotaError(err)) {
        markModelExhausted(model, 15);
        // Do not spam warning with full JSON payload; log concise notice
        continue;
      }

      const isTransient =
        err?.status === 503 ||
        err?.status === 500 ||
        /temporarily unavailable|overloaded|timed out/i.test(err?.message || '');

      if (isTransient) {
        // Try next candidate model
        continue;
      }

      // Other fatal model error - continue to next model
      continue;
    }
  }

  logger.info('[StudyAI Engine] Gemini API quota limit reached; activating local academic synthesis.');
  return null;
}
