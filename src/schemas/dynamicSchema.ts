import type {
  FieldDefinition,
  SchemaConfig,
  ValidationResult,
} from './types.js';
import { ValidationEngine } from '../core/validation/validationEngine.js';
import { NormalizationEngine } from '../core/normalization/normalizationEngine.js';
import defaultSchemaJson from './defaultSchema.json' with { type: 'json' };

export class DynamicSchemaRegistry {
  private fields: Map<string, FieldDefinition> = new Map();
  private schemaVersion: string = '1.0.0';
  private schemaName: string = 'default';

  constructor(initialSchema?: SchemaConfig) {
    const schemaToLoad = initialSchema || (defaultSchemaJson as unknown as SchemaConfig);
    this.loadSchema(schemaToLoad);
  }

  public loadSchema(config: SchemaConfig): void {
    this.schemaVersion = config.version;
    this.schemaName = config.schemaName;
    this.fields.clear();

    for (const field of config.fields) {
      this.fields.set(field.name, field);
    }
  }

  public registerField(field: FieldDefinition): void {
    this.fields.set(field.name, field);
  }

  public removeField(fieldName: string): boolean {
    return this.fields.delete(fieldName);
  }

  public getField(fieldName: string): FieldDefinition | undefined {
    return this.fields.get(fieldName);
  }

  public getFields(): FieldDefinition[] {
    return Array.from(this.fields.values());
  }

  /**
   * Determine required fields dynamically based on category and field configuration
   */
  public getRequiredFields(category?: string): FieldDefinition[] {
    return this.getFields().filter((field) => {
      if (!field.required) return false;
      if (field.categorySpecific && field.categorySpecific.length > 0) {
        if (!category) return false;
        return field.categorySpecific.includes(category);
      }
      return true;
    });
  }

  /**
   * Compare a product draft against required fields and return missing field names
   */
  public getMissingFields(
    draft: Record<string, unknown>,
    category?: string
  ): string[] {
    const requiredFields = this.getRequiredFields(category || (draft.category as string));
    const missing: string[] = [];

    for (const field of requiredFields) {
      const value = draft[field.name];
      if (value === undefined || value === null || value === '') {
        missing.push(field.name);
      } else if (Array.isArray(value) && value.length === 0) {
        missing.push(field.name);
      }
    }

    return missing;
  }

  /**
   * Validate an entire product draft against current dynamic fields
   */
  public validateDraft(draft: Record<string, unknown>): ValidationResult {
    return ValidationEngine.validateRecord(this.getFields(), draft);
  }

  /**
   * Normalize an entire product draft using configured field normalizers
   */
  public normalizeDraft(draft: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = { ...draft };

    for (const field of this.getFields()) {
      if (normalized[field.name] !== undefined) {
        normalized[field.name] = NormalizationEngine.normalizeFieldValue(
          field,
          normalized[field.name]
        );
      }
    }

    return normalized;
  }

  /**
   * Generates a descriptive string for dynamic LLM prompt construction
   */
  public toPromptDescription(): string {
    return this.getFields()
      .map((f) => {
        const reqStr = f.required ? 'REQUIRED' : 'OPTIONAL';
        const aliasesStr = f.aliases && f.aliases.length > 0 ? ` (Aliases: ${f.aliases.join(', ')})` : '';
        return `- ${f.name} [${f.type}] (${reqStr}): ${f.description || ''}${aliasesStr}`;
      })
      .join('\n');
  }

  public getVersion(): string {
    return this.schemaVersion;
  }

  public getName(): string {
    return this.schemaName;
  }
}

export const defaultSchemaRegistry = new DynamicSchemaRegistry();
