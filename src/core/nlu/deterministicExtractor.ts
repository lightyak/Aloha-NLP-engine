import type { ExtractedEntity } from './types.js';
import type { OntologyRegistry } from '../../ontology/ontologyRegistry.js';
import { NormalizationEngine } from '../normalization/normalizationEngine.js';

export interface DeterministicExtractionResult {
  entities: Record<string, unknown>;
  entityDetails: ExtractedEntity[];
  detectedLanguage?: string;
  isCorrectionCandidate: boolean;
  matchedCraft?: string;
}

export class DeterministicExtractor {
  /**
   * Fast deterministic extraction for known ontology terms, currencies, units, and scripts
   */
  public static extract(
    text: string,
    ontology: OntologyRegistry
  ): DeterministicExtractionResult {
    const entities: Record<string, unknown> = {};
    const entityDetails: ExtractedEntity[] = [];

    // 1. Language Script Detection
    const detectedLanguage = this.detectScriptLanguage(text);

    // 2. Correction Candidate Detection
    const isCorrectionCandidate = this.isCorrection(text);

    // 3. Deterministic Craft Detection via Ontology
    const craft = ontology.findCraft(text);
    let matchedCraft: string | undefined;
    if (craft) {
      matchedCraft = craft.name;
      entities.craft_type = craft.name;
      entities.category = craft.category;
      entityDetails.push({
        field: 'craft_type',
        value: craft.name,
        evidence: text,
        confidence: 0.95,
        source: 'ONTOLOGY_MATCH',
      });
      entityDetails.push({
        field: 'category',
        value: craft.category,
        evidence: text,
        confidence: 0.95,
        source: 'ONTOLOGY_MATCH',
      });
    }

    // 4. Deterministic Material Detection via Ontology
    const cleanLowerText = text.toLowerCase();
    const materialsFound: string[] = [];
    const allMaterials = ontology.getAllMaterials();

    for (const mat of allMaterials) {
      const isMatch =
        cleanLowerText.includes(mat.canonical.toLowerCase()) ||
        mat.aliases.some((alias) => cleanLowerText.includes(alias.toLowerCase())) ||
        (mat.localNames && Object.values(mat.localNames).some((loc) => cleanLowerText.includes(loc.toLowerCase())));

      if (isMatch && !materialsFound.includes(mat.canonical)) {
        materialsFound.push(mat.canonical);
      }
    }
    if (materialsFound.length > 0) {
      entities.material = materialsFound;
      entityDetails.push({
        field: 'material',
        value: materialsFound,
        evidence: text,
        confidence: 0.90,
        source: 'ONTOLOGY_MATCH',
      });
    }

    // 5. Deterministic Price & Currency Parsing
    const parsedCurrency = NormalizationEngine.parseCurrency(text);
    if (parsedCurrency) {
      entities.price = parsedCurrency.amount;
      entities.currency = parsedCurrency.currency;
      entityDetails.push({
        field: 'price',
        value: parsedCurrency.amount,
        evidence: text,
        confidence: 0.92,
        source: 'DETERMINISTIC_EXTRACTION',
      });
      entityDetails.push({
        field: 'currency',
        value: parsedCurrency.currency,
        evidence: text,
        confidence: 0.95,
        source: 'DETERMINISTIC_EXTRACTION',
      });
    }

    // 6. Deterministic Time Unit Parsing
    const timeMatch = text.match(/(\d+)\s*(?:rojulu|roju|days?|weeks?|vaaralu|vaaram|din|months?|nelalu)/i);
    if (timeMatch) {
      const normalizedTime = NormalizationEngine.normalizeTimeUnit(timeMatch[0]);
      entities.production_time = normalizedTime;
      entityDetails.push({
        field: 'production_time',
        value: normalizedTime,
        evidence: timeMatch[0],
        confidence: 0.90,
        source: 'DETERMINISTIC_EXTRACTION',
      });
    }

    // 7. Deterministic Product Name Pattern Parsing
    const nameMatch = text.match(/(?:product\s+name\s+is|name\s+is|product\s+is|title\s+is|called)\s+[:\-]?\s*([A-Za-z0-9\s\u0C00-\u0C7F\u0900-\u097F]+)/i);
    if (nameMatch && nameMatch[1]) {
      const rawName = nameMatch[1].trim();
      if (rawName.length > 2) {
        entities.product_name = rawName;
        entityDetails.push({
          field: 'product_name',
          value: rawName,
          evidence: nameMatch[0],
          confidence: 0.92,
          source: 'DETERMINISTIC_EXTRACTION',
        });
      }
    }

    return {
      entities,
      entityDetails,
      detectedLanguage,
      isCorrectionCandidate,
      matchedCraft,
    };
  }

  private static detectScriptLanguage(text: string): string | undefined {
    if (/[\u0C00-\u0C7F]/.test(text)) return 'te'; // Telugu
    if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Devanagari (Hindi)
    if (/[\u0B80-\u0BFF]/.test(text)) return 'ta'; // Tamil
    if (/[\u0C80-\u0CFF]/.test(text)) return 'kn'; // Kannada
    if (/^[a-zA-Z0-9\s.,!?'"₹$€-]+$/.test(text)) return 'en'; // English/Latin
    return undefined;
  }

  private static isCorrection(text: string): boolean {
    const lower = text.toLowerCase();
    const correctionKeywords = [
      'actually',
      'instead',
      'change',
      'not',
      'mistake',
      'wrong',
      'correct to',
      'update to',
      'కాదు',
      'బదులుగా',
      'మార్చండి',
      'తప్పు',
      'नहीं',
      'बदलो',
    ];
    return correctionKeywords.some((kw) => lower.includes(kw));
  }
}
