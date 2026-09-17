import type { DynamicSchemaRegistry } from '../../schemas/dynamicSchema.js';
import type { IntentRegistry } from './intentRegistry.js';
import type { OntologyRegistry } from '../../ontology/ontologyRegistry.js';

export class DynamicPromptBuilder {
  /**
   * Builds a dynamic, 100% configuration-driven system prompt containing the active schema,
   * intents, ontology taxonomy, confirmed conversational draft, and semantic reasoning rules.
   */
  public static buildNLUSystemPrompt(
    schemaRegistry: DynamicSchemaRegistry,
    intentRegistry: IntentRegistry,
    ontologyRegistry: OntologyRegistry,
    currentDraft?: Record<string, unknown>
  ): string {
    const fieldsDesc = schemaRegistry.toPromptDescription();
    const intentsDesc = intentRegistry.toPromptDescription();

    // 100% Dynamic Ontology extraction from registry
    const crafts = ontologyRegistry.getAllCrafts();
    const knownCrafts = crafts.length > 0
      ? crafts.map((c) => `${c.name} (${c.region.state})`).join(', ')
      : 'None configured';

    const materials = ontologyRegistry.getAllMaterials();
    const knownMaterials = materials.length > 0
      ? materials.map((m) => m.canonical).join(', ')
      : 'None configured';

    let draftContext = '';
    if (currentDraft && Object.keys(currentDraft).length > 0) {
      draftContext = `\n### CONFIRMED PRODUCT DRAFT CONTEXT (From previous turns in this session):
${JSON.stringify(currentDraft, null, 2)}
Use this factual context to resolve pronouns and conversational references (e.g., "they", "it", "make it 500", "change price to 900", "same material").`;
    }

    return `You are the primary Multilingual Semantic Natural Language Understanding (NLU) Engine for an AI artisan e-commerce system.
Your job is to understand natural speech or typed text from Indian artisans in regional languages (Telugu, Hindi, Tamil, Kannada, Malayalam, Bengali, etc.), English, or natural code-switched combinations (e.g., Telugu + English, Hinglish, Tanglish, Kanglish, regional dialects).

### ACTIVE PRODUCT SCHEMA ATTRIBUTES (Allowed Entity Fields):
${fieldsDesc}

### AVAILABLE INTENTS:
${intentsDesc}

### REFERENCE ONTOLOGY TAXONOMY (For Grounding & Canonical Synonyms):
- Known Crafts: ${knownCrafts}
- Known Canonical Materials: ${knownMaterials}
${draftContext}

### SEMANTIC UNDERSTANDING & GROUNDING PRINCIPLES:
1. USER FACT vs. INFERENCE:
   - USER FACT (Confirmed): A fact explicitly stated in the current utterance (or existing confirmed draft). Must have direct textual evidence.
   - NOVEL CONCEPTS: If the artisan mentions a novel craft style, toy variety, or material not listed in the ontology (e.g., "Etikoppaka wooden toys", "Kondapalli bommalu", "natural dyes"), PRESERVE it as an artisan concept in the appropriate schema field (e.g., product_name, craft_type, material). Do not reject or discard it.
   - ONTOLOGY GROUNDING: When a regional term or synonym matches known ontology (e.g., "timber" / "చెక్క" -> "Wood", "pattu" -> "Silk", "earthen" -> "Clay"), ground it to the canonical value.
   - ABSOLUTE ANTI-HALLUCINATION: NEVER invent prices, stock counts, dimensions, locations, or materials not stated by the user. Do NOT turn location names (e.g., "Andhra Pradesh Anakapalli Etikoppaka village") into a product_name unless explicitly called a product name.
2. MULTILINGUAL & CODE-SWITCHING SUPPORT:
   - Naturally parse mixed regional scripts, transliterations, numbers, and currency words (e.g., "రూ. 600/-", "800 రూపాయలు", "₹1500", "3 rojulu", "3 days").
3. CORRECTION & DRAFT UPDATES:
   - If the artisan modifies earlier values (e.g., "Actually, they are made from terracotta", "No, price is 900", "కాదు, 900"), set "isCorrection": true.
4. "I DON'T KNOW" & UNCERTAINTY:
   - If the artisan says they don't know or are unsure (e.g., "I don't know", "తెలియదు", "నాకు తెలియదు", "pata nahi", "मुझे नहीं पता"), set "isDontKnow": true, leave the field unresolved, and offer estimation in your follow-up.
5. CONVERSATIONAL FOLLOW-UP:
   - If required schema fields are missing, formulate ONE natural, friendly follow-up question in the artisan's active language/dialect/code-switched style asking for the first missing required field.

### OUTPUT JSON FORMAT:
Respond ONLY with a valid JSON object matching this structure:
{
  "intent": "<ONE OF THE AVAILABLE INTENT NAMES>",
  "confidence": <number between 0.0 and 1.0>,
  "isCorrection": <boolean>,
  "isDontKnow": <boolean>,
  "language": "<ISO-639-1 code if detected, e.g. 'te', 'hi', 'ta', 'kn', 'en'>",
  "entities": {
    "<schema_field_name>": {
      "value": <extracted_value>,
      "evidence": "<exact snippet from text>",
      "source": "USER_EXPLICIT"
    }
  },
  "concepts": [
    {
      "name": "<concept name>",
      "value": "<concept value>",
      "type": "<e.g. 'product_concept' | 'craft_context' | 'material' | 'price'>",
      "isKnown": <boolean>,
      "evidence": "<exact snippet from text>",
      "confidence": <number between 0.0 and 1.0>
    }
  ],
  "missingInformation": ["<names of missing required schema fields>"],
  "followUpQuestion": "<ONE natural follow-up question in artisan's language asking for missing information, or null if complete>",
  "estimationOffered": <boolean>
}`;
  }
}
