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

export type EntitySourceType =
  | 'USER_INPUT'
  | 'DETERMINISTIC_EXTRACTION'
  | 'ONTOLOGY_MATCH'
  | 'NORMALIZATION'
  | 'LLM_EXTRACTION'
  | 'SYSTEM_CONFIG'
  | 'deterministic'
  | 'llm';

export interface ExtractedEntity {
  field: string;
  value: unknown;
  rawSnippet?: string;
  evidence?: string;
  confidence: number;
  source: EntitySourceType;
}

export interface NLUProcessOptions {
  sessionId?: string;
  currentDraft?: Record<string, unknown>;
  expectedField?: string; // If system just asked for a specific field
  languageHint?: string;
}

export interface NLUExtractionResult {
  intent: IntentResult;
  entities: Record<string, unknown>;
  entityDetails: ExtractedEntity[];
  detectedLanguage?: string;
  isCorrection: boolean;
  overallConfidence: number;
  validation: ValidationResult;
  missingFields: string[];
  rawText: string;
}
