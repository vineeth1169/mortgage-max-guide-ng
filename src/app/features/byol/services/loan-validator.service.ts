import { Injectable } from '@angular/core';
import { BYOLLoanRow, ValidatedLoanRow, FieldValidation } from '../models/byol.model';

/**
 * LoanValidatorService - Validate BYOLLoanRow against required schema
 */
@Injectable({
  providedIn: 'root',
})
export class LoanValidatorService {
  /**
   * Required fields and their human-readable labels
   */
  private readonly REQUIRED_FIELDS: Array<{ field: string; label: string; type: 'string' | 'number' }> = [
    { field: 'loanNumber', label: 'Loan Number', type: 'string' },
    { field: 'poolNumber', label: 'Pool Number', type: 'string' },
    { field: 'interestRate', label: 'Interest Rate', type: 'number' },
    { field: 'couponRate', label: 'Coupon Rate', type: 'number' },
    { field: 'netYield', label: 'Net Yield', type: 'number' },
    { field: 'loanAgeMonths', label: 'Loan Age (Months)', type: 'number' },
    { field: 'loanStatusCode', label: 'Loan Status Code', type: 'string' },
    { field: 'rateTypeCode', label: 'Rate Type Code', type: 'string' },
    { field: 'currentInvestorBalance', label: 'Current Investor Balance', type: 'number' },
    { field: 'propertyType', label: 'Property Type', type: 'string' },
    { field: 'upb', label: 'UPB', type: 'number' },
  ];

  /** Fields that are validated but not required to be non-empty strings */
  private readonly OPTIONAL_STRING_FIELDS = new Set(['specialCategory', 'rateTypeCode']);

  readonly REQUIRED_FIELD_KEYS = this.REQUIRED_FIELDS.map((f) => f.field);

  constructor() {}

  /**
   * Validate a single row and return errors
   */
  private validateRow(row: BYOLLoanRow): FieldValidation[] {
    const errors: FieldValidation[] = [];

    for (const { field, label, type } of this.REQUIRED_FIELDS) {
      const value = (row as unknown as Record<string, unknown>)[field];

      if (type === 'string') {
        if (value === undefined || value === null || String(value).trim() === '') {
          errors.push({ field, message: `${label} is required.` });
        }
      } else {
        // number
        if (value === undefined || value === null) {
          errors.push({ field, message: `${label} is required.` });
        } else if (typeof value !== 'number' || !Number.isFinite(value as number)) {
          errors.push({ field, message: `${label} must be a valid number.` });
        }
      }
    }

    // Domain-level sanity checks
    if (row.interestRate !== null && (row.interestRate < 0 || row.interestRate > 100)) {
      errors.push({ field: 'interestRate', message: 'Interest Rate must be between 0 and 100.' });
    }
    if (row.couponRate !== null && (row.couponRate < 0 || row.couponRate > 100)) {
      errors.push({ field: 'couponRate', message: 'Coupon Rate must be between 0 and 100.' });
    }
    if (row.loanAgeMonths !== null && row.loanAgeMonths < 0) {
      errors.push({ field: 'loanAgeMonths', message: 'Loan Age cannot be negative.' });
    }
    if (row.upb !== null && row.upb < 0) {
      errors.push({ field: 'upb', message: 'UPB cannot be negative.' });
    }
    if (row.currentInvestorBalance !== null && row.currentInvestorBalance < 0) {
      errors.push({
        field: 'currentInvestorBalance',
        message: 'Current Investor Balance cannot be negative.',
      });
    }

    return errors;
  }

  /**
   * Validate an array of parsed rows
   */
  validateLoanRows(rows: BYOLLoanRow[]): ValidatedLoanRow[] {
    return rows.map((row) => {
      const errors = this.validateRow(row);
      return { row, errors, isValid: errors.length === 0 };
    });
  }

  /**
   * Get field names that have errors for a given validated row
   */
  getErrorFields(vr: ValidatedLoanRow): Set<string> {
    return new Set(vr.errors.map((e) => e.field));
  }
}
