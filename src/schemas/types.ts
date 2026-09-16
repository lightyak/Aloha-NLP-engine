export type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export type ValidationRuleType =
  | 'required'
  | 'type'
  | 'min'
  | 'max'
  | 'range'
  | 'regex'
  | 'enum'
  | 'dependency';

export interface BaseValidationRule {
  type: ValidationRuleType;
  message?: string;
}

export interface RequiredRule extends BaseValidationRule {
  type: 'required';
}

export interface TypeRule extends BaseValidationRule {
  type: 'type';
  expectedType: FieldType;
}

export interface MinRule extends BaseValidationRule {
  type: 'min';
  value: number;
}

export interface MaxRule extends BaseValidationRule {
  type: 'max';
  value: number;
}

export interface RangeRule extends BaseValidationRule {
  type: 'range';
  min: number;
  max: number;
}

export interface RegexRule extends BaseValidationRule {
  type: 'regex';
  pattern: string;
  flags?: string;
}

export interface EnumRule extends BaseValidationRule {
  type: 'enum';
  allowedValues: (string | number)[];
}

export interface DependencyRule extends BaseValidationRule {
  type: 'dependency';
  dependsOnField: string;
  conditionValue?: unknown;
}

export type ValidationRule =
  | RequiredRule
  | TypeRule
  | MinRule
  | MaxRule
  | RangeRule
  | RegexRule
  | EnumRule
  | DependencyRule;

export interface NormalizationConfig {
  trim?: boolean;
  lowercase?: boolean;
  unitType?: 'time' | 'dimension' | 'weight' | 'currency';
  aliases?: Record<string, string>;
  itemType?: FieldType; // For array elements
}

export interface FieldDefinition {
  name: string;
  type: FieldType;
  required?: boolean;
  description?: string;
  example?: unknown;
  aliases?: string[];
  rules?: ValidationRule[];
  normalization?: NormalizationConfig;
  categorySpecific?: string[]; // IDs of categories where this field is specific
}

export interface SchemaConfig {
  version: string;
  schemaName: string;
  description?: string;
  fields: FieldDefinition[];
}

export interface ValidationErrorItem {
  field: string;
  rule: ValidationRuleType;
  message: string;
  receivedValue?: unknown;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrorItem[];
}
