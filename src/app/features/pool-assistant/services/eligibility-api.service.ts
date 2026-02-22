import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  LoanRecord,
  EligibilityEvaluateRequest,
  EligibilityEvaluateResponse,
} from '../models/pool-logic.model';

/** Result wrapper returned by EligibilityApiService.evaluate(). */
export type EvaluateResult =
  | { ok: true; data: EligibilityEvaluateResponse }
  | { ok: false; error: string };

@Injectable({ providedIn: 'root' })
export class EligibilityApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api'; // proxy-able base path

  /**
   * POST /eligibility/evaluate
   *
   * Sends the parsed loan list to the back-end and returns:
   *   - eligibleLoans
   *   - ineligibleLoans (with failedRules per loan)
   *   - summary of rule failures
   *
   * Returns an `EvaluateResult` discriminated union so callers
   * can handle success / failure without try-catch.
   */
  async evaluate(loans: LoanRecord[]): Promise<EvaluateResult> {
    const body: EligibilityEvaluateRequest = { loans };

    try {
      const response = await firstValueFrom(
        this.http.post<EligibilityEvaluateResponse>(
          `${this.baseUrl}/eligibility/evaluate`,
          body,
        ),
      );
      return { ok: true, data: response };
    } catch (err) {
      const message = this.extractErrorMessage(err);
      return { ok: false, error: message };
    }
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        return 'Unable to reach the eligibility API. The server may be offline.';
      }
      const serverMsg =
        typeof err.error === 'string'
          ? err.error
          : err.error?.message ?? err.message;
      return `API error ${err.status}: ${serverMsg}`;
    }
    return 'An unexpected error occurred while calling the eligibility API.';
  }
}
