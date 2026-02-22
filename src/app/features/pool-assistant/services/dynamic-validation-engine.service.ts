import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { LoanRecord, RuleViolation } from '../models/pool-logic.model';

/**
 * Rule definition from the API
 */
export interface DynamicRule {
  id: string;
  name: string;
  category: string;
  description: string;
  requirement: string;
  field: string;
  operator: string;
  value?: number | string;
  values?: string[];
  minValue?: number;
  maxValue?: number;
  compareField?: string;
  minInclusive?: boolean;
  maxInclusive?: boolean;
  severity: 'error' | 'warning' | 'info';
  guideReference: string;
  explanation: string;
  remediation: string;
  enabled: boolean;
}

/**
 * Dynamic Validation Engine
 * 
 * Fetches rules from the API and evaluates loans against them dynamically.
 * This enables runtime rule changes without code deployment.
 */
@Injectable({ providedIn: 'root' })
export class DynamicValidationEngine {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.rulesApiUrl || 'http://localhost:3001/api';

  // ── State ─────────────────────────────────────────────────────────
  
  readonly rules = signal<DynamicRule[]>([]);
  readonly isLoaded = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly useApiRules = signal<boolean>(true);

  readonly enabledRules = computed(() => this.rules().filter(r => r.enabled));
  readonly ruleCount = computed(() => this.enabledRules().length);

  // ── Loading ───────────────────────────────────────────────────────

  /**
   * Load rules from the API.
   * Returns true if successful, false if API unavailable.
   */
  async loadRules(): Promise<boolean> {
    if (!this.useApiRules()) return false;

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.get<{ success: boolean; data: DynamicRule[] }>(`${this.baseUrl}/rules?enabled=true`)
      );

      if (response.success && Array.isArray(response.data)) {
        this.rules.set(response.data);
        this.isLoaded.set(true);
        return true;
      }
      throw new Error('Invalid API response');
    } catch (err: any) {
      const message = err.error?.error || err.message || 'Rules API unavailable';
      this.error.set(message);
      console.warn('DynamicValidationEngine: Falling back to local rules -', message);
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Check if API is available.
   */
  async checkApiHealth(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ status: string }>(`${this.baseUrl}/health`, { 
          // Short timeout for health check
        })
      );
      return response.status === 'ok';
    } catch {
      return false;
    }
  }

  // ── Validation ────────────────────────────────────────────────────

  /**
   * Validate a loan against all enabled rules.
   * Returns array of violations.
   */
  validateLoan(loan: LoanRecord): RuleViolation[] {
    const violations: RuleViolation[] = [];

    for (const rule of this.enabledRules()) {
      const violation = this.evaluateRule(loan, rule);
      if (violation) {
        violations.push(violation);
      }
    }

    return violations;
  }

  /**
   * Evaluate a single rule against a loan.
   * Returns a violation if the rule is not satisfied, null otherwise.
   */
  private evaluateRule(loan: LoanRecord, rule: DynamicRule): RuleViolation | null {
    const fieldValue = this.getFieldValue(loan, rule.field);
    
    // Skip if field doesn't exist (handled by required field validation)
    if (fieldValue === undefined || fieldValue === null) {
      if (rule.operator === 'required') {
        return this.createViolation(rule, loan, fieldValue, 'Missing required field');
      }
      return null;
    }

    let isValid = true;
    let actualValue = String(fieldValue);
    let expectedValue = '';

    switch (rule.operator) {
      case 'gt':
        isValid = Number(fieldValue) > Number(rule.value);
        expectedValue = `> ${rule.value}`;
        break;

      case 'gte':
        if (rule.compareField) {
          const compareValue = this.getFieldValue(loan, rule.compareField);
          isValid = Number(fieldValue) >= Number(compareValue);
          expectedValue = `≥ ${rule.compareField} (${compareValue})`;
        } else {
          isValid = Number(fieldValue) >= Number(rule.value);
          expectedValue = `≥ ${rule.value}`;
        }
        break;

      case 'lt':
        isValid = Number(fieldValue) < Number(rule.value);
        expectedValue = `< ${rule.value}`;
        break;

      case 'lte':
        if (rule.compareField) {
          const compareValue = this.getFieldValue(loan, rule.compareField);
          isValid = Number(fieldValue) <= Number(compareValue);
          expectedValue = `≤ ${rule.compareField} (${compareValue})`;
        } else {
          isValid = Number(fieldValue) <= Number(rule.value);
          expectedValue = `≤ ${rule.value}`;
        }
        break;

      case 'eq':
        isValid = fieldValue === rule.value || String(fieldValue) === String(rule.value);
        expectedValue = `= ${rule.value}`;
        break;

      case 'neq':
        isValid = fieldValue !== rule.value && String(fieldValue) !== String(rule.value);
        expectedValue = `≠ ${rule.value}`;
        break;

      case 'in':
        isValid = rule.values?.includes(String(fieldValue).toUpperCase()) ?? false;
        expectedValue = `one of [${rule.values?.join(', ')}]`;
        break;

      case 'notin':
        isValid = !(rule.values?.includes(String(fieldValue).toUpperCase()) ?? true);
        expectedValue = `not in [${rule.values?.join(', ')}]`;
        break;

      case 'range':
        const numValue = Number(fieldValue);
        const min = rule.minValue ?? 0;
        const max = rule.maxValue ?? Infinity;
        const minOk = rule.minInclusive !== false ? numValue >= min : numValue > min;
        const maxOk = rule.maxInclusive !== false ? numValue <= max : numValue < max;
        isValid = minOk && maxOk;
        expectedValue = `${rule.minInclusive !== false ? '[' : '('}${min}, ${max}${rule.maxInclusive !== false ? ']' : ')'}`;
        break;

      case 'range_field':
        const val = Number(fieldValue);
        const compareVal = this.getFieldValue(loan, rule.compareField || '');
        isValid = val >= (rule.minValue ?? 0) && val <= Number(compareVal);
        expectedValue = `between ${rule.minValue ?? 0} and ${rule.compareField} (${compareVal})`;
        break;

      case 'required':
        isValid = fieldValue !== '' && fieldValue !== null && fieldValue !== undefined;
        expectedValue = 'non-empty value';
        break;

      case 'regex':
        try {
          const regex = new RegExp(String(rule.value));
          isValid = regex.test(String(fieldValue));
          expectedValue = `matches ${rule.value}`;
        } catch {
          isValid = true; // Invalid regex, skip
        }
        break;

      default:
        // Unknown operator, skip
        return null;
    }

    if (!isValid) {
      return this.createViolation(rule, loan, actualValue, expectedValue);
    }

    return null;
  }

  /**
   * Get a field value from a loan record.
   * Handles nested fields and type conversion.
   */
  private getFieldValue(loan: LoanRecord, field: string): any {
    // Direct property access
    if (field in loan) {
      return (loan as any)[field];
    }

    // Try camelCase variations
    const camelField = field.charAt(0).toLowerCase() + field.slice(1);
    if (camelField in loan) {
      return (loan as any)[camelField];
    }

    return undefined;
  }

  /**
   * Create a rule violation object.
   */
  private createViolation(
    rule: DynamicRule,
    loan: LoanRecord,
    actualValue: any,
    expectedValue: string
  ): RuleViolation {
    return {
      rule: {
        ruleId: rule.id,
        ruleName: rule.name,
        category: this.mapCategory(rule.category),
        description: rule.description,
        guideReference: rule.guideReference,
      },
      actualValue: String(actualValue),
      expectedValue,
      severity: rule.severity === 'info' ? 'warning' : rule.severity,
      explanation: rule.explanation || rule.description,
      recommendedAction: rule.remediation || 'Review and correct the value.',
    };
  }

  /**
   * Map API category to local category type.
   */
  private mapCategory(category: string): 'rate' | 'balance' | 'property' | 'age' | 'status' | 'rate-type' | 'pool' | 'general' {
    const categoryMap: Record<string, any> = {
      'rate': 'rate',
      'balance': 'balance',
      'property': 'property',
      'age': 'age',
      'status': 'status',
      'pool': 'pool',
      'custom': 'general',
    };
    return categoryMap[category] || 'general';
  }
}
