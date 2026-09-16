import type { ILLMProvider } from '../../providers/llm/llmProvider.interface.js';
import { defaultLLMProvider } from '../../providers/llm/llmProvider.factory.js';
import type { CatalogData } from '../../repositories/interfaces/product.repository.interface.js';
import { ProviderError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

interface CatalogLLMOutput {
  title?: string;
  short_description?: string;
  detailed_description?: string;
  tags?: string[];
  search_keywords?: string[];
}

export class CatalogGenerator {
  private llmProvider: ILLMProvider;

  constructor(llmProvider?: ILLMProvider) {
    this.llmProvider = llmProvider || defaultLLMProvider;
  }

  /**
   * Generate product catalog content from validated product attributes.
   * LLM is explicitly prohibited from inventing facts not in the provided data.
   */
  public async generate(
    validatedAttributes: Record<string, unknown>,
    language = 'en'
  ): Promise<CatalogData> {
    const attributesJson = JSON.stringify(validatedAttributes, null, 2);

    const systemPrompt = `You are a professional product catalog writer for an artisan handicraft marketplace.
Generate catalog content STRICTLY from the provided product attributes.
ANTI-HALLUCINATION & PRIVACY RULES:
1. DO NOT invent, assume, or embellish any attributes not explicitly stated in the data.
2. DO NOT invent artisan generations, lineage, historical claims, certifications, GI status, techniques, or awards unless explicitly provided.
3. DO NOT invent location, dimensions, weight, stock quantity, delivery times, or price discounts.
4. DO NOT invent or disclose any personal identifiable information (artisan names, phone numbers, addresses).
5. Preserve all numbers and currencies verbatim as provided.
6. If a detail is missing or unavailable, simply omit it.
7. Respond in English regardless of input language.

Rules:
- title: Concise, descriptive product name (max 80 chars)
- short_description: 1-2 sentences summary (max 150 chars)
- detailed_description: 3-5 sentences highlighting craftsmanship, materials, region, and use (max 500 chars)
- tags: 5-8 relevant tags (lowercase, no spaces within a tag)
- search_keywords: 8-12 search-optimized keywords

Respond with ONLY valid JSON matching this structure:
{
  "title": "string",
  "short_description": "string",
  "detailed_description": "string",
  "tags": ["string"],
  "search_keywords": ["string"]
}`;

    const userPrompt = `Generate catalog content for the following validated product attributes:
${attributesJson}
Input language context: ${language}`;

    try {
      const response = await this.llmProvider.generateStructured<CatalogLLMOutput>(
        userPrompt,
        systemPrompt
      );

      const out = response.data;

      if (!out.title) {
        throw new ProviderError('CatalogGenerator', 'LLM returned empty catalog title');
      }

      return {
        title: out.title,
        shortDescription: out.short_description,
        detailedDescription: out.detailed_description,
        tags: Array.isArray(out.tags) ? out.tags : [],
        searchKeywords: Array.isArray(out.search_keywords) ? out.search_keywords : [],
      };
    } catch (error) {
      logger.warn({ err: error }, 'LLM catalog generation failed, using fallback');
      return this.fallbackCatalog(validatedAttributes);
    }
  }

  /**
   * Deterministic fallback — builds minimal catalog from attributes without LLM.
   * Ensures catalog is never empty even when LLM is unavailable.
   */
  private fallbackCatalog(attrs: Record<string, unknown>): CatalogData {
    const name = String(attrs['product_name'] || attrs['craft_type'] || 'Handcrafted Product');
    const craft = attrs['craft_type'] ? String(attrs['craft_type']) : '';
    const materials = Array.isArray(attrs['material'])
      ? (attrs['material'] as string[]).join(', ')
      : '';
    const price = attrs['price'] ? `₹${attrs['price']}` : '';

    const parts = [craft, materials, price].filter(Boolean);
    const title = `${name}${craft && craft !== name ? ` - ${craft}` : ''}`;

    return {
      title: title.slice(0, 80),
      shortDescription: parts.length > 0 ? `${name}. ${parts.join('. ')}.` : name,
      detailedDescription: `Handcrafted ${name.toLowerCase()} by a skilled artisan. ${materials ? `Made with ${materials}.` : ''} ${price ? `Priced at ${price}.` : ''}`.trim(),
      tags: [craft, materials].filter(Boolean).map((t) => t.toLowerCase().replace(/\s+/g, '-')),
      searchKeywords: [name, craft, materials, 'handcraft', 'artisan', 'india']
        .filter(Boolean)
        .map((k) => k.toLowerCase()),
    };
  }
}

export const defaultCatalogGenerator = new CatalogGenerator();
