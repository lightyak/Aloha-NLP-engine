import type { FieldDefinition, NormalizationConfig } from '../../schemas/types.js';

export interface CurrencyNormalizationResult {
  amount: number;
  currency: string;
}

export interface NormalizationContext {
  currencyAliases?: Record<string, string>;
  unitAliases?: Record<string, string>;
  globalSynonyms?: Record<string, string>;
}

export class NormalizationEngine {
  // Configurable currency map
  private static defaultCurrencyMap: Record<string, string> = {
    '₹': 'INR',
    'rs': 'INR',
    'rs.': 'INR',
    'rupee': 'INR',
    'rupees': 'INR',
    'roopayalu': 'INR',
    'rupaya': 'INR',
    'రూపాయలు': 'INR',
    'రూపాయి': 'INR',
    'రూ.': 'INR',
    'రూ': 'INR',
    'रुपये': 'INR',
    'रुपया': 'INR',
    'रु.': 'INR',
    'रु': 'INR',
    'inr': 'INR',
    '$': 'USD',
    'dollar': 'USD',
    'dollars': 'USD',
    'usd': 'USD',
    '€': 'EUR',
    'euro': 'EUR',
    'eur': 'EUR',
  };

  // Configurable time unit map (multilingual: English, Telugu, Hindi)
  private static defaultTimeUnits: Record<string, string> = {
    'day': 'day',
    'days': 'days',
    'roju': 'day',
    'rojulu': 'days',
    'din': 'day',
    'week': 'week',
    'weeks': 'weeks',
    'vaaram': 'week',
    'vaaralu': 'weeks',
    'hafte': 'weeks',
    'month': 'month',
    'months': 'months',
    'nela': 'month',
    'nelalu': 'months',
    'hour': 'hour',
    'hours': 'hours',
    'ganta': 'hour',
    'gantalu': 'hours',
  };

  /**
   * Normalize a field value according to its field definition and optional context
   */
  public static normalizeFieldValue(
    field: FieldDefinition,
    value: unknown,
    context?: NormalizationContext
  ): unknown {
    if (value === undefined || value === null) return value;

    const norm = field.normalization;

    // String normalization
    if (typeof value === 'string') {
      let str = value;
      if (norm?.trim !== false) str = str.trim();
      if (norm?.lowercase) str = str.toLowerCase();

      // Alias mapping
      if (norm?.aliases) {
        const lower = str.toLowerCase();
        if (norm.aliases[lower]) {
          str = norm.aliases[lower];
        }
      }

      // Unit-specific normalization
      if (norm?.unitType === 'currency') {
        const parsed = this.parseCurrency(str, context?.currencyAliases);
        if (parsed) return parsed.amount;
      }

      if (norm?.unitType === 'time') {
        return this.normalizeTimeUnit(str, context?.unitAliases);
      }

      return str;
    }

    // Number normalization (e.g. numeric strings or raw numbers)
    if (field.type === 'number' && typeof value === 'string') {
      const num = Number(value.replace(/[^0-9.-]+/g, ''));
      if (!isNaN(num)) return num;
    }

    // Array normalization
    if (Array.isArray(value)) {
      return value.map((item) => {
        if (typeof item === 'string') {
          let str = item.trim();
          if (norm?.lowercase) str = str.toLowerCase();
          if (norm?.aliases && norm.aliases[str.toLowerCase()]) {
            str = norm.aliases[str.toLowerCase()];
          }
          return str;
        }
        return item;
      });
    }

    return value;
  }

  /**
   * Parse amounts and currencies from strings like "800 rupees", "₹800", "800 rs", "850 రూపాయలు", "రూ. 1,200/-", "ధర 800"
   */
  public static parseCurrency(
    input: string,
    customAliases?: Record<string, string>
  ): CurrencyNormalizationResult | null {
    if (!input || !input.trim()) return null;
    const currencyMap = { ...this.defaultCurrencyMap, ...customAliases };

    // Currency words/symbols pattern
    const currPattern = '[₹$€]|rs\\.?|rupees?|roopayalu|రూపాయలు|రూపాయి|రూ\\.?|రూ|रुपये|रुपया|रु\\.?|रु|inr|usd|eur';
    const priceKeywords = 'price|rate|cost|ధర|వెల|ఖరీదు|कीमत|दर|मूल्य|vela|dhara';

    // 1. Explicit currency with prefix (e.g., ₹800, రూ. 1,200, Rs. 500, $50)
    const prefixRegex = new RegExp(`(${currPattern})\\s*(\\d+(?:,\\d+)*(?:\\.\\d+)?)`, 'i');
    const prefixMatch = input.match(prefixRegex);
    if (prefixMatch && prefixMatch[2]) {
      const rawNumber = prefixMatch[2].replace(/,/g, '');
      const amount = parseFloat(rawNumber);
      if (!isNaN(amount)) {
        const symbol = prefixMatch[1]?.toLowerCase();
        const currency = symbol && currencyMap[symbol] ? currencyMap[symbol] : 'INR';
        return { amount, currency };
      }
    }

    // 2. Explicit currency with suffix (e.g., 800 రూపాయలు, 1,200 rs, 500 rupees, 1,200/-)
    const suffixRegex = new RegExp(`(\\d+(?:,\\d+)*(?:\\.\\d+)?)\\s*(?:/[-–])?\\s*(${currPattern})`, 'i');
    const suffixMatch = input.match(suffixRegex);
    if (suffixMatch && suffixMatch[1]) {
      const rawNumber = suffixMatch[1].replace(/,/g, '');
      const amount = parseFloat(rawNumber);
      if (!isNaN(amount)) {
        const symbol = suffixMatch[2]?.toLowerCase();
        const currency = symbol && currencyMap[symbol] ? currencyMap[symbol] : 'INR';
        return { amount, currency };
      }
    }

    // 3. Price keyword preceding number (e.g., ధర 800, rate is 1200, వెల 1,200, price 950)
    const keywordRegex = new RegExp(`(?:${priceKeywords})\\s*(?:is|:|to|=|గారు)?\\s*(\\d+(?:,\\d+)*(?:\\.\\d+)?)`, 'i');
    const kwMatch = input.match(keywordRegex);
    if (kwMatch && kwMatch[1]) {
      const rawNumber = kwMatch[1].replace(/,/g, '');
      const amount = parseFloat(rawNumber);
      if (!isNaN(amount)) {
        return { amount, currency: 'INR' };
      }
    }

    // 4. Standalone numeric string (e.g. user answered "800" or "1200" directly to a price question)
    const standaloneMatch = input.trim().match(/^(\d+(?:,\d+)*(?:\.\d+)?)$/);
    if (standaloneMatch && standaloneMatch[1]) {
      const rawNumber = standaloneMatch[1].replace(/,/g, '');
      const amount = parseFloat(rawNumber);
      if (!isNaN(amount)) {
        return { amount, currency: 'INR' };
      }
    }

    return null;
  }

  /**
   * Normalize time units like "3 rojulu", "3 days", "3 din" -> "3 days"
   */
  public static normalizeTimeUnit(
    input: string,
    customUnits?: Record<string, string>
  ): string {
    const units = { ...this.defaultTimeUnits, ...customUnits };
    const trimmed = input.trim().toLowerCase();

    const match = trimmed.match(/^(\d+)\s*([a-zA-Z\u0C00-\u0C7F\u0900-\u097F]+)$/);
    if (!match) return input;

    const count = parseInt(match[1], 10);
    const rawUnit = match[2].toLowerCase();

    const canonicalUnit = units[rawUnit];
    if (!canonicalUnit) return input;

    const isPlural = count > 1;
    let finalUnit = canonicalUnit;
    if (isPlural && !finalUnit.endsWith('s')) {
      finalUnit += 's';
    } else if (!isPlural && finalUnit.endsWith('s')) {
      finalUnit = finalUnit.slice(0, -1);
    }

    return `${count} ${finalUnit}`;
  }
}
