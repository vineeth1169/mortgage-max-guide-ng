import { Injectable, inject, signal, computed } from '@angular/core';
import * as XLSX from 'xlsx';
import {
  LoanRecord,
  LoanValidationResult,
  RuleViolation,
  EligibilityRule,
  PoolSummary,
  LoanFilter,
  REQUIRED_LOAN_FIELDS,
} from '../models/pool-logic.model';
import { DynamicValidationEngine, DynamicRule } from './dynamic-validation-engine.service';

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
  private readonly dynamicEngine = inject(DynamicValidationEngine);

  // ── State ─────────────────────────────────────────────────────────
  readonly rulesLoaded = signal<boolean>(false);
  readonly rulesError = signal<string | null>(null);
  
  // ── Computed: Rules from Dynamic Engine ───────────────────────────
  readonly eligibilityRules = computed<EligibilityRule[]>(() => {
    return this.dynamicEngine.enabledRules().map(r => this.mapDynamicToEligibility(r));
  });
  
  readonly ruleCount = computed(() => this.eligibilityRules().length);

  // ── Rule Loading ──────────────────────────────────────────────────
  
  /**
   * Load rules from API. Call this before validation.
   * Returns true if rules were loaded successfully.
   */
  async loadRules(): Promise<boolean> {
    const success = await this.dynamicEngine.loadRules();
    this.rulesLoaded.set(success);
    this.rulesError.set(this.dynamicEngine.error());
    return success;
  }

  /**
   * Refresh rules from API. Use after adding/editing rules in the UI.
   * This ensures new rules take effect immediately.
   */
  async refreshRules(): Promise<boolean> {
    return this.loadRules();
  }

  /**
   * Check if API is available
   */
  async isApiAvailable(): Promise<boolean> {
    return this.dynamicEngine.checkApiHealth();
  }

  private mapDynamicToEligibility(rule: DynamicRule): EligibilityRule {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      category: rule.category as any,
      description: rule.description,
      guideReference: rule.guideReference,
    };
  }

  // ── Validate Single Loan ──────────────────────────────────────────
  validateLoan(loan: LoanRecord): LoanValidationResult {
    // Use dynamic validation engine for all rule evaluation
    const violations = this.dynamicEngine.validateLoan(loan);
    
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
  async validateLoansAsync(loans: LoanRecord[]): Promise<LoanValidationResult[]> {
    // Ensure rules are loaded from API before validation
    if (!this.rulesLoaded()) {
      await this.loadRules();
    }
    return loans.map(loan => this.validateLoan(loan));
  }

  // ── Validate Batch (sync - uses cached rules) ─────────────────────
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
    return [...this.eligibilityRules()];
  }

  // ── Explain Rule ──────────────────────────────────────────────────
  explainRule(ruleId: string): string {
    const rule = this.eligibilityRules().find(r => r.ruleId === ruleId);
    if (!rule) return `Rule ${ruleId} not found. Rules may not be loaded yet. Please ensure the backend is running.`;
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

  // ── Parse XLSX ────────────────────────────────────────────────────
  parseXLSX(buffer: ArrayBuffer): ParseResult {
    try {
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return { ok: false, error: { type: 'missing-fields', missingFields: [...REQUIRED_LOAN_FIELDS], message: 'Excel file has no sheets.' } };
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const records: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet);

      if (records.length === 0) {
        return { ok: false, error: { type: 'missing-fields', missingFields: [...REQUIRED_LOAN_FIELDS], message: 'No records found in Excel file.' } };
      }

      // Check required fields against the first record
      const firstRecordKeys = Object.keys(records[0]).map(k => this.normalizeFieldName(k));
      const missingFields = this.findMissingFields(firstRecordKeys);
      if (missingFields.length > 0) {
        return { ok: false, error: { type: 'missing-fields', missingFields, message: `Required field(s) missing from Excel: ${missingFields.join(', ')}` } };
      }

      const loans = records.map((r, idx) => this.mapToLoanRecord(r, idx + 1));
      return { ok: true, loans };
    } catch (err) {
      return { ok: false, error: { type: 'missing-fields', missingFields: [], message: 'Could not parse Excel file. Please ensure the file is a valid .xlsx or .xls file.' } };
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
      { loanNumber: 'LN-2025-001', poolNumber: 'PL-8001', mbsPoolPrefix: 'MX', interestRate: 6.25, couponRate: 5.50, netYield: 5.25, loanAgeMonths: 24, loanStatusCode: 'A', rateTypeCode: 'FRM', currentInvestorBalance: 410000, propertyType: 'SF', specialCategory: '', upb: 425000 },
      { loanNumber: 'LN-2025-002', poolNumber: 'PL-8001', mbsPoolPrefix: 'MX', interestRate: 6.50, couponRate: 5.75, netYield: 5.50, loanAgeMonths: 18, loanStatusCode: 'A', rateTypeCode: 'FRM', currentInvestorBalance: 300000, propertyType: 'CO', specialCategory: '', upb: 310000 },
      { loanNumber: 'LN-2025-003', poolNumber: 'PL-8002', mbsPoolPrefix: 'MX', interestRate: 5.875, couponRate: 5.00, netYield: 4.75, loanAgeMonths: 48, loanStatusCode: 'C', rateTypeCode: 'FRM', currentInvestorBalance: 520000, propertyType: 'SF', specialCategory: '', upb: 550000 },
      { loanNumber: 'LN-2025-004', poolNumber: 'PL-8001', mbsPoolPrefix: 'MX', interestRate: 7.00, couponRate: 6.25, netYield: 6.00, loanAgeMonths: 12, loanStatusCode: 'A', rateTypeCode: 'ARM', currentInvestorBalance: 275000, propertyType: 'PU', specialCategory: '', upb: 280000 },
      { loanNumber: 'LN-2025-005', poolNumber: '', mbsPoolPrefix: '', interestRate: 7.25, couponRate: 6.50, netYield: 6.25, loanAgeMonths: 36, loanStatusCode: 'D', rateTypeCode: 'FRM', currentInvestorBalance: 390000, propertyType: 'SF', specialCategory: 'HARP', upb: 380000 },
      { loanNumber: 'LN-2025-006', poolNumber: 'PL-8003', mbsPoolPrefix: 'MA', interestRate: 6.125, couponRate: 5.25, netYield: 5.00, loanAgeMonths: 60, loanStatusCode: 'A', rateTypeCode: 'FRM', currentInvestorBalance: 790000, propertyType: 'SF', specialCategory: '', upb: 820000 },
      { loanNumber: 'LN-2025-007', poolNumber: 'PL-8002', mbsPoolPrefix: 'MX', interestRate: 6.75, couponRate: 6.00, netYield: 5.75, loanAgeMonths: 6, loanStatusCode: 'A', rateTypeCode: 'FRM', currentInvestorBalance: 210000, propertyType: 'CO', specialCategory: '', upb: 200000 },
      { loanNumber: 'LN-2025-008', poolNumber: 'PL-8003', mbsPoolPrefix: 'MA', interestRate: 6.50, couponRate: 5.75, netYield: 5.50, loanAgeMonths: 30, loanStatusCode: 'A', rateTypeCode: 'ARM', currentInvestorBalance: 450000, propertyType: 'CO', specialCategory: '', upb: 465000 },
      { loanNumber: 'LN-2025-009', poolNumber: 'PL-8001', mbsPoolPrefix: 'MX', interestRate: 0, couponRate: 0, netYield: 0, loanAgeMonths: 15, loanStatusCode: 'A', rateTypeCode: 'FRM', currentInvestorBalance: 340000, propertyType: 'SF', specialCategory: '', upb: 350000 },
      { loanNumber: 'LN-2025-010', poolNumber: 'PL-8002', mbsPoolPrefix: 'MX', interestRate: 5.625, couponRate: 5.00, netYield: 4.75, loanAgeMonths: 42, loanStatusCode: 'A', rateTypeCode: 'FRM', currentInvestorBalance: 285000, propertyType: 'SF', specialCategory: '', upb: 290000 },
    ];
  }
}
