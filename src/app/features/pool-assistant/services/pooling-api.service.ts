import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  PoolingBuildRequest,
  PoolingBuildResponse,
} from '../models/pool-logic.model';

/** Result wrapper returned by PoolingApiService.build(). */
export type PoolingBuildResult =
  | { ok: true; data: PoolingBuildResponse }
  | { ok: false; error: string };

@Injectable({ providedIn: 'root' })
export class PoolingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api'; // proxy-able base path

  /**
   * POST /pooling/build
   *
   * Sends a requestId and targetCoupon to build a pool.
   * Returns:
   *   - poolType
   *   - notionalAmount
   *   - status  (CREATED | PARTIAL | FAILED)
   *   - invalidLoans  (each with failedRules)
   */
  async build(requestId: string, targetCoupon: number): Promise<PoolingBuildResult> {
    const body: PoolingBuildRequest = { requestId, targetCoupon };

    try {
      const response = await firstValueFrom(
        this.http.post<PoolingBuildResponse>(
          `${this.baseUrl}/pooling/build`,
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
        return 'Unable to reach the pooling API. The server may be offline.';
      }
      const serverMsg =
        typeof err.error === 'string'
          ? err.error
          : err.error?.message ?? err.message;
      return `API error ${err.status}: ${serverMsg}`;
    }
    return 'An unexpected error occurred while calling the pooling API.';
  }
}
