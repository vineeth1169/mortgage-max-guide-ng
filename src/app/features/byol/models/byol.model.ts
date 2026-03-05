/**
 * BYOL (Bring Your Own Loans) Module - TypeScript Types
 * Shared type definitions for loan processing and eligibility evaluation
 */

/**
 * Raw loan row parsed from an uploaded file
 */
export interface BYOLLoanRow {
  _rowIndex: number;
  loanNumber: string;
  poolNumber: string;
  interestRate: number | null;
  couponRate: number | null;
  netYield: number | null;
  loanAgeMonths: number | null;
  loanStatusCode: string;
  rateTypeCode: string;
  currentInvestorBalance: number | null;
  propertyType: string;
  specialCategory: string;
  upb: number | null;
}

/**
 * Validation issue on a single field
 */
export interface FieldValidation {
  field: string;
  message: string;
}

/**
 * A loan row with validation metadata attached
 */
export interface ValidatedLoanRow {
  row: BYOLLoanRow;
  errors: FieldValidation[];
  isValid: boolean;
}

/**
 * Eligibility rule failure from backend
 */
export interface RuleFailure {
  ruleId: string;
  ruleName: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Single loan eligibility result from POST /eligibility/evaluate
 */
export interface EligibilityResult {
  loanNumber: string;
  eligible: boolean;
  failures: RuleFailure[];
}

/**
 * Full response from POST /eligibility/evaluate
 */
export interface EligibilityResponse {
  results: EligibilityResult[];
  summary: {
    total: number;
    eligible: number;
    ineligible: number;
  };
}

/**
 * BYOL workflow step
 */
export type BYOLStep = 'upload' | 'preview' | 'results';

/**
 * Notification for user feedback
 */
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}
