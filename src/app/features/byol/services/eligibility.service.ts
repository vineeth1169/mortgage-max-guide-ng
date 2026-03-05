import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { BYOLLoanRow, EligibilityResponse, EligibilityResult, RuleFailure } from '../models/byol.model';

/**
 * EligibilityService - Evaluate loan eligibility
 * Calls POST /eligibility/evaluate backend endpoint
 * Falls back to client-side simulation when backend is unreachable
 */
@Injectable({
  providedIn: 'root',
})
export class EligibilityService {
  private readonly API_ENDPOINT = '/api/eligibility/evaluate';

  /**
   * Demo eligibility rules used for client-side simulation
   */
  private readonly DEMO_RULES: Array<{
    id: string;
    name: string;
    check: (r: BYOLLoanRow) => string | null;
  }> = [
    {
      id: 'R-001',
      name: 'Minimum UPB',
      check: (r) =>
        r.upb !== null && r.upb < 50_000 ? 'UPB must be at least $50,000.' : null,
    },
    {
      id: 'R-002',
      name: 'Interest Rate Cap',
      check: (r) =>
        r.interestRate !== null && r.interestRate > 12
          ? 'Interest rate exceeds 12% cap.'
          : null,
    },
    {
      id: 'R-003',
      name: 'Loan Age Limit',
      check: (r) =>
        r.loanAgeMonths !== null && r.loanAgeMonths > 360
          ? 'Loan age exceeds 360 months.'
          : null,
    },
    {
      id: 'R-004',
      name: 'Investor Balance > 0',
      check: (r) =>
        r.currentInvestorBalance !== null && r.currentInvestorBalance <= 0
          ? 'Current investor balance must be positive.'
          : null,
    },
    {
      id: 'R-005',
      name: 'Valid Loan Status',
      check: (r) => {
        const allowed = ['A', 'C', 'D', 'F', 'P', 'R', '1', '2', '3', '9'];
        return r.loanStatusCode && !allowed.includes(r.loanStatusCode.toUpperCase())
          ? `Loan status code "${r.loanStatusCode}" is not eligible.`
          : null;
      },
    },
    {
      id: 'R-006',
      name: 'Net Yield Floor',
      check: (r) =>
        r.netYield !== null && r.netYield < 0.5 ? 'Net yield must be at least 0.50%.' : null,
    },
  ];

  constructor(private http: HttpClient) {}

  /**
   * Call the backend API for eligibility evaluation
   */
  private callBackend(loans: BYOLLoanRow[]): Promise<EligibilityResponse> {
    return firstValueFrom(
      this.http.post<EligibilityResponse>(this.API_ENDPOINT, { loans })
    );
  }

  /**
   * Client-side simulation of eligibility evaluation
   * Used when backend is unavailable
   */
  private simulateEvaluation(loans: BYOLLoanRow[]): EligibilityResponse {
    const results: EligibilityResult[] = loans.map((loan) => {
      const failures: RuleFailure[] = [];

      for (const rule of this.DEMO_RULES) {
        const msg = rule.check(loan);
        if (msg) {
          failures.push({
            ruleId: rule.id,
            ruleName: rule.name,
            message: msg,
            severity: 'error',
          });
        }
      }

      return {
        loanNumber: loan.loanNumber,
        eligible: failures.length === 0,
        failures,
      };
    });

    return {
      results,
      summary: {
        total: results.length,
        eligible: results.filter((r) => r.eligible).length,
        ineligible: results.filter((r) => !r.eligible).length,
      },
    };
  }

  /**
   * Evaluate loan eligibility
   * Tries backend first, falls back to client-side simulation
   */
  async evaluateEligibility(loans: BYOLLoanRow[]): Promise<EligibilityResponse> {
    try {
      return await this.callBackend(loans);
    } catch (error) {
      // Backend unavailable – use client-side simulation
      console.warn('[BYOL] Backend unavailable – using client-side eligibility simulation.');
      return this.simulateEvaluation(loans);
    }
  }
}
