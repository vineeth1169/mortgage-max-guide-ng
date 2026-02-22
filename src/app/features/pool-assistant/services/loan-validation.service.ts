import { Injectable } from '@angular/core';
import {
  LoanRecord,
  LoanValidationResult,
  RuleViolation,
  EligibilityRule,
  PoolSummary,
  LoanFilter,
  REQUIRED_LOAN_FIELDS,
} from '../models/pool-logic.model';

/** Returned when required fields are missing from the uploaded data. */
export interface ParseError {
  type: 'missing-fields';
  missingFields: string[];
  message: string;
}

export type ParseResult =
  | { ok: true; loans: LoanRecord[] }
  | { ok: false; error: ParseError };

@Injectable({ providedIn: 'root' })
export class LoanValidationService {

  // ── PoolLogic Eligibility Rules ────────────────────────────────────
  private readonly eligibilityRules: EligibilityRule[] = [
    {
      ruleId: 'RATE-001',
      ruleName: 'Positive Interest Rate',
      category: 'general',
      description: 'Interest rate must be greater than 0% and not exceed 12%.',
      guideReference: 'Guide Section 2201.3',
    },
    {
      ruleId: 'RATE-002',
      ruleName: 'Coupon Rate Consistency',
      category: 'general',
      description: 'Coupon rate must not exceed the interest rate.',
      guideReference: 'Guide Section 6302.1',
    },
    {
      ruleId: 'RATE-003',
      ruleName: 'Net Yield Consistency',
      category: 'general',
      description: 'Net yield must be positive and must not exceed the coupon rate.',
      guideReference: 'Guide Section 6302.2',
    },
    {
      ruleId: 'BAL-001',
      ruleName: 'Positive UPB',
      category: 'balance',
      description: 'Unpaid principal balance (UPB) must be greater than zero.',
      guideReference: 'Guide Section 2101.1',
    },
    {
      ruleId: 'BAL-002',
      ruleName: 'Investor Balance vs UPB',
      category: 'balance',
      description: 'Current investor balance must not exceed the UPB.',
      guideReference: 'Guide Section 6304.1',
    },
    {
      ruleId: 'BAL-003',
      ruleName: 'Conforming Loan Limit',
      category: 'balance',
      description: 'UPB must not exceed the conforming loan limit of $766,550 (2025).',
      guideReference: 'Guide Section 2101.1',
    },
    {
      ruleId: 'PROP-001',
      ruleName: 'Eligible Property Types',
      category: 'property',
      description: 'Property must be of an eligible type: SF, CO, CP, PU, MH, or 2-4.',
      guideReference: 'Guide Section 4200',
    },
    {
      ruleId: 'AGE-001',
      ruleName: 'Maximum Loan Age',
      category: 'general',
      description: 'Loan age must not exceed 360 months (30 years).',
      guideReference: 'Guide Section 2201.1',
    },
    {
      ruleId: 'STATUS-001',
      ruleName: 'Active Loan Status',
      category: 'general',
      description: 'Loan status code must indicate an active, performing loan (codes: A, C).',
      guideReference: 'Guide Section 8100',
    },
    {
      ruleId: 'RTYPE-001',
      ruleName: 'Eligible Rate Type',
      category: 'general',
      description: 'Rate type code must be FRM (fixed) or ARM (adjustable).',
      guideReference: 'Guide Section 3100',
    },
    {
      ruleId: 'POOL-001',
      ruleName: 'Pool Number Required',
      category: 'general',
      description: 'A valid pool number must be assigned to the loan.',
      guideReference: 'Guide Section 6301.1',
    },
  ];

  // ── Validate Single Loan ──────────────────────────────────────────
  validateLoan(loan: LoanRecord): LoanValidationResult {
    const violations: RuleViolation[] = [];

    // RATE-001: Interest rate range
    if (loan.interestRate <= 0 || loan.interestRate > 12) {
      violations.push(this.createViolation('RATE-001', `${loan.interestRate}%`, '0% < rate ≤ 12%', 'error',
        `The interest rate of ${loan.interestRate}% is outside the acceptable range. Rates must be greater than 0% and not exceed 12%.`,
        `Verify the interest rate is correctly entered. Correct the note rate to a value between 0% and 12% before resubmitting.`));
    }

    // RATE-002: Coupon rate consistency
    if (loan.couponRate > 0 && loan.interestRate > 0 && loan.couponRate > loan.interestRate) {
      violations.push(this.createViolation('RATE-002', `Coupon: ${loan.couponRate}%, Rate: ${loan.interestRate}%`, 'Coupon ≤ Interest Rate', 'error',
        `The coupon rate of ${loan.couponRate}% exceeds the interest rate of ${loan.interestRate}%.`,
        `Adjust the coupon rate to be at or below the note interest rate. Recalculate the servicing spread if needed.`));
    }

    // RATE-003: Net yield consistency
    if (loan.netYield < 0 || (loan.couponRate > 0 && loan.netYield > loan.couponRate)) {
      violations.push(this.createViolation('RATE-003', `Yield: ${loan.netYield}%, Coupon: ${loan.couponRate}%`, 'Yield ≥ 0 and ≤ Coupon', 'warning',
        `The net yield of ${loan.netYield}% is inconsistent with the coupon rate of ${loan.couponRate}%.`,
        `Recalculate the net yield to ensure it is non-negative and does not exceed the coupon rate. Review guaranty fee and servicing fee deductions.`));
    }

    // BAL-001: Positive UPB
    if (loan.upb <= 0) {
      violations.push(this.createViolation('BAL-001', `$${loan.upb.toLocaleString()}`, '> $0', 'error',
        `The unpaid principal balance of $${loan.upb.toLocaleString()} must be greater than zero.`,
        `Confirm the UPB is populated and greater than zero. Exclude fully paid-off or zero-balance loans from the pool file.`));
    }

    // BAL-002: Investor balance vs UPB
    if (loan.currentInvestorBalance > 0 && loan.upb > 0 && loan.currentInvestorBalance > loan.upb) {
      violations.push(this.createViolation('BAL-002', `Investor: $${loan.currentInvestorBalance.toLocaleString()}, UPB: $${loan.upb.toLocaleString()}`, 'Investor Balance ≤ UPB', 'warning',
        `The current investor balance of $${loan.currentInvestorBalance.toLocaleString()} exceeds the UPB of $${loan.upb.toLocaleString()}.`,
        `Reconcile the investor balance so it does not exceed the current UPB. Verify recent principal payments or curtailments are reflected.`));
    }

    // BAL-003: Conforming limit
    if (loan.upb > 766550) {
      violations.push(this.createViolation('BAL-003', `$${loan.upb.toLocaleString()}`, '≤ $766,550', 'error',
        `The UPB of $${loan.upb.toLocaleString()} exceeds the 2025 conforming loan limit of $766,550.`,
        `This loan exceeds the conforming limit. Route it to a jumbo or high-balance pool, or split the balance to meet the limit.`));
    }

    // PROP-001: Property type
    const validTypes = ['SF', 'CO', 'CP', 'PU', 'MH', '2-4'];
    if (loan.propertyType && !validTypes.includes(loan.propertyType.toUpperCase())) {
      violations.push(this.createViolation('PROP-001', loan.propertyType, validTypes.join(', '), 'error',
        `The property type "${loan.propertyType}" is not among the eligible types for MortgageMax purchase.`,
        `Update the property type to one of the eligible codes: SF, CO, CP, PU, MH, or 2-4. Verify the property classification against the appraisal.`));
    }

    // AGE-001: Maximum loan age
    if (loan.loanAgeMonths > 360) {
      violations.push(this.createViolation('AGE-001', `${loan.loanAgeMonths} months`, '≤ 360 months', 'error',
        `The loan age of ${loan.loanAgeMonths} months exceeds the maximum allowed 360 months (30 years).`,
        `This loan exceeds the 30-year maximum age. Remove it from the pool or verify the origination date is correctly entered.`));
    }

    // STATUS-001: Active status
    const activeStatuses = ['A', 'C'];
    if (loan.loanStatusCode && !activeStatuses.includes(loan.loanStatusCode.toUpperCase())) {
      violations.push(this.createViolation('STATUS-001', loan.loanStatusCode, 'A or C', 'error',
        `The loan status code "${loan.loanStatusCode}" does not indicate an active, performing loan. Expected: A (Active) or C (Current).`,
        `Only active (A) or current (C) loans are eligible for pooling. Resolve any delinquency or default status before resubmitting.`));
    }

    // RTYPE-001: Eligible rate type
    const validRateTypes = ['FRM', 'ARM'];
    if (loan.rateTypeCode && !validRateTypes.includes(loan.rateTypeCode.toUpperCase())) {
      violations.push(this.createViolation('RTYPE-001', loan.rateTypeCode, 'FRM or ARM', 'error',
        `The rate type code "${loan.rateTypeCode}" is not an eligible rate type. Expected: FRM (Fixed) or ARM (Adjustable).`,
        `Update the rate type code to FRM (Fixed Rate Mortgage) or ARM (Adjustable Rate Mortgage). Verify the loan product type in the origination system.`));
    }

    // POOL-001: Pool number required
    if (!loan.poolNumber || loan.poolNumber.trim() === '') {
      violations.push(this.createViolation('POOL-001', '(empty)', 'Non-empty pool number', 'warning',
        `No pool number is assigned to this loan. A valid pool number is required for pool delivery.`,
        `Assign a valid MortgageMax pool number before including this loan in pool delivery. Contact your MortgageMax representative if a pool number has not been issued.`));
    }

    const errorCount = violations.filter(v => v.severity === 'error').length;
    const warningCount = violations.filter(v => v.severity === 'warning').length;
    const score = Math.max(0, 100 - (errorCount * 15) - (warningCount * 5));

    return {
      loanNumber: loan.loanNumber,
      poolNumber: loan.poolNumber,
      eligible: errorCount === 0,
      violations,
      score,
    };
  }

  // ── Validate Batch ────────────────────────────────────────────────
  validateLoans(loans: LoanRecord[]): LoanValidationResult[] {
    return loans.map(loan => this.validateLoan(loan));
  }

  // ── Build Pool Summary ────────────────────────────────────────────
  buildPoolSummary(results: LoanValidationResult[], loans: LoanRecord[]): PoolSummary {
    const eligible = results.filter(r => r.eligible);
    const ineligible = results.filter(r => !r.eligible && r.violations.some(v => v.severity === 'error'));
    const warnings = results.filter(r => r.eligible && r.violations.some(v => v.severity === 'warning'));

    const loanMap = new Map(loans.map(l => [l.loanNumber, l]));
    const totalUPB = loans.reduce((sum, l) => sum + l.upb, 0);
    const eligibleLoans = eligible.map(r => loanMap.get(r.loanNumber)!).filter(Boolean);
    const eligibleUPB = eligibleLoans.reduce((sum, l) => sum + l.upb, 0);

    const weightedAvgRate = eligibleUPB > 0
      ? eligibleLoans.reduce((sum, l) => sum + l.interestRate * l.upb, 0) / eligibleUPB
      : 0;
    const weightedAvgCoupon = eligibleUPB > 0
      ? eligibleLoans.reduce((sum, l) => sum + l.couponRate * l.upb, 0) / eligibleUPB
      : 0;
    const weightedAvgAge = eligibleUPB > 0
      ? eligibleLoans.reduce((sum, l) => sum + l.loanAgeMonths * l.upb, 0) / eligibleUPB
      : 0;

    // Top violations
    const violationCounts = new Map<string, number>();
    results.forEach(r => {
      r.violations.forEach(v => {
        const count = violationCounts.get(v.rule.ruleName) || 0;
        violationCounts.set(v.rule.ruleName, count + 1);
      });
    });
    const topViolations = Array.from(violationCounts.entries())
      .map(([ruleName, count]) => ({ ruleName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalLoans: loans.length,
      eligibleLoans: eligible.length,
      ineligibleLoans: ineligible.length,
      warningLoans: warnings.length,
      totalUPB,
      eligibleUPB,
      weightedAvgRate: Math.round(weightedAvgRate * 1000) / 1000,
      weightedAvgCoupon: Math.round(weightedAvgCoupon * 1000) / 1000,
      weightedAvgAge: Math.round(weightedAvgAge * 10) / 10,
      topViolations,
    };
  }

  // ── Filter Loans ──────────────────────────────────────────────────
  filterLoans(loans: LoanRecord[], filters: LoanFilter): LoanRecord[] {
    return loans.filter(loan => {
      if (filters.poolNumber && loan.poolNumber !== filters.poolNumber) return false;
      if (filters.mbsPoolPrefix && loan.mbsPoolPrefix.toUpperCase() !== filters.mbsPoolPrefix.toUpperCase()) return false;
      if (filters.rateTypeCode && loan.rateTypeCode.toUpperCase() !== filters.rateTypeCode.toUpperCase()) return false;
      if (filters.loanStatusCode && loan.loanStatusCode.toUpperCase() !== filters.loanStatusCode.toUpperCase()) return false;
      if (filters.propertyTypes?.length && !filters.propertyTypes.includes(loan.propertyType.toUpperCase())) return false;
      if (filters.specialCategories?.length && !filters.specialCategories.some(sc => loan.specialCategory.toUpperCase() === sc.toUpperCase())) return false;
      if (filters.minInterestRate != null && loan.interestRate < filters.minInterestRate) return false;
      if (filters.maxInterestRate != null && loan.interestRate > filters.maxInterestRate) return false;
      if (filters.minCouponRate != null && loan.couponRate < filters.minCouponRate) return false;
      if (filters.maxCouponRate != null && loan.couponRate > filters.maxCouponRate) return false;
      if (filters.minUPB != null && loan.upb < filters.minUPB) return false;
      if (filters.maxUPB != null && loan.upb > filters.maxUPB) return false;
      if (filters.minLoanAge != null && loan.loanAgeMonths < filters.minLoanAge) return false;
      if (filters.maxLoanAge != null && loan.loanAgeMonths > filters.maxLoanAge) return false;
      return true;
    });
  }

  // ── Get All Rules ─────────────────────────────────────────────────
  getRules(): EligibilityRule[] {
    return [...this.eligibilityRules];
  }

  // ── Explain Rule ──────────────────────────────────────────────────
  explainRule(ruleId: string): string {
    const rule = this.eligibilityRules.find(r => r.ruleId === ruleId);
    if (!rule) return `Rule ${ruleId} not found in the PoolLogic rule set.`;
    return `**${rule.ruleName}** (${rule.ruleId})\n\nCategory: ${rule.category}\nReference: ${rule.guideReference}\n\n${rule.description}`;
  }

  // ── Parse CSV ─────────────────────────────────────────────────────
  parseCSV(csvText: string): ParseResult {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return { ok: false, error: { type: 'missing-fields', missingFields: [...REQUIRED_LOAN_FIELDS], message: 'File is empty or has no data rows.' } };

    const headers = lines[0].split(',').map(h => h.trim());
    const normalizedHeaders = headers.map(h => this.normalizeFieldName(h));

    // Check required fields
    const missingFields = this.findMissingFields(normalizedHeaders);
    if (missingFields.length > 0) {
      return { ok: false, error: { type: 'missing-fields', missingFields, message: `Required field(s) missing from CSV: ${missingFields.join(', ')}` } };
    }

    const loans: LoanRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length !== headers.length) continue;

      const record: Record<string, unknown> = {};
      headers.forEach((header, idx) => {
        record[header] = values[idx].trim();
      });

      loans.push(this.mapToLoanRecord(record, i));
    }

    return { ok: true, loans };
  }

  // ── Parse JSON ────────────────────────────────────────────────────
  parseJSON(jsonText: string): ParseResult {
    try {
      const data = JSON.parse(jsonText);
      const records: Record<string, unknown>[] = Array.isArray(data) ? data : data.loans || data.data || [];
      if (records.length === 0) {
        return { ok: false, error: { type: 'missing-fields', missingFields: [...REQUIRED_LOAN_FIELDS], message: 'No records found in JSON data.' } };
      }

      // Check required fields against the first record
      const firstRecordKeys = Object.keys(records[0]).map(k => this.normalizeFieldName(k));
      const missingFields = this.findMissingFields(firstRecordKeys);
      if (missingFields.length > 0) {
        return { ok: false, error: { type: 'missing-fields', missingFields, message: `Required field(s) missing from JSON: ${missingFields.join(', ')}` } };
      }

      const loans = records.map((r, idx) => this.mapToLoanRecord(r, idx + 1));
      return { ok: true, loans };
    } catch {
      return { ok: false, error: { type: 'missing-fields', missingFields: [], message: 'Invalid JSON format. Could not parse the file.' } };
    }
  }

  // ── Required-field validation helpers ─────────────────────────────
  private findMissingFields(normalizedHeaders: string[]): string[] {
    return REQUIRED_LOAN_FIELDS.filter(
      reqField => !normalizedHeaders.includes(this.normalizeFieldName(reqField))
    );
  }

  private normalizeFieldName(name: string): string {
    return name.replace(/[\s_\-./]/g, '').toLowerCase();
  }

  // ── Private Helpers ───────────────────────────────────────────────
  private createViolation(
    ruleId: string, actualValue: string, expectedValue: string,
    severity: 'error' | 'warning', explanation: string, recommendedAction: string
  ): RuleViolation {
    const rule = this.eligibilityRules.find(r => r.ruleId === ruleId)!;
    return { rule, actualValue, expectedValue, severity, explanation, recommendedAction };
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
      else { current += char; }
    }
    result.push(current);
    return result;
  }

  private mapToLoanRecord(record: Record<string, unknown>, index: number): LoanRecord {
    const str = (key: string): string => {
      const target = this.normalizeFieldName(key);
      for (const [k, val] of Object.entries(record)) {
        if (this.normalizeFieldName(k) === target) return String(val ?? '');
      }
      return '';
    };

    const num = (key: string): number => {
      const raw = str(key).replace(/[$,%]/g, '');
      return parseFloat(raw) || 0;
    };

    return {
      loanNumber: str('loanNumber') || str('loanNo') || str('loan_number') || `LOAN-${index}`,
      poolNumber: str('poolNumber') || str('pool_number') || str('poolNo') || '',
      mbsPoolPrefix: str('mbsPoolPrefix') || str('mbs_pool_prefix') || '',
      interestRate: num('interestRate') || num('interest_rate') || num('rate'),
      couponRate: num('couponRate') || num('coupon_rate') || num('coupon'),
      netYield: num('netYield') || num('net_yield') || num('yield'),
      loanAgeMonths: num('loanAgeMonths') || num('loan_age_months') || num('loanAge') || num('age'),
      loanStatusCode: str('loanStatusCode') || str('loan_status_code') || str('status') || '',
      rateTypeCode: str('rateTypeCode') || str('rate_type_code') || str('rateType') || '',
      currentInvestorBalance: num('currentInvestorBalance') || num('current_investor_balance') || num('investorBalance'),
      propertyType: str('propertyType') || str('property_type') || str('propType') || '',
      specialCategory: str('specialCategory') || str('special_category') || str('category') || '',
      upb: num('upb') || num('unpaidPrincipalBalance') || num('unpaid_principal_balance'),
    };
  }

  // ── Generate Sample Loans (for demo) ──────────────────────────────
  getSampleLoans(): LoanRecord[] {
    return [
      { loanNumber: 'LN-2025-001', poolNumber: 'PL-8001', mbsPoolPrefix: 'FG', interestRate: 6.25, couponRate: 5.50, netYield: 5.25, loanAgeMonths: 24, loanStatusCode: 'A', rateTypeCode: 'FRM', currentInvestorBalance: 410000, propertyType: 'SF', specialCategory: '', upb: 425000 },
      { loanNumber: 'LN-2025-002', poolNumber: 'PL-8001', mbsPoolPrefix: 'FG', interestRate: 6.50, couponRate: 5.75, netYield: 5.50, loanAgeMonths: 18, loanStatusCode: 'A', rateTypeCode: 'FRM', currentInvestorBalance: 300000, propertyType: 'CO', specialCategory: '', upb: 310000 },
      { loanNumber: 'LN-2025-003', poolNumber: 'PL-8002', mbsPoolPrefix: 'FG', interestRate: 5.875, couponRate: 5.00, netYield: 4.75, loanAgeMonths: 48, loanStatusCode: 'C', rateTypeCode: 'FRM', currentInvestorBalance: 520000, propertyType: 'SF', specialCategory: '', upb: 550000 },
      { loanNumber: 'LN-2025-004', poolNumber: 'PL-8001', mbsPoolPrefix: 'FG', interestRate: 7.00, couponRate: 6.25, netYield: 6.00, loanAgeMonths: 12, loanStatusCode: 'A', rateTypeCode: 'ARM', currentInvestorBalance: 275000, propertyType: 'PU', specialCategory: '', upb: 280000 },
      { loanNumber: 'LN-2025-005', poolNumber: '', mbsPoolPrefix: '', interestRate: 7.25, couponRate: 6.50, netYield: 6.25, loanAgeMonths: 36, loanStatusCode: 'D', rateTypeCode: 'FRM', currentInvestorBalance: 390000, propertyType: 'SF', specialCategory: 'HARP', upb: 380000 },
      { loanNumber: 'LN-2025-006', poolNumber: 'PL-8003', mbsPoolPrefix: 'FH', interestRate: 6.125, couponRate: 5.25, netYield: 5.00, loanAgeMonths: 60, loanStatusCode: 'A', rateTypeCode: 'FRM', currentInvestorBalance: 790000, propertyType: 'SF', specialCategory: '', upb: 820000 },
      { loanNumber: 'LN-2025-007', poolNumber: 'PL-8002', mbsPoolPrefix: 'FG', interestRate: 6.75, couponRate: 6.00, netYield: 5.75, loanAgeMonths: 6, loanStatusCode: 'A', rateTypeCode: 'FRM', currentInvestorBalance: 210000, propertyType: 'CO', specialCategory: '', upb: 200000 },
      { loanNumber: 'LN-2025-008', poolNumber: 'PL-8003', mbsPoolPrefix: 'FH', interestRate: 6.50, couponRate: 5.75, netYield: 5.50, loanAgeMonths: 30, loanStatusCode: 'A', rateTypeCode: 'ARM', currentInvestorBalance: 450000, propertyType: 'CO', specialCategory: '', upb: 465000 },
      { loanNumber: 'LN-2025-009', poolNumber: 'PL-8001', mbsPoolPrefix: 'FG', interestRate: 0, couponRate: 0, netYield: 0, loanAgeMonths: 15, loanStatusCode: 'A', rateTypeCode: 'FRM', currentInvestorBalance: 340000, propertyType: 'SF', specialCategory: '', upb: 350000 },
      { loanNumber: 'LN-2025-010', poolNumber: 'PL-8002', mbsPoolPrefix: 'FG', interestRate: 5.625, couponRate: 5.00, netYield: 4.75, loanAgeMonths: 42, loanStatusCode: 'A', rateTypeCode: 'FRM', currentInvestorBalance: 285000, propertyType: 'SF', specialCategory: '', upb: 290000 },
    ];
  }
}
