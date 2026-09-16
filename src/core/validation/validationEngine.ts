import type {
  FieldDefinition,
  ValidationRule,
  ValidationResult,
  ValidationErrorItem,
  FieldType,
} from '../../schemas/types.js';

export class ValidationEngine {
  /**
   * Validate a single value against a field definition and record context
   */
  public static validateFieldValue(
    field: FieldDefinition,
    value: unknown,
    record: Record<string, unknown>
  ): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];
    const rules: ValidationRule[] = [...(field.rules || [])];

    // If field is marked required in definition but doesn't have an explicit 'required' rule, add it
    if (field.required && !rules.some((r) => r.type === 'required')) {
      rules.unshift({ type: 'required' });
    }

    // Always enforce the field's base type if value is present
    if (!rules.some((r) => r.type === 'type')) {
      rules.push({ type: 'type', expectedType: field.type });
    }

    for (const rule of rules) {
      const error = this.executeRule(rule, field.name, value, record);
      if (error) {
        errors.push(error);
      }
    }

    return errors;
  }

  /**
   * Validate an entire record against a list of field definitions
   */
  public static validateRecord(
    fields: FieldDefinition[],
    record: Record<string, unknown>
  ): ValidationResult {
    const allErrors: ValidationErrorItem[] = [];

    for (const field of fields) {
      const value = record[field.name];
      const fieldErrors = this.validateFieldValue(field, value, record);
      allErrors.push(...fieldErrors);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
    };
  }

  private static executeRule(
    rule: ValidationRule,
    fieldName: string,
    value: unknown,
    record: Record<string, unknown>
  ): ValidationErrorItem | null {
    const isPresent = value !== undefined && value !== null && value !== '';

    switch (rule.type) {
      case 'required': {
        if (!isPresent || (Array.isArray(value) && value.length === 0)) {
          return {
            field: fieldName,
            rule: 'required',
            message: rule.message || `Field '${fieldName}' is required.`,
            receivedValue: value,
          };
        }
        return null;
      }

      case 'type': {
        if (!isPresent) return null; // Handled by required rule if needed
        if (!this.checkType(value, rule.expectedType)) {
          return {
            field: fieldName,
            rule: 'type',
            message:
              rule.message ||
              `Field '${fieldName}' must be of type '${rule.expectedType}', received '${typeof value}'.`,
            receivedValue: value,
          };
        }
        return null;
      }

      case 'min': {
        if (!isPresent) return null;
        if (typeof value === 'number' && value < rule.value) {
          return {
            field: fieldName,
            rule: 'min',
            message: rule.message || `Field '${fieldName}' must be at least ${rule.value}.`,
            receivedValue: value,
          };
        }
        if ((typeof value === 'string' || Array.isArray(value)) && value.length < rule.value) {
          return {
            field: fieldName,
            rule: 'min',
            message: rule.message || `Field '${fieldName}' length must be at least ${rule.value}.`,
            receivedValue: value,
          };
        }
        return null;
      }

      case 'max': {
        if (!isPresent) return null;
        if (typeof value === 'number' && value > rule.value) {
          return {
            field: fieldName,
            rule: 'max',
            message: rule.message || `Field '${fieldName}' must be at most ${rule.value}.`,
            receivedValue: value,
          };
        }
        if ((typeof value === 'string' || Array.isArray(value)) && value.length > rule.value) {
          return {
            field: fieldName,
            rule: 'max',
            message: rule.message || `Field '${fieldName}' length must be at most ${rule.value}.`,
            receivedValue: value,
          };
        }
        return null;
      }

      case 'range': {
        if (!isPresent) return null;
        if (typeof value === 'number' && (value < rule.min || value > rule.max)) {
          return {
            field: fieldName,
            rule: 'range',
            message:
              rule.message ||
              `Field '${fieldName}' must be between ${rule.min} and ${rule.max}.`,
            receivedValue: value,
          };
        }
        return null;
      }

      case 'regex': {
        if (!isPresent) return null;
        if (typeof value === 'string') {
          const reg = new RegExp(rule.pattern, rule.flags);
          if (!reg.test(value)) {
            return {
              field: fieldName,
              rule: 'regex',
              message: rule.message || `Field '${fieldName}' does not match required format.`,
              receivedValue: value,
            };
          }
        }
        return null;
      }

      case 'enum': {
        if (!isPresent) return null;
        if (!rule.allowedValues.includes(value as string | number)) {
          return {
            field: fieldName,
            rule: 'enum',
            message:
              rule.message ||
              `Field '${fieldName}' must be one of: [${rule.allowedValues.join(', ')}].`,
            receivedValue: value,
          };
        }
        return null;
      }

      case 'dependency': {
        const dependentValue = record[rule.dependsOnField];
        const dependencyTriggered =
          rule.conditionValue !== undefined
            ? dependentValue === rule.conditionValue
            : dependentValue !== undefined && dependentValue !== null && dependentValue !== '';

        if (dependencyTriggered && !isPresent) {
          return {
            field: fieldName,
            rule: 'dependency',
            message:
              rule.message ||
              `Field '${fieldName}' is required when '${rule.dependsOnField}' is set.`,
            receivedValue: value,
          };
        }
        return null;
      }

      default:
        return null;
    }
  }

  private static checkType(value: unknown, expectedType: FieldType): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return false;
    }
  }
}
