// ── Loan Pool Advisor Models ──────────────────────────────────────

export interface ChatSession {
  id: string;
  name: string;
  createdAt: Date;
  messages: ChatMessage[];
  uploadedLoans: LoanRecord[];
  validationResults: LoanValidationResult[];
  poolSummary: PoolSummary | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachments?: FileAttachment[];
  loanResults?: LoanValidationResult[];
  poolSummary?: PoolSummary;
  isStreaming?: boolean;
}

export interface FileAttachment {
  name: string;
  size: number;
  type: 'csv' | 'xlsx' | 'json' | 'unknown';
  status: 'uploading' | 'parsed' | 'error';
  loanCount?: number;
  errorMessage?: string;
}

/** Required fields for every loan record parsed from user uploads. */
export const REQUIRED_LOAN_FIELDS = [
  'loanNumber',
  'interestRate',
  'currentInvestorBalance',
  'propertyType',
  'upb',
] as const;

export interface LoanRecord {
  loanNumber: string;
  poolNumber: string;
  mbsPoolPrefix: string;
  interestRate: number;
  couponRate: number;
  netYield: number;
  loanAgeMonths: number;
  loanStatusCode: string;
  rateTypeCode: string;
  currentInvestorBalance: number;
  propertyType: string;
  specialCategory: string;
  upb: number;
  [key: string]: unknown;
}

export interface EligibilityRule {
  ruleId: string;
  ruleName: string;
  category: 'rate' | 'balance' | 'property' | 'age' | 'status' | 'rate-type' | 'pool' | 'general';
  description: string;
  guideReference: string;
}

export interface RuleViolation {
  rule: EligibilityRule;
  actualValue: string;
  expectedValue: string;
  severity: 'error' | 'warning' | 'info';
  explanation: string;
  recommendedAction: string;
}

export interface LoanValidationResult {
  loanNumber: string;
  poolNumber: string;
  eligible: boolean;
  violations: RuleViolation[];
  score: number; // 0–100 eligibility score
}

export interface PoolSummary {
  totalLoans: number;
  eligibleLoans: number;
  ineligibleLoans: number;
  warningLoans: number;
  totalUPB: number;
  eligibleUPB: number;
  weightedAvgRate: number;
  weightedAvgCoupon: number;
  weightedAvgAge: number;
  topViolations: { ruleName: string; count: number }[];
}

export interface PoolLogicApiRequest {
  action: 'validate' | 'build-pool' | 'filter' | 'explain-rule';
  loans?: LoanRecord[];
  filters?: LoanFilter;
  ruleId?: string;
}

// ── Eligibility API Types (POST /eligibility/evaluate) ──────────────

/** Payload sent to POST /eligibility/evaluate */
export interface EligibilityEvaluateRequest {
  loans: LoanRecord[];
}

/** A single failed rule attached to an ineligible loan. */
export interface FailedRule {
  ruleId: string;
  ruleName: string;
  category: string;
  actualValue: string;
  expectedValue: string;
  severity: 'error' | 'warning';
  explanation: string;
  recommendedAction: string;
  guideReference: string;
}

/** An ineligible loan returned from the API. */
export interface IneligibleLoanResult {
  loanNumber: string;
  poolNumber: string;
  score: number;
  failedRules: FailedRule[];
}

/** Rule-failure summary entry. */
export interface RuleFailureSummary {
  ruleId: string;
  ruleName: string;
  count: number;
}

/** Response from POST /eligibility/evaluate */
export interface EligibilityEvaluateResponse {
  eligibleLoans: LoanRecord[];
  ineligibleLoans: IneligibleLoanResult[];
  summary: {
    totalLoans: number;
    eligibleCount: number;
    ineligibleCount: number;
    totalUPB: number;
    eligibleUPB: number;
    weightedAvgRate: number;
    weightedAvgCoupon: number;
    weightedAvgAge: number;
    ruleFailures: RuleFailureSummary[];
  };
}

// ── Pooling API Types (POST /pooling/build) ────────────────────────

/** Payload sent to POST /pooling/build */
export interface PoolingBuildRequest {
  requestId: string;
  targetCoupon: number;
}

/** An invalid loan returned by the pooling API. */
export interface PoolingInvalidLoan {
  loanNumber: string;
  poolNumber: string;
  failedRules: FailedRule[];
}

/** Response from POST /pooling/build */
export interface PoolingBuildResponse {
  poolType: string;
  notionalAmount: number;
  status: 'CREATED' | 'PARTIAL' | 'FAILED';
  invalidLoans: PoolingInvalidLoan[];
}

export interface LoanFilter {
  poolNumber?: string;
  mbsPoolPrefix?: string;
  rateTypeCode?: string;
  loanStatusCode?: string;
  propertyTypes?: string[];
  specialCategories?: string[];
  minInterestRate?: number;
  maxInterestRate?: number;
  minCouponRate?: number;
  maxCouponRate?: number;
  minUPB?: number;
  maxUPB?: number;
  minLoanAge?: number;
  maxLoanAge?: number;
}

export type AgentState = 'idle' | 'parsing' | 'validating' | 'building-pool' | 'filtering' | 'complete' | 'error';

export interface AgentStatus {
  state: AgentState;
  progress: number; // 0–100
  currentStep: string;
}
