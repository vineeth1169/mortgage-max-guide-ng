/**
 * Rule Model - Defines the structure of eligibility rules
 */

export interface Rule {
  id: string;
  name: string;
  category: RuleCategory;
  description: string;
  requirement: string;
  field: string;
  operator: RuleOperator;
  value?: number | string;
  values?: string[];
  minValue?: number;
  maxValue?: number;
  compareField?: string;
  minInclusive?: boolean;
  maxInclusive?: boolean;
  severity: RuleSeverity;
  guideReference: string;
  explanation: string;
  remediation: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RuleCategory = 'rate' | 'balance' | 'property' | 'status' | 'age' | 'pool' | 'custom';

export type RuleOperator = 
  | 'gt'        // Greater than
  | 'gte'       // Greater than or equal
  | 'lt'        // Less than
  | 'lte'       // Less than or equal
  | 'eq'        // Equal
  | 'neq'       // Not equal
  | 'in'        // In list
  | 'notin'     // Not in list
  | 'range'     // Between min and max
  | 'range_field' // Between 0 and another field
  | 'required'  // Must have value
  | 'regex';    // Matches pattern

export type RuleSeverity = 'error' | 'warning' | 'info';

export interface RuleFormData {
  id?: string;
  name: string;
  category: RuleCategory;
  description: string;
  requirement: string;
  field: string;
  operator: RuleOperator;
  value?: number | string;
  values?: string[];
  minValue?: number;
  maxValue?: number;
  compareField?: string;
  severity: RuleSeverity;
  guideReference: string;
  explanation: string;
  remediation: string;
  enabled: boolean;
}

export interface RulesApiResponse {
  success: boolean;
  data: Rule | Rule[];
  metadata?: {
    version: string;
    lastUpdated: string;
    totalRules: number;
  };
  message?: string;
  error?: string;
}

export interface CategoryInfo {
  name: RuleCategory;
  count: number;
}

export const CATEGORY_LABELS: Record<RuleCategory, string> = {
  rate: 'Interest Rate',
  balance: 'Balance',
  property: 'Property',
  status: 'Loan Status',
  age: 'Loan Age',
  pool: 'Pool Assignment',
  custom: 'Custom'
};

export const OPERATOR_LABELS: Record<RuleOperator, string> = {
  gt: 'Greater than',
  gte: 'Greater than or equal',
  lt: 'Less than',
  lte: 'Less than or equal',
  eq: 'Equal to',
  neq: 'Not equal to',
  in: 'In list',
  notin: 'Not in list',
  range: 'Between range',
  range_field: 'Range with field',
  required: 'Required (not empty)',
  regex: 'Matches pattern'
};

export const SEVERITY_CONFIG: Record<RuleSeverity, { label: string; color: string; bgColor: string }> = {
  error: { label: 'Error', color: 'text-red-700', bgColor: 'bg-red-100' },
  warning: { label: 'Warning', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  info: { label: 'Info', color: 'text-blue-700', bgColor: 'bg-blue-100' }
};

export const LOAN_FIELDS = [
  { value: 'interestRate', label: 'Interest Rate' },
  { value: 'couponRate', label: 'Coupon Rate' },
  { value: 'netYield', label: 'Net Yield' },
  { value: 'upb', label: 'Unpaid Principal Balance (UPB)' },
  { value: 'currentInvestorBalance', label: 'Investor Balance' },
  { value: 'propertyType', label: 'Property Type' },
  { value: 'loanStatusCode', label: 'Loan Status Code' },
  { value: 'loanAgeMonths', label: 'Loan Age (Months)' },
  { value: 'poolNumber', label: 'Pool Number' },
  { value: 'mbsPoolPrefix', label: 'MBS Pool Prefix' },
  { value: 'loanNumber', label: 'Loan Number' },
  { value: 'rateTypeCode', label: 'Rate Type Code' },
  { value: 'specialCategory', label: 'Special Category' }
];
