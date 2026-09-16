import type { DynamicSchemaRegistry } from '../../schemas/dynamicSchema.js';
import type { IntentRegistry } from './intentRegistry.js';
import type { OntologyRegistry } from '../../ontology/ontologyRegistry.js';

export class DynamicPromptBuilder {
  /**
   * Builds a dynamic system prompt containing the active schema, intents, and ontology taxonomy.
   * Nothing is hard-coded in the prompt; everything reflects current configuration.
   */
  public static buildNLUSystemPrompt(
    schemaRegistry: DynamicSchemaRegistry,
    intentRegistry: IntentRegistry,
    ontologyRegistry: OntologyRegistry
  ): string {
    const fieldsDesc = schemaRegistry.toPromptDescription();
    const intentsDesc = intentRegistry.toPromptDescription();

    const knownCrafts = ontologyRegistry
      .getAllCrafts()
      .map((c) => `${c.name} (${c.region.state})`)
      .slice(0, 10)
      .join(', ');

    return `You are the Natural Language Understanding (NLU) engine for an artisan e-commerce catalog system.
Your job is to understand natural speech or text from artisans in Indian regional languages (e.g., Telugu, Hindi, Tamil, Kannada), English, or mixed code-switched phrases (e.g. Telugu + English, Hinglish).

Extract the artisan's intent and any product attribute entities mentioned.

### CURRENT DYNAMIC PRODUCT SCHEMA ATTRIBUTES:
${fieldsDesc}

### AVAILABLE INTENTS:
${intentsDesc}

### KNOWN CRAFT DISCIPLINES (Reference Ontology):
${knownCrafts}

### RULES FOR EXTRACTION:
1. Understand regional scripts, transliterations, and numbers (e.g., Telugu numerals/words, Hindi, English).
2. For prices: Extract numeric value (e.g., "800 రూపాయలు" -> 800, "₹1500" -> 1500).
3. For durations/time: Extract time expressions (e.g., "మూడు రోజులు" / "3 rojulu" -> "3 days").
4. For materials: Normalize to craft materials list if recognized.
5. Corrections: If the artisan is correcting earlier values (e.g., "Actually the price is 900", "కాదు, 900"), mark "isCorrection": true.
6. Do not invent details that were not stated or strongly implied by the artisan.

### OUTPUT JSON FORMAT:
Respond with a strictly valid JSON object matching this structure:
{
  "intent": "<ONE OF THE AVAILABLE INTENT NAMES>",
  "confidence": <number between 0.0 and 1.0>,
  "isCorrection": <boolean>,
  "language": "<ISO-639-1 code if detected, e.g. 'te', 'hi', 'en'>",
  "entities": {
    "<attribute_name>": <extracted_value>
  }
}`;
  }
}
