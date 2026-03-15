import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../../../environments/environment';

// ── Types ───────────────────────────────────────────────────────────

export type AIProvider = 'groq' | 'claude';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIIntent {
  action: 'validate' | 'build-pool' | 'filter' | 'show-rules' | 'explain-rule' | 'summary' | 'show-ineligible' | 'download-ineligible' | 'help' | 'load-sample' | 'general' | 'data-query';
  parameters?: Record<string, any>;
  confidence: number;
}

/** Loan data summary sent to AI for context */
export interface LoanDataContext {
  loanCount: number;
  eligibleCount?: number;
  ineligibleCount?: number;
  hasValidationResults: boolean;
  /** Sample of loan data (first 10 loans) for AI to analyze */
  sampleLoans?: LoanSample[];
  /** All loans for complete analysis */
  allLoans?: LoanSample[];
  /** Summary statistics */
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

export interface AIResponse {
  intent: AIIntent;
  message: string;
  reasoning?: string;
  provider: AIProvider;
}

// ── Provider Display Names ──────────────────────────────────────────

export const PROVIDER_INFO: Record<AIProvider, { name: string; description: string; icon: string }> = {
  groq: { 
    name: 'Groq', 
    description: 'Ultra-fast LLaMA 3.1 70B (via backend)', 
    icon: '⚡' 
  },
  claude: { 
    name: 'Claude', 
    description: 'Anthropic Claude Sonnet (via backend)', 
    icon: '🧠' 
  },
};

// ── Service ─────────────────────────────────────────────────────────
// This service is now a thin UI state layer.
// ALL AI API calls go through the backend — no API keys are stored or
// transmitted by the frontend. The backend owns and secures all secrets.

@Injectable({ providedIn: 'root' })
export class ClaudeAIService {
  private conversationHistory: AIMessage[] = [];
  
  private readonly STORAGE_KEYS = {
    provider: 'mortgagemax_ai_provider',
  };
  
  // Helper to safely load from localStorage
  private loadFromStorage(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  
  // Helper to safely save to localStorage
  private saveToStorage(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      console.warn('Failed to save to localStorage');
    }
  }
  
  // Current provider selection (UI preference only — backend handles actual calls)
  readonly provider = signal<AIProvider>(
    (this.loadFromStorage(this.STORAGE_KEYS.provider) as AIProvider) ||
    (environment.ai?.defaultProvider as AIProvider) || 
    'groq'
  );
  
  readonly isEnabled = signal<boolean>(true);
  readonly lastError = signal<string | null>(null);
  
  // Computed properties for UI
  readonly providerInfo = computed(() => PROVIDER_INFO[this.provider()]);
  readonly providerName = computed(() => PROVIDER_INFO[this.provider()].name);
  
  // Always configured — backend manages API keys
  readonly isConfigured = computed(() => true);

  // Legacy compatibility
  readonly aiModeEnabled = computed(() => this.isEnabled());
  readonly aiConfigured = computed(() => this.isConfigured());
  readonly aiModeLabel = computed(() => PROVIDER_INFO[this.provider()].name);

  // ── Provider Management ───────────────────────────────────────────

  setProvider(provider: AIProvider): void {
    this.provider.set(provider);
    this.saveToStorage(this.STORAGE_KEYS.provider, provider);
    this.lastError.set(null);
    this.clearHistory();
  }

  // Legacy methods — API keys are no longer stored on the frontend
  setGroqApiKey(_key: string): void {
    // No-op: API keys are managed exclusively on the backend
    this.setProvider('groq');
  }

  setClaudeApiKey(_key: string): void {
    // No-op: API keys are managed exclusively on the backend
    this.setProvider('claude');
  }

  setApiKey(_key: string): void {
    // No-op: API keys are managed exclusively on the backend
  }

  enableLiveMode(): void {
    this.setProvider('groq');
  }

  enable(): void {
    this.isEnabled.set(true);
  }

  disable(): void {
    this.isEnabled.set(false);
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }
}

// Re-export for compatibility
export { AIMessage as ClaudeMessage, AIIntent as ClaudeIntent, AIResponse as ClaudeResponse };
