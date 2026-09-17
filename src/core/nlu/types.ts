import { z } from 'zod';
import type { ValidationResult } from '../../schemas/types.js';

export interface IntentDefinition {
  name: string;
  description: string;
  examples: string[];
  defaultConfidence: number;
}

export interface IntentResult {
  name: string;
  confidence: number;
  reasoning?: string;
}

export type EntityProvenance =
  | 'USER_EXPLICIT'
  | 'USER_CORRECTION'
  | 'ONTOLOGY_MATCH'
  | 'LLM_EXTRACTION'
  | 'SYSTEM_ESTIMATE'
  | 'UNKNOWN_ARTISAN_CONCEPT'
  | 'DETERMINISTIC_EXTRACTION'
  | 'NORMALIZATION'
  | 'SYSTEM_CONFIG'
  | 'USER_INPUT'
  | 'deterministic'
  | 'llm';

export type EntitySourceType = EntityProvenance;

export interface LLMEntityValue {
  value: unknown;
  evidence?: string;
  source?: EntityProvenance;
  confirmed?: boolean;
  confidence?: number;
}

export interface ExtractedConcept {
  name: string;
  value: string;
  type?: string;
  isKnown?: boolean;
  evidence?: string;
  confidence?: number;
}

export interface LLMOutputShape {
  intent?: string;
  confidence?: number;
  isCorrection?: boolean;
  isDontKnow?: boolean;
  language?: string;
  entities?: Record<string, unknown | LLMEntityValue>;
  concepts?: ExtractedConcept[];
  missingInformation?: string[];
  followUpQuestion?: string;
  estimationOffered?: boolean;
}

export const llmOutputZodSchema = z.object({
  intent: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  isCorrection: z.boolean().optional(),
  isDontKnow: z.boolean().optional(),
  language: z.string().optional(),
  entities: z.record(z.string(), z.unknown()).optional(),
  concepts: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
        type: z.string().optional(),
        isKnown: z.boolean().optional(),
        evidence: z.string().optional(),
        confidence: z.number().optional(),
      })
    )
    .optional(),
  missingInformation: z.array(z.string()).optional(),
  followUpQuestion: z.string().optional(),
  estimationOffered: z.boolean().optional(),
});

export interface ExtractedEntity {
  field: string;
  value: unknown;
  rawSnippet?: string;
  evidence?: string;
  confidence: number;
  source: EntityProvenance;
  confirmed?: boolean;
}

export interface NLUProcessOptions {
  sessionId?: string;
  currentDraft?: Record<string, unknown>;
  expectedField?: string; // If system just asked for a specific field
  languageHint?: string;
  generateFollowUp?: boolean;
  allowEstimates?: boolean;
}

export type NLUPipelineStatus =
  | 'LLM_ATTEMPTED'
  | 'LLM_SUCCEEDED'
  | 'LLM_FAILED'
  | 'LLM_RETURNED_EMPTY_RESULT'
  | 'DETERMINISTIC_VALIDATION_FAILED'
  | 'FALLBACK_USED';

export interface NLUDiagnostics {
  llmAttempted: boolean;
  llmSucceeded: boolean;
  llmFailed: boolean;
  llmReturnedEmpty: boolean;
  provider: string;
  model?: string;
  fallbackUsed: boolean;
  pipelineStatus: NLUPipelineStatus;
}

export interface NLUExtractionResult {
  intent: IntentResult;
  entities: Record<string, unknown>;
  entityDetails: ExtractedEntity[];
  concepts?: ExtractedConcept[];
  detectedLanguage?: string;
  isCorrection: boolean;
  isDontKnow?: boolean;
  overallConfidence: number;
  validation: ValidationResult;
  missingFields: string[];
  rawText: string;
  followUpQuestion?: string;
  estimationOffered?: boolean;
  pipelineStatus?: NLUPipelineStatus;
  diagnostics?: NLUDiagnostics;
}

