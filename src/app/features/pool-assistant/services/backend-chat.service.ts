import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { LoanRecord, LoanFilter } from '../models/pool-logic.model';

/**
 * Backend Chat API Service
 * 
 * This service is a THIN CLIENT that sends ALL requests to the backend.
 * NO business logic, rule evaluation, or decision-making happens in the frontend.
 * The backend handles:
 * - AI message generation
 * - Loan validation against rules
 * - Pool building
 * - Filtering
 * 
 * The frontend ONLY displays what the backend returns.
 */

export interface ChatMessageRequest {
  message: string;
  sessionId?: string;
  context?: LoanDataContext;
}

export interface ChatMessageResponse {
  sessionId: string;
  intent: {
    action: string;
    parameters?: Record<string, any>;
    confidence: number;
  };
  message: string;
  reasoning?: string;
  provider: string;
}

export interface WelcomeResponse {
  message: string;
  provider: string;
}

export interface LoanDataContext {
  loanCount: number;
  eligibleCount?: number;
  ineligibleCount?: number;
  hasValidationResults: boolean;
  allLoans?: LoanSample[];
  stats?: LoanStats;
}

export interface LoanSample {
  loanNumber: string;
  poolNumber: string;
  interestRate: number;
  couponRate: number;
  upb: number;
  loanAgeMonths: number;
  loanStatusCode: string;
  propertyType: string;
  mbsPoolPrefix: string;
  specialCategory?: string;
}

export interface LoanStats {
  avgInterestRate: number;
  avgCouponRate: number;
  avgUPB: number;
  avgLoanAge: number;
  totalUPB: number;
  propertyTypes: string[];
  statusCodes: string[];
  prefixes: string[];
}

export interface ValidationResponse {
  eligibleLoans: LoanRecord[];
  ineligibleLoans: IneligibleLoan[];
  summary: ValidationSummary;
  aiMessage?: string;
}

export interface IneligibleLoan {
  loanNumber: string;
  poolNumber: string;
  score: number;
  failedRules: FailedRule[];
}

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

export interface ValidationSummary {
  totalLoans: number;
  eligibleCount: number;
  ineligibleCount: number;
  warningCount: number;
  totalUPB: number;
  eligibleUPB: number;
  weightedAvgRate: number;
  weightedAvgCoupon: number;
  weightedAvgAge: number;
  ruleFailures: { ruleId: string; ruleName: string; count: number }[];
}

export interface PoolBuildResponse {
  poolType: string;
  requestId: string;
  notionalAmount: number;
  poolCoupon: number;
  status: 'CREATED' | 'PARTIAL' | 'FAILED';
  eligibleCount: number;
  invalidLoans: IneligibleLoan[];
  aiMessage?: string;
}

export interface FilterResponse {
  originalCount: number;
  filteredCount: number;
  loans: LoanRecord[];
}

export interface RuleSummary {
  id: string;
  name: string;
  category: string;
  description: string;
  guideReference: string;
  severity: string;
  // NOTE: No thresholds, operators, or values - those stay on backend
}

export interface RuleSummaryResponse {
  totalRules: number;
  categories: string[];
  rules: RuleSummary[];
}

@Injectable({ providedIn: 'root' })
export class BackendChatService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.rulesApiUrl || 'http://localhost:3001/api';
  
  // Get API key from environment or localStorage
  private getApiKey(): string {
    try {
      return localStorage.getItem('mortgagemax_groq_api_key') || 
             environment.ai?.groq?.apiKey || 
             '';
    } catch {
      return environment.ai?.groq?.apiKey || '';
    }
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'x-groq-api-key': this.getApiKey(),
    });
  }

  /**
   * Get AI-generated welcome message from backend
   */
  async getWelcomeMessage(): Promise<WelcomeResponse> {
    const response = await firstValueFrom(
      this.http.post<{ success: boolean; data: WelcomeResponse }>(
        `${this.baseUrl}/chat/welcome`,
        {},
        { headers: this.getHeaders() }
      )
    );
    
    if (!response.success) {
      throw new Error('Failed to get welcome message');
    }
    
    return response.data;
  }

  /**
   * Send a chat message to be processed by backend AI
   */
  async sendMessage(request: ChatMessageRequest): Promise<ChatMessageResponse> {
    const response = await firstValueFrom(
      this.http.post<{ success: boolean; data: ChatMessageResponse; error?: string }>(
        `${this.baseUrl}/chat/message`,
        request,
        { headers: this.getHeaders() }
      )
    );
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to process message');
    }
    
    return response.data;
  }

  /**
   * Clear chat session
   */
  async clearSession(sessionId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.baseUrl}/chat/session/${sessionId}`)
    );
  }

  /**
   * Validate loans on backend (rule evaluation happens server-side)
   */
  async validateLoans(loans: LoanRecord[]): Promise<ValidationResponse> {
    const response = await firstValueFrom(
      this.http.post<{ success: boolean; data: ValidationResponse; error?: string }>(
        `${this.baseUrl}/eligibility/evaluate`,
        { loans },
        { headers: this.getHeaders() }
      )
    );
    
    if (!response.success) {
      throw new Error(response.error || 'Validation failed');
    }
    
    return response.data;
  }

  /**
   * Build pool on backend
   */
  async buildPool(loans: LoanRecord[], targetCoupon?: number): Promise<PoolBuildResponse> {
    const requestId = `REQ-${Date.now()}`;
    
    const response = await firstValueFrom(
      this.http.post<{ success: boolean; data: PoolBuildResponse; error?: string }>(
        `${this.baseUrl}/pooling/build`,
        { loans, requestId, targetCoupon },
        { headers: this.getHeaders() }
      )
    );
    
    if (!response.success) {
      throw new Error(response.error || 'Pool building failed');
    }
    
    return response.data;
  }

  /**
   * Filter loans on backend
   */
  async filterLoans(loans: LoanRecord[], filter: LoanFilter): Promise<FilterResponse> {
    const response = await firstValueFrom(
      this.http.post<{ success: boolean; data: FilterResponse; error?: string }>(
        `${this.baseUrl}/loans/filter`,
        { loans, filter },
        { headers: this.getHeaders() }
      )
    );
    
    if (!response.success) {
      throw new Error(response.error || 'Filtering failed');
    }
    
    return response.data;
  }

  /**
   * Get rule summary (without exposing thresholds)
   */
  async getRuleSummary(): Promise<RuleSummaryResponse> {
    const response = await firstValueFrom(
      this.http.get<{ success: boolean; data: RuleSummaryResponse }>(
        `${this.baseUrl}/rules/summary`
      )
    );
    
    if (!response.success) {
      throw new Error('Failed to get rule summary');
    }
    
    return response.data;
  }

  /**
   * Check if backend is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ status: string }>(`${this.baseUrl}/health`)
      );
      return response.status === 'ok';
    } catch {
      return false;
    }
  }
}
