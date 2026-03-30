/**
 * Component Validation and Runtime Type Checking
 * Comprehensive prop validation and runtime type checking for React components.
 */

import React from 'react';

export type ValidationRuleType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'function'
  | 'element'
  | 'node';

export interface ValidationRule {
  type: ValidationRuleType;
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: readonly unknown[];
  custom?: (value: unknown) => boolean | string;
  message?: string;
}

export interface PropValidation {
  [key: string]: ValidationRule;
}

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  prop: string;
  value: unknown;
  message: string;
}

export interface ValidationError extends ValidationIssue {
  rule: ValidationRule;
  severity: ValidationSeverity;
}

export interface ValidationWarning extends ValidationIssue {
  suggestion: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ComponentValidationConfig {
  enableRuntimeValidation: boolean;
  enablePropValidation: boolean;
  enableTypeChecking: boolean;
  enableDeprecationWarnings: boolean;
  enablePerformanceWarnings: boolean;
  strictMode: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

export interface DeprecatedProp {
  prop: string;
  replacement?: string;
  version: string;
  message: string;
  severity: 'warning' | 'error';
}

export interface PerformanceWarning {
  prop: string;
  issue: string;
  impact: 'low' | 'medium' | 'high';
  suggestion: string;
}

const COMMON_RULE_SET = 'common';

class ComponentValidator {
  private config: ComponentValidationConfig;
  private validationRules = new Map<string, PropValidation>();
  private deprecatedProps = new Map<string, DeprecatedProp[]>();
  private performanceWarnings = new Map<string, PerformanceWarning[]>();
  private validationCache = new Map<string, ValidationResult>();

  constructor(config: Partial<ComponentValidationConfig> = {}) {
    this.config = {
      enableRuntimeValidation: true,
      enablePropValidation: true,
      enableTypeChecking: true,
      enableDeprecationWarnings: true,
      enablePerformanceWarnings: true,
      strictMode: false,
      logLevel: 'warn',
      ...config,
    };

    this.initializeValidator();
  }

  private initializeValidator(): void {
    this.setupDefaultValidationRules();
    this.setupDeprecationWarnings();
    this.setupPerformanceWarnings();
  }

  private setupDefaultValidationRules(): void {
    const commonRules: PropValidation = {
      className: {
        type: 'string',
        pattern: /^[a-zA-Z0-9\s\-_]+$/,
        message: 'className must be a valid CSS class name',
      },
      id: {
        type: 'string',
        pattern: /^[a-zA-Z0-9\-_]+$/,
        message: 'id must be a valid HTML id',
      },
      children: {
        type: 'node',
        message: 'children must be a valid React node',
      },
      onClick: {
        type: 'function',
        message: 'onClick must be a function',
      },
      disabled: {
        type: 'boolean',
        message: 'disabled must be a boolean',
      },
      visible: {
        type: 'boolean',
        message: 'visible must be a boolean',
      },
    };

    this.validationRules.set(COMMON_RULE_SET, commonRules);
  }

  private setupDeprecationWarnings(): void {
    const commonDeprecations: DeprecatedProp[] = [
      {
        prop: 'onChange',
        replacement: 'onValueChange',
        version: '2.0.0',
        message: 'onChange is deprecated, use onValueChange instead',
        severity: 'warning',
      },
      {
        prop: 'onPress',
        replacement: 'onClick',
        version: '2.0.0',
        message: 'onPress is deprecated, use onClick instead',
        severity: 'warning',
      },
    ];

    this.deprecatedProps.set(COMMON_RULE_SET, commonDeprecations);
  }

  private setupPerformanceWarnings(): void {
    const commonWarnings: PerformanceWarning[] = [
      {
        prop: 'style',
        issue: 'Inline styles can cause performance issues',
        impact: 'medium',
        suggestion: 'Use CSS classes or styled-components instead',
      },
      {
        prop: 'onClick',
        issue: 'Inline functions can cause unnecessary re-renders',
        impact: 'high',
        suggestion: 'Use useCallback or move the function outside the component',
      },
      {
        prop: 'children',
        issue: 'Complex children can impact rendering performance',
        impact: 'low',
        suggestion: 'Consider memoizing complex children',
      },
    ];

    this.performanceWarnings.set(COMMON_RULE_SET, commonWarnings);
  }

  registerValidationRules(componentName: string, rules: PropValidation): void {
    this.validationRules.set(componentName, rules);
    this.validationCache.clear();
  }

  registerDeprecatedProps(componentName: string, deprecated: DeprecatedProp[]): void {
    this.deprecatedProps.set(componentName, deprecated);
  }

  registerPerformanceWarnings(componentName: string, warnings: PerformanceWarning[]): void {
    this.performanceWarnings.set(componentName, warnings);
  }

  validateProps(componentName: string, props: Record<string, unknown>): ValidationResult {
    const cacheKey = this.createCacheKey(componentName, props);
    const cachedResult = this.validationCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const rules = this.getMergedRules(componentName);
    const deprecatedProps = this.getMergedDeprecatedProps(componentName);
    const performanceWarnings = this.getMergedPerformanceWarnings(componentName);

    for (const [propName, value] of Object.entries(props)) {
      const rule = rules[propName];

      if (this.config.enablePropValidation && rule) {
        const validation = this.validateProp(propName, value, rule);
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
      }

      if (this.config.enableDeprecationWarnings) {
        const deprecation = deprecatedProps.find((entry) => entry.prop === propName);
        if (deprecation) {
          warnings.push({
            prop: propName,
            value,
            message: deprecation.message,
            suggestion: deprecation.replacement
              ? `Use ${deprecation.replacement} instead`
              : 'Remove this deprecated prop',
          });
        }
      }

      if (this.config.enablePerformanceWarnings) {
        const warning = performanceWarnings.find((entry) => entry.prop === propName);
        if (warning && this.shouldEmitPerformanceWarning(propName, value)) {
          warnings.push({
            prop: propName,
            value,
            message: warning.issue,
            suggestion: warning.suggestion,
          });
        }
      }
    }

    for (const [propName, rule] of Object.entries(rules)) {
      if (rule.required && !(propName in props)) {
        errors.push({
          prop: propName,
          value: undefined,
          rule,
          message: `Required prop '${propName}' is missing`,
          severity: 'error',
        });
      }
    }

    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
    };

    this.validationCache.set(cacheKey, result);
    return result;
  }

  private createCacheKey(componentName: string, props: Record<string, unknown>): string {
    try {
      return `${componentName}:${JSON.stringify(props)}`;
    } catch {
      return `${componentName}:${Object.keys(props).sort().join('|')}`;
    }
  }

  private getMergedRules(componentName: string): PropValidation {
    return {
      ...(this.validationRules.get(COMMON_RULE_SET) ?? {}),
      ...(this.validationRules.get(componentName) ?? {}),
    };
  }

  private getMergedDeprecatedProps(componentName: string): DeprecatedProp[] {
    return [
      ...(this.deprecatedProps.get(COMMON_RULE_SET) ?? []),
      ...(this.deprecatedProps.get(componentName) ?? []),
    ];
  }

  private getMergedPerformanceWarnings(componentName: string): PerformanceWarning[] {
    return [
      ...(this.performanceWarnings.get(COMMON_RULE_SET) ?? []),
      ...(this.performanceWarnings.get(componentName) ?? []),
    ];
  }

  private shouldEmitPerformanceWarning(propName: string, value: unknown): boolean {
    if (propName === 'style') {
      return typeof value === 'object' && value !== null;
    }

    if (propName.startsWith('on')) {
      return typeof value === 'function';
    }

    if (propName === 'children') {
      return Array.isArray(value) && value.length > 10;
    }

    return true;
  }

  private validateProp(propName: string, value: unknown, rule: ValidationRule): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (value === undefined) {
      if (rule.required) {
        errors.push({
          prop: propName,
          value,
          rule,
          message: `Required prop '${propName}' is undefined`,
          severity: 'error',
        });
      }

      return { isValid: errors.length === 0, errors, warnings };
    }

    if (this.config.enableTypeChecking) {
      const typeCheck = this.checkType(value, rule.type);
      if (!typeCheck.isValid) {
        errors.push({
          prop: propName,
          value,
          rule,
          message: typeCheck.message ?? `Prop '${propName}' must be of type ${rule.type}`,
          severity: 'error',
        });
        return { isValid: false, errors, warnings };
      }
    }

    if (rule.type === 'string' && typeof value === 'string') {
      if (rule.min !== undefined && value.length < rule.min) {
        errors.push({
          prop: propName,
          value,
          rule,
          message: `Prop '${propName}' must be at least ${rule.min} characters long`,
          severity: 'error',
        });
      }

      if (rule.max !== undefined && value.length > rule.max) {
        errors.push({
          prop: propName,
          value,
          rule,
          message: `Prop '${propName}' must be no more than ${rule.max} characters long`,
          severity: 'error',
        });
      }

      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push({
          prop: propName,
          value,
          rule,
          message: rule.message ?? `Prop '${propName}' does not match the required pattern`,
          severity: 'error',
        });
      }
    }

    if (rule.type === 'number' && typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push({
          prop: propName,
          value,
          rule,
          message: `Prop '${propName}' must be at least ${rule.min}`,
          severity: 'error',
        });
      }

      if (rule.max !== undefined && value > rule.max) {
        errors.push({
          prop: propName,
          value,
          rule,
          message: `Prop '${propName}' must be no more than ${rule.max}`,
          severity: 'error',
        });
      }
    }

    if (rule.type === 'array' && Array.isArray(value)) {
      if (rule.min !== undefined && value.length < rule.min) {
        errors.push({
          prop: propName,
          value,
          rule,
          message: `Prop '${propName}' must contain at least ${rule.min} items`,
          severity: 'error',
        });
      }

      if (rule.max !== undefined && value.length > rule.max) {
        errors.push({
          prop: propName,
          value,
          rule,
          message: `Prop '${propName}' must contain no more than ${rule.max} items`,
          severity: 'error',
        });
      }
    }

    if (rule.enum && !rule.enum.includes(value)) {
      errors.push({
        prop: propName,
        value,
        rule,
        message: `Prop '${propName}' must be one of: ${rule.enum.join(', ')}`,
        severity: 'error',
      });
    }

    if (rule.custom) {
      const customResult = rule.custom(value);
      if (customResult !== true) {
        errors.push({
          prop: propName,
          value,
          rule,
          message:
            typeof customResult === 'string'
              ? customResult
              : `Prop '${propName}' failed custom validation`,
          severity: 'error',
        });
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private checkType(
    value: unknown,
    expectedType: ValidationRuleType,
  ): { isValid: boolean; message?: string } {
    switch (expectedType) {
      case 'string':
        return { isValid: typeof value === 'string' };
      case 'number':
        return { isValid: typeof value === 'number' && !Number.isNaN(value) };
      case 'boolean':
        return { isValid: typeof value === 'boolean' };
      case 'array':
        return { isValid: Array.isArray(value) };
      case 'object':
        return { isValid: typeof value === 'object' && value !== null && !Array.isArray(value) };
      case 'function':
        return { isValid: typeof value === 'function' };
      case 'element':
        return { isValid: React.isValidElement(value) };
      case 'node':
        return { isValid: this.isReactNode(value) };
      default:
        return { isValid: true };
    }
  }

  private isReactNode(value: unknown): boolean {
    if (value === null || value === undefined || typeof value === 'boolean') {
      return true;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      return true;
    }

    if (React.isValidElement(value)) {
      return true;
    }

    if (Array.isArray(value)) {
      return value.every((item) => this.isReactNode(item));
    }

    return false;
  }

  createValidationHOC<T extends Record<string, unknown>>(
    componentName: string,
    validationRules: PropValidation,
  ) {
    this.registerValidationRules(componentName, validationRules);

    return (WrappedComponent: React.ComponentType<T>) => {
      const ValidatedComponent = (props: T) => {
        if (this.config.enableRuntimeValidation) {
          const validation = this.validateProps(componentName, props);

          if (!validation.isValid && (this.config.logLevel === 'error' || this.config.logLevel === 'warn')) {
            console.error(`Validation errors for ${componentName}:`, validation.errors);
          }

          if (
            validation.warnings.length > 0 &&
            ['warn', 'info', 'debug'].includes(this.config.logLevel)
          ) {
            console.warn(`Validation warnings for ${componentName}:`, validation.warnings);
          }
        }

        return React.createElement(WrappedComponent, props);
      };

      ValidatedComponent.displayName = `Validated(${componentName})`;
      return ValidatedComponent;
    };
  }

  createValidationHook<T extends Record<string, unknown>>(
    componentName: string,
    validationRules: PropValidation,
  ) {
    this.registerValidationRules(componentName, validationRules);

    return (props: T) => {
      const [validation, setValidation] = React.useState<ValidationResult>({
        isValid: true,
        errors: [],
        warnings: [],
      });

      React.useEffect(() => {
        if (this.config.enableRuntimeValidation) {
          setValidation(this.validateProps(componentName, props));
        }
      }, [componentName, props]);

      return validation;
    };
  }

  getValidationStatistics(): {
    totalValidations: number;
    successfulValidations: number;
    failedValidations: number;
    totalErrors: number;
    totalWarnings: number;
    mostCommonErrors: Array<{ error: string; count: number }>;
    mostCommonWarnings: Array<{ warning: string; count: number }>;
  } {
    const allResults = Array.from(this.validationCache.values());
    const allErrors = allResults.flatMap((result) => result.errors);
    const allWarnings = allResults.flatMap((result) => result.warnings);

    const errorCounts = new Map<string, number>();
    for (const error of allErrors) {
      errorCounts.set(error.message, (errorCounts.get(error.message) ?? 0) + 1);
    }

    const warningCounts = new Map<string, number>();
    for (const warning of allWarnings) {
      warningCounts.set(warning.message, (warningCounts.get(warning.message) ?? 0) + 1);
    }

    return {
      totalValidations: allResults.length,
      successfulValidations: allResults.filter((result) => result.isValid).length,
      failedValidations: allResults.filter((result) => !result.isValid).length,
      totalErrors: allErrors.length,
      totalWarnings: allWarnings.length,
      mostCommonErrors: Array.from(errorCounts.entries())
        .map(([error, count]) => ({ error, count }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 10),
      mostCommonWarnings: Array.from(warningCounts.entries())
        .map(([warning, count]) => ({ warning, count }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 10),
    };
  }

  clearCache(): void {
    this.validationCache.clear();
  }

  updateConfig(newConfig: Partial<ComponentValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): ComponentValidationConfig {
    return { ...this.config };
  }

  destroy(): void {
    this.validationRules.clear();
    this.deprecatedProps.clear();
    this.performanceWarnings.clear();
    this.validationCache.clear();
  }
}

export const componentValidator = new ComponentValidator();

export const validateProps = (componentName: string, props: Record<string, unknown>) => {
  return componentValidator.validateProps(componentName, props);
};

export const registerValidationRules = (componentName: string, rules: PropValidation) => {
  componentValidator.registerValidationRules(componentName, rules);
};

export const createValidationHOC = <T extends Record<string, unknown>>(
  componentName: string,
  validationRules: PropValidation,
) => {
  return componentValidator.createValidationHOC<T>(componentName, validationRules);
};

export const createValidationHook = <T extends Record<string, unknown>>(
  componentName: string,
  validationRules: PropValidation,
) => {
  return componentValidator.createValidationHook<T>(componentName, validationRules);
};

export const getValidationStatistics = () => {
  return componentValidator.getValidationStatistics();
};

export default componentValidator;
