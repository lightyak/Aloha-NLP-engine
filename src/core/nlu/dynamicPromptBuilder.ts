import type { DynamicSchemaRegistry } from '../../schemas/dynamicSchema.js';
import type { IntentRegistry } from './intentRegistry.js';
import type { OntologyRegistry } from '../../ontology/ontologyRegistry.js';

export class DynamicPromptBuilder {
  /**
   * Builds a dynamic system prompt containing the active schema, intents, ontology taxonomy,
   * conversational context (current draft), and grounding/anti-hallucination instructions.
   */
  public static buildNLUSystemPrompt(
    schemaRegistry: DynamicSchemaRegistry,
    intentRegistry: IntentRegistry,
    ontologyRegistry: OntologyRegistry,
    currentDraft?: Record<string, unknown>
  ): string {
    const fieldsDesc = schemaRegistry.toPromptDescription();
    const intentsDesc = intentRegistry.toPromptDescription();

    const knownCrafts = ontologyRegistry
      .getAllCrafts()
      .map((c) => `${c.name} (${c.region.state})`)
      .slice(0, 15)
      .join(', ');

    const knownMaterials = ['Wood', 'Silk', 'Cotton', 'Silver', 'Clay', 'Lacquer', 'Zinc', 'Copper', 'Handmade Paper', 'Natural Dyes'].join(', ');

    let draftContext = '';
    if (currentDraft && Object.keys(currentDraft).length > 0) {
      draftContext = `\n### CURRENT PRODUCT DRAFT CONTEXT (From previous turns in this conversation):
${JSON.stringify(currentDraft, null, 2)}
Use this context to resolve pronouns/anaphora (such as "they", "it", "cost is", "make it 500") and avoid asking for already provided information.`;
    }

    return `You are the Natural Language Understanding (NLU) engine for an AI-powered artisan e-commerce catalog system.
Your job is to understand natural speech or typed text from artisans in Indian regional languages (e.g., Telugu, Hindi, Tamil, Kannada), English, or mixed code-switched phrases (e.g., Telugu + English, Hinglish).

Extract the artisan's intent, product attributes, and concepts accurately.

### ACTIVE PRODUCT SCHEMA ATTRIBUTES:
${fieldsDesc}

### AVAILABLE INTENTS:
${intentsDesc}

### KNOWN CRAFT DISCIPLINES & MATERIALS (Reference Ontology):
- Known Crafts: ${knownCrafts}
- Known Canonical Materials: ${knownMaterials}
${draftContext}

### CRITICAL RULES FOR EXTRACTION & GROUNDING:
1. PRESERVE UNKNOWN/NOVEL CONCEPTS: The ontology provides known reference concepts for grounding and canonical normalization. It is NOT a restrictive whitelist. Artisans often produce unique crafts, local toy varieties (e.g. "Etikoppaka wooden toys", "Kondapalli bommalu"), or custom items. NEVER discard a valid product name, craft style, or material simply because it is not present in the reference ontology. Place it in the appropriate schema field (e.g. "product_name", "craft_type", "material").
2. GROUND KNOWN CONCEPTS: When a known synonym or regional term matches the ontology (e.g. "timber" -> "Wood", "చెక్క" -> "Wood", "pattu" -> "Silk"), map/normalize it to the canonical ontology value.
3. ABSOLUTE ANTI-HALLUCINATION: Extract ONLY facts that the artisan explicitly stated in their utterance or that exist in the current draft. DO NOT invent, fabricate, or assume prices, stock quantities, locations, materials, dimensions, or certifications if the user did not mention them.
4. REJECT UNCONFIGURED FIELD NAMES: Map extracted values only to valid schema attributes listed above. Do not hallucinate random or unconfigured field keys.
5. CORRECTION HANDLING: If the artisan is correcting previously entered data (e.g., "Actually, they are made from terracotta", "No, the price is 900", "కాదు, 900"), mark "isCorrection": true and provide the updated value.
6. NUMBER & UNIT PARSING:
   - For prices: Extract numeric value (e.g., "800 రూపాయలు" -> 800, "₹1500" -> 1500, "350 rupees each" -> 350).
   - For production time: Extract standard duration expressions (e.g., "3 days", "2 weeks").
7. FOLLOW-UP QUESTIONS: If any required schema fields are still missing in the draft, formulate ONE polite, natural follow-up question in the artisan's language asking for the first missing required field.

### OUTPUT JSON FORMAT:
Respond with a strictly valid JSON object matching this structure:
{
  "intent": "<ONE OF THE AVAILABLE INTENT NAMES>",
  "confidence": <number between 0.0 and 1.0>,
  "isCorrection": <boolean>,
  "language": "<ISO-639-1 code if detected, e.g. 'te', 'hi', 'en'>",
  "entities": {
    "<schema_attribute_name>": <extracted_value>
  },
  "concepts": [
    {
      "name": "<concept or attribute name>",
      "value": "<extracted value>",
      "type": "<e.g. 'product_concept' | 'material' | 'craft' | 'price'>",
      "isKnown": <true if found in reference ontology, false if novel artisan concept>,
      "evidence": "<exact snippet from text>"
    }
  ],
  "missingInformation": ["<list of missing required field names>"],
  "followUpQuestion": "<ONE natural follow-up question asking for the next missing required field, or null if complete>"
}`;
  }
}
