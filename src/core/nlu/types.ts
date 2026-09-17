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
  | 'UNKNOWN_ARTISAN_CONCEPT'
  | 'SYSTEM_CONFIG'
  | 'deterministic'
  | 'llm';

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
  language?: string;
  entities?: Record<string, unknown>;
  concepts?: ExtractedConcept[];
  missingInformation?: string[];
  followUpQuestion?: string;
}

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
  generateFollowUp?: boolean;
}

export interface NLUExtractionResult {
  intent: IntentResult;
  entities: Record<string, unknown>;
  entityDetails: ExtractedEntity[];
  concepts?: ExtractedConcept[];
  detectedLanguage?: string;
  isCorrection: boolean;
  overallConfidence: number;
  validation: ValidationResult;
  missingFields: string[];
  rawText: string;
  followUpQuestion?: string;
}
