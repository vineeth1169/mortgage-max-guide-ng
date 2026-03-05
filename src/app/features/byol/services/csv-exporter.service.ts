import { Injectable } from '@angular/core';
import { saveAs } from 'file-saver';
import { EligibilityResult, BYOLLoanRow } from '../models/byol.model';

/**
 * CsvExporterService - Download ineligible loans as CSV
 */
@Injectable({
  providedIn: 'root',
})
export class CsvExporterService {
  constructor() {}

  /**
   * Download ineligible loans as a CSV file
   */
  downloadIneligibleCsv(results: EligibilityResult[], loans: BYOLLoanRow[]): void {
    const ineligible = results.filter((r) => !r.eligible);
    if (ineligible.length === 0) {
      console.warn('No ineligible loans to export.');
      return;
    }

    const loanMap = new Map(loans.map((l) => [l.loanNumber, l]));

    const headers = [
      'Loan Number',
      'Pool Number',
      'Interest Rate',
      'Coupon Rate',
      'Net Yield',
      'Loan Age (Months)',
      'Loan Status Code',
      'Rate Type Code',
      'Current Investor Balance',
      'Property Type',
      'Special Category',
      'UPB',
      'Rule Failures',
    ];

    const rows = ineligible.map((res) => {
      const loan = loanMap.get(res.loanNumber);
      const failures = res.failures.map((f) => `[${f.ruleId}] ${f.message}`).join(' | ');

      return [
        loan?.loanNumber ?? res.loanNumber,
        loan?.poolNumber ?? '',
        loan?.interestRate ?? '',
        loan?.couponRate ?? '',
        loan?.netYield ?? '',
        loan?.loanAgeMonths ?? '',
        loan?.loanStatusCode ?? '',
        loan?.rateTypeCode ?? '',
        loan?.currentInvestorBalance ?? '',
        loan?.propertyType ?? '',
        loan?.specialCategory ?? '',
        loan?.upb ?? '',
        failures,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
    });

    const csv = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `ineligible_loans_${Date.now()}.csv`);
  }
}
