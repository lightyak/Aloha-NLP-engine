import type {
  NLUExtractionResult,
  NLUProcessOptions,
  ExtractedEntity,
  ExtractedConcept,
  LLMOutputShape,
  LLMEntityValue,
  IntentResult,
  NLUPipelineStatus,
  EntityProvenance,
} from './types.js';
import { llmOutputZodSchema } from './types.js';
import type { ILLMProvider } from '../../providers/llm/llmProvider.interface.js';
import { defaultLLMProvider } from '../../providers/llm/llmProvider.factory.js';
import { DynamicSchemaRegistry, defaultSchemaRegistry } from '../../schemas/dynamicSchema.js';
import { IntentRegistry, defaultIntentRegistry } from './intentRegistry.js';
import { OntologyRegistry, defaultOntologyRegistry } from '../../ontology/ontologyRegistry.js';
import { DynamicPromptBuilder } from './dynamicPromptBuilder.js';
import { NormalizationEngine } from '../normalization/normalizationEngine.js';
import { ValidationError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type { FieldDefinition } from '../../schemas/types.js';

export class NLUEngine {
  private schemaRegistry: DynamicSchemaRegistry;
  private intentRegistry: IntentRegistry;
  private ontologyRegistry: OntologyRegistry;
  private llmProvider: ILLMProvider;

  constructor(options?: {
    schemaRegistry?: DynamicSchemaRegistry;
    intentRegistry?: IntentRegistry;
    ontologyRegistry?: OntologyRegistry;
    llmProvider?: ILLMProvider;
  }) {
    this.schemaRegistry = options?.schemaRegistry || defaultSchemaRegistry;
    this.intentRegistry = options?.intentRegistry || defaultIntentRegistry;
    this.ontologyRegistry = options?.ontologyRegistry || defaultOntologyRegistry;
    this.llmProvider = options?.llmProvider || defaultLLMProvider;
  }

  /**
   * Main entry point to process natural artisan utterance into structured NLU result
   * Architecture: Gemini is the primary semantic engine; programmatic layers validate,
   * ground against ontology, normalize, track provenance, and guard against hallucinations.
   */
  public async process(
    text: string,
    options?: NLUProcessOptions
  ): Promise<NLUExtractionResult> {
    if (!text || !text.trim()) {
      throw new ValidationError('Input utterance cannot be empty');
    }

    const cleanText = text.trim();
    logger.debug({ text: cleanText, sessionId: options?.sessionId }, 'Processing NLU utterance with Gemini Primary Engine');

    let pipelineStatus: NLUPipelineStatus = 'LLM_ATTEMPTED';

    // 1. Build Dynamic System Prompt reflecting active schema, intents, ontology, and confirmed draft context
    const confirmedDraft = options?.currentDraft ? this.filterConfirmedDraft(options.currentDraft) : undefined;
    const systemPrompt = DynamicPromptBuilder.buildNLUSystemPrompt(
      this.schemaRegistry,
      this.intentRegistry,
      this.ontologyRegistry,
      confirmedDraft
    );

    // 2. Gemini Semantic NLU Understanding
    let llmResult: LLMOutputShape = {};
    let llmSucceeded = false;

    try {
      const response = await this.llmProvider.generateStructured<LLMOutputShape>(
        cleanText,
        systemPrompt
      );

      if (response && response.data) {
        const validation = llmOutputZodSchema.safeParse(response.data);
        if (validation.success) {
          llmResult = validation.data as LLMOutputShape;
          pipelineStatus = 'LLM_SUCCEEDED';
          llmSucceeded = true;
        } else {
          logger.warn(
            { issues: validation.error.issues },
            'LLM output failed Zod schema validation - returning degraded NLU state'
          );
          pipelineStatus = 'DETERMINISTIC_VALIDATION_FAILED';
          llmSucceeded = false;
        }
      } else {
        pipelineStatus = 'LLM_RETURNED_EMPTY_RESULT';
      }
    } catch (error) {
      logger.warn(
        { err: error instanceof Error ? error.message : String(error) },
        'LLM semantic processing failed - returning degraded NLU state'
      );
      pipelineStatus = 'LLM_FAILED';
    }

    // 3. Intent Resolution & Validation against IntentRegistry
    const isCorrection = Boolean(llmResult.isCorrection);
    const isDontKnow = Boolean(llmResult.isDontKnow || this.detectDontKnow(cleanText));
    let resolvedIntentName = llmSucceeded ? 'CREATE_PRODUCT' : 'UNKNOWN';
    let intentConfidence = llmSucceeded ? 0.85 : 0.0;

    if (llmSucceeded && llmResult.intent) {
      const directMatch = this.intentRegistry.getIntent(llmResult.intent);
      if (directMatch) {
        resolvedIntentName = directMatch.name;
        intentConfidence = llmResult.confidence ?? directMatch.defaultConfidence;
      } else {
        const caseMatch = this.intentRegistry
          .getIntents()
          .find((i) => i.name.toLowerCase() === llmResult.intent?.toLowerCase());
        if (caseMatch) {
          resolvedIntentName = caseMatch.name;
          intentConfidence = llmResult.confidence ?? caseMatch.defaultConfidence;
        } else {
          logger.warn({ unknownIntent: llmResult.intent }, 'Unknown intent from LLM, validating against intent registry');
          resolvedIntentName = isCorrection ? 'CORRECT_INFORMATION' : 'CREATE_PRODUCT';
          intentConfidence = 0.75;
        }
      }
    } else if (llmSucceeded && isCorrection) {
      resolvedIntentName = 'CORRECT_INFORMATION';
      intentConfidence = 0.85;
    }

    const intent: IntentResult = {
      name: resolvedIntentName,
      confidence: intentConfidence,
    };

    // 4. Programmatic Entity Validation, Grounding & Provenance Tracking
    const configuredFields = this.schemaRegistry.getFields();
    const validEntities: Record<string, unknown> = {};
    const entityDetails: ExtractedEntity[] = [];
    const concepts: ExtractedConcept[] = [];

    if (llmResult.concepts && Array.isArray(llmResult.concepts)) {
      for (const concept of llmResult.concepts) {
        // Determine isKnown programmatically against OntologyRegistry
        const isKnownCraft = Boolean(this.ontologyRegistry.findCraft(concept.value));
        const isKnownMat = Boolean(this.ontologyRegistry.findMaterial(concept.value));
        const isKnownCat = Boolean(this.ontologyRegistry.findCategory(concept.value));

        concepts.push({
          ...concept,
          isKnown: isKnownCraft || isKnownMat || isKnownCat || Boolean(concept.isKnown),
        });
      }
    }

    if (llmResult.entities && typeof llmResult.entities === 'object') {
      for (const [rawKey, rawEntityVal] of Object.entries(llmResult.entities)) {
        if (rawEntityVal === undefined || rawEntityVal === null || rawEntityVal === '') continue;

        // Extract value and evidence from either flat structure or rich LLMEntityValue
        let extractedVal: unknown;
        let evidence: string = cleanText;
        let source: EntityProvenance = 'USER_EXPLICIT';
        let confirmed = true;

        if (typeof rawEntityVal === 'object' && rawEntityVal !== null && 'value' in rawEntityVal) {
          const richVal = rawEntityVal as LLMEntityValue;
          extractedVal = richVal.value;
          if (richVal.evidence) evidence = richVal.evidence;
          if (richVal.source) source = richVal.source;
          if (richVal.confirmed !== undefined) confirmed = richVal.confirmed;
        } else {
          extractedVal = rawEntityVal;
        }

        if (extractedVal === undefined || extractedVal === null || extractedVal === '') continue;

        // Anti-Hallucination: Validate schema field key against whitelist and aliases
        const fieldDef = this.resolveFieldDefinition(rawKey, configuredFields);
        if (!fieldDef) {
          logger.warn(
            { field: rawKey, value: extractedVal },
            'Discarded unconfigured/unknown entity field generated by LLM'
          );
          continue;
        }

        // Programmatic Ontology Grounding
        const groundingResult = this.groundFieldValue(fieldDef, extractedVal, evidence, concepts);
        const groundedVal = groundingResult.value;

        // Programmatic Normalization (e.g., currency, time units, trims)
        let normalizedVal = NormalizationEngine.normalizeFieldValue(fieldDef, groundedVal);

        // Price Normalization: If price was provided as a string expression (e.g., "₹1,200", "800 rs"), normalize to numeric amount
        if (fieldDef.name === 'price' && typeof extractedVal === 'string') {
          const parsed = NormalizationEngine.parseCurrency(extractedVal);
          if (parsed) {
            normalizedVal = parsed.amount;
          }
        }

        if (normalizedVal !== undefined && normalizedVal !== null) {
          validEntities[fieldDef.name] = normalizedVal;

          let provenanceSource: EntityProvenance = isCorrection
            ? 'USER_CORRECTION'
            : (source || 'USER_EXPLICIT');

          // Programmatic ontology grounding is authoritative: if our registry confirms
          // the value exists in the ontology, promote provenance to ONTOLOGY_MATCH
          // regardless of what the LLM reported. Only user corrections take higher priority.
          if (groundingResult.isOntologyMatch && !isCorrection) {
            provenanceSource = 'ONTOLOGY_MATCH';
          }

          entityDetails.push({
            field: fieldDef.name,
            value: normalizedVal,
            evidence,
            confidence: llmResult.confidence ?? 0.9,
            source: provenanceSource,
            confirmed,
          });
        }
      }
    }

    // 5. Schema Normalization on draft
    const normalizedEntities = this.schemaRegistry.normalizeDraft(validEntities);

    // 6. Conversational State / Contextual Draft Accumulation
    const effectiveDraft = options?.currentDraft
      ? { ...options.currentDraft, ...normalizedEntities }
      : normalizedEntities;

    // 7. Dynamic Schema Validation & Missing Fields
    const validation = this.schemaRegistry.validateDraft(effectiveDraft);
    const missingFields = this.schemaRegistry.getMissingFields(effectiveDraft);

    // 8. Language Detection
    const detectedLanguage =
      llmResult.language || options?.languageHint || this.detectLanguageHeuristic(cleanText) || 'en';

    // 9. Conversational Follow-Up Question
    let followUpQuestion: string | undefined;
    let estimationOffered = Boolean(llmResult.estimationOffered || isDontKnow);

    if (pipelineStatus === 'LLM_FAILED') {
      followUpQuestion = 'NLU service is temporarily unavailable. Please try again.';
    } else if (missingFields.length > 0) {
      if (llmResult.followUpQuestion) {
        followUpQuestion = llmResult.followUpQuestion;
      } else if (isDontKnow) {
        followUpQuestion = this.generateDontKnowFollowUp(missingFields[0], detectedLanguage);
        estimationOffered = true;
      } else {
        followUpQuestion = this.generateMultilingualFollowUp(missingFields[0], detectedLanguage);
      }
    }

    const diagnostics = {
      llmAttempted: true,
      llmSucceeded,
      llmFailed: pipelineStatus === 'LLM_FAILED',
      llmReturnedEmpty: pipelineStatus === 'LLM_RETURNED_EMPTY_RESULT',
      provider: this.llmProvider.name,
      fallbackUsed: false,
      pipelineStatus,
    };

    return {
      intent,
      entities: normalizedEntities,
      entityDetails,
      concepts,
      detectedLanguage,
      isCorrection,
      isDontKnow,
      overallConfidence: Math.min(intentConfidence, 0.95),
      validation,
      missingFields,
      rawText: cleanText,
      followUpQuestion,
      estimationOffered,
      pipelineStatus,
      diagnostics,
    };
  }

  /**
   * Filters a draft to only include confirmed values (not estimates or pending)
   */
  private filterConfirmedDraft(draft: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(draft)) {
      if (v !== undefined && v !== null && v !== '') {
        clean[k] = v;
      }
    }
    return clean;
  }

  /**
   * Detects "I don't know" phrases across regional Indian languages & English
   */
  private detectDontKnow(text: string): boolean {
    const lower = text.toLowerCase().trim();
    const phrases = [
      "i don't know",
      "dont know",
      "not sure",
      "no idea",
      "తెలియదు",
      "నాకు తెలియదు",
      "గుర్తులేదు",
      "pata nahi",
      "mujhe nahi pata",
      "मुझे नहीं पता",
      "पता नहीं",
      "theriyathu",
      "enakku theriyathu",
      "தெரியாது",
      "gottilla",
      "nanage gottilla",
      "ಗೊತ್ತಿಲ್ಲ",
    ];
    return phrases.some((p) => lower.includes(p));
  }

  /**
   * Resolves field key against schema names, aliases, and casing variants
   */
  private resolveFieldDefinition(
    key: string,
    fields: FieldDefinition[]
  ): FieldDefinition | undefined {
    const cleanKey = key.trim().toLowerCase().replace(/[-_\s]/g, '');

    for (const field of fields) {
      if (field.name.toLowerCase() === key.toLowerCase()) return field;
      const cleanFieldName = field.name.toLowerCase().replace(/[-_\s]/g, '');
      if (cleanFieldName === cleanKey) return field;

      if (field.aliases) {
        for (const alias of field.aliases) {
          const cleanAlias = alias.toLowerCase().replace(/[-_\s]/g, '');
          if (cleanAlias === cleanKey || alias.toLowerCase() === key.toLowerCase()) {
            return field;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Grounds field values against ontology when recognized, while preserving novel artisan concepts
   */
  private groundFieldValue(
    fieldDef: FieldDefinition,
    val: unknown,
    evidenceText: string,
    concepts: ExtractedConcept[]
  ): { value: unknown; isOntologyMatch: boolean } {
    if (fieldDef.name === 'craft_type' && typeof val === 'string') {
      const craft = this.ontologyRegistry.findCraft(val);
      if (craft) {
        concepts.push({
          name: 'craft_type',
          value: craft.name,
          type: 'craft',
          isKnown: true,
          evidence: evidenceText,
          confidence: 0.95,
        });
        return { value: craft.name, isOntologyMatch: true };
      }
      // Novel craft concept - preserve artisan provided concept
      concepts.push({
        name: 'craft_type',
        value: val,
        type: 'craft',
        isKnown: false,
        evidence: evidenceText,
        confidence: 0.85,
      });
      return { value: val, isOntologyMatch: false };
    }

    if (fieldDef.name === 'category' && typeof val === 'string') {
      const cat = this.ontologyRegistry.findCategory(val);
      return cat ? { value: cat.id, isOntologyMatch: true } : { value: val, isOntologyMatch: false };
    }

    if (fieldDef.name === 'material') {
      const rawList = Array.isArray(val) ? val : [val];
      const groundedList: string[] = [];
      let hadOntologyMatch = false;

      for (const item of rawList) {
        const itemStr = String(item).trim();
        if (!itemStr) continue;

        const canonicalMaterial = this.ontologyRegistry.findMaterial(itemStr);
        if (canonicalMaterial) {
          groundedList.push(canonicalMaterial);
          hadOntologyMatch = true;
          concepts.push({
            name: 'material',
            value: canonicalMaterial,
            type: 'material',
            isKnown: true,
            evidence: itemStr,
            confidence: 0.95,
          });
        } else {
          // Novel artisan material (e.g. natural dyes, coconut shell, terracotta, jute) - preserve!
          groundedList.push(itemStr);
          concepts.push({
            name: 'material',
            value: itemStr,
            type: 'material',
            isKnown: false,
            evidence: itemStr,
            confidence: 0.85,
          });
        }
      }

      const finalVal = fieldDef.type === 'array' ? groundedList : groundedList[0];
      return { value: finalVal, isOntologyMatch: hadOntologyMatch };
    }

    if (fieldDef.name === 'product_name' && typeof val === 'string') {
      concepts.push({
        name: 'product_name',
        value: val,
        type: 'product_concept',
        isKnown: false,
        evidence: evidenceText,
        confidence: 0.9,
      });
      return { value: val, isOntologyMatch: false };
    }

    return { value: val, isOntologyMatch: false };
  }

  /**
   * Fast script detection for language fallback
   */
  private detectLanguageHeuristic(text: string): string {
    if (/[\u0C00-\u0C7F]/.test(text)) return 'te'; // Telugu
    if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Hindi / Devanagari
    if (/[\u0B80-\u0BFF]/.test(text)) return 'ta'; // Tamil
    if (/[\u0C80-\u0CFF]/.test(text)) return 'kn'; // Kannada
    return 'en';
  }

  /**
   * Generates a language-aware follow-up question when artisan expresses uncertainty ("I don't know")
   */
  private generateDontKnowFollowUp(missingField: string, lang: string): string {
    switch (lang) {
      case 'te':
        return `పర్వాలేదు! మీ తరపున నేనే అంచనా వేయమంటారా?`;
      case 'hi':
        return `कोई बात नहीं! क्या आप चाहते हैं कि मैं इसका अनुमान लगाऊं?`;
      case 'ta':
        return `பரவாயில்லை! நான் இதை மதிப்பிட வேண்டுமா?`;
      case 'kn':
        return `ಪರವಾಗಿಲ್ಲ! ನಾನು ಇದನ್ನು ಅಂದಾಜು ಮಾಡಬೇಕೇ?`;
      default:
        return `That's okay! Would you like me to estimate the ${missingField} for you?`;
    }
  }

  /**
   * Generates a natural, multilingual follow-up question for missing required fields
   */
  private generateMultilingualFollowUp(missingField: string, lang: string): string {
    switch (lang) {
      case 'te': {
        switch (missingField) {
          case 'price':
            return 'ఈ బొమ్మ లేదా వస్తువు ధర ఎంత నిర్ణయించాలనుకుంటున్నారు?';
          case 'product_name':
            return 'మీ ఉత్పత్తి పేరు ఏమిటి?';
          case 'material':
            return 'ఈ వస్తువును తయారు చేయడానికి ఏ ఏ ముడి పదార్థాలు ఉపయోగించారు?';
          case 'craft_type':
            return 'ఇది ఏ సాంప్రదాయ కళ లేదా శైలికి చెందినది?';
          case 'production_time':
            return 'ఈ వస్తువు తయారు చేయడానికి ఎన్ని రోజులు సమయం పడుతుంది?';
          default:
            return `దయచేసి ${missingField} వివరాలను తెలపండి.`;
        }
      }
      case 'hi': {
        switch (missingField) {
          case 'price':
            return 'इस उत्पाद की कीमत आप कितनी रखना चाहते हैं?';
          case 'product_name':
            return 'आपके उत्पाद का नाम क्या है?';
          case 'material':
            return 'इसे बनाने में कौन-कौन सी सामग्री इस्तेमाल हुई है?';
          case 'craft_type':
            return 'यह किस पारंपरिक शिल्प या कला शैली का है?';
          case 'production_time':
            return 'इसे बनाने में कितना समय लगता है?';
          default:
            return `कृपया ${missingField} की जानकारी दें।`;
        }
      }
      case 'ta': {
        switch (missingField) {
          case 'price':
            return 'இந்த பொருளின் விலை என்ன?';
          case 'product_name':
            return 'உங்கள் தயாரிப்பின் பெயர் என்ன?';
          case 'material':
            return 'இதை உருவாக்க என்ன பொருட்கள் பயன்படுத்தப்பட்டன?';
          default:
            return `தயவுசெய்து ${missingField} விவரங்களை வழங்கவும்.`;
        }
      }
      case 'kn': {
        switch (missingField) {
          case 'price':
            return 'ಈ ವಸ್ತುವಿನ ಬೆಲೆ ಎಷ್ಟು?';
          case 'product_name':
            return 'ನಿಮ್ಮ ಉತ್ಪನ್ನದ ಹೆಸರು ಏನು?';
          case 'material':
            return 'ಇದನ್ನು ತಯಾರಿಸಲು ಯಾವ ವಸ್ತುಗಳನ್ನು ಬಳಸಲಾಗಿದೆ?';
          default:
            return `ದಯವಿಟ್ಟು ${missingField} ವಿವರಗಳನ್ನು ನೀಡಿ.`;
        }
      }
      default: {
        switch (missingField) {
          case 'price':
            return 'What price would you like to set for this product?';
          case 'product_name':
            return 'What is the name or title of your craft product?';
          case 'material':
            return 'What materials are used to make this item?';
          case 'craft_type':
            return 'What is the craft discipline or style for this item?';
          case 'production_time':
            return 'How long does it take to craft this item?';
          case 'category':
            return 'Which category does this product belong to?';
          default:
            return `Could you please provide the ${missingField}?`;
        }
      }
    }
  }

  public setLLMProvider(provider: ILLMProvider): void {
    this.llmProvider = provider;
  }
}

export const defaultNLUEngine = new NLUEngine();

