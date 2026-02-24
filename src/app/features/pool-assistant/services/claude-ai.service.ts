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

interface GroqApiResponse {
  id: string;
  object: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface AnthropicApiResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{ type: 'text'; text: string }>;
  model: string;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

// ── System Prompt (for live API modes) ──────────────────────────────

const LOAN_ADVISOR_SYSTEM_PROMPT = `You are Loan Pool Advisor, an AI assistant specialized in MortgageMax mortgage loan validation and pool construction.

You have DIRECT ACCESS to the user's loan data. When the user asks questions about their loans, you MUST analyze the provided loan data and give specific, accurate answers with exact numbers and loan references.

## Your Capabilities
1. **Validate loans** against MortgageMax Single-Family Seller/Servicer Guide eligibility rules
2. **Build compliant pools** from eligible loans
3. **Filter loans** by criteria (rate, UPB, property type, age, status, etc.)
4. **Explain rules** and eligibility requirements
5. **Answer questions** about MortgageMax guidelines

## Eligibility Rules You Enforce
| Rule ID | Name | Requirement |
|---------|------|-------------|
| RATE-001 | Interest Rate Range | 0% < rate ≤ 12% |
| RATE-002 | Coupon vs Interest | couponRate ≤ interestRate |
| RATE-003 | Net Yield Range | 0 ≤ netYield ≤ couponRate |
| BAL-001 | Positive UPB | UPB > 0 |
| BAL-002 | Investor Balance | investorBalance ≤ UPB |
| BAL-003 | Conforming Limit | UPB ≤ $766,550 |
| PROP-001 | Property Type | SF, CO, CP, PU, MH, 2-4 only |
| STATUS-001 | Active Status | Status A or C only |
| AGE-001 | Minimum Age | loanAge ≥ 4 months |
| POOL-001 | Pool Assignment | poolNumber required |
| PREFIX-001 | MBS Prefix | FG, FH, or FN prefix required |

## Response Format
You MUST respond with valid JSON in this exact format:
{
  "intent": {
    "action": "<one of: validate, build-pool, filter, show-rules, explain-rule, summary, show-ineligible, help, load-sample, general>",
    "parameters": { /* optional parameters like ruleId, filterCriteria */ },
    "confidence": <0.0 to 1.0>
  },
  "message": "<Your conversational response to the user>",
  "reasoning": "<Brief explanation of why you chose this intent>"
}

## Intent Mapping
- User wants to check/validate/verify loans → action: "validate"
- User wants to build/construct/create a pool → action: "build-pool"  
- User wants to filter/find/search loans → action: "filter" (include filter object in parameters.filter with fields: minCouponRate, maxCouponRate, minInterestRate, maxInterestRate, minUPB, maxUPB, minLoanAge, maxLoanAge, loanStatusCode, propertyTypes[], mbsPoolPrefix, specialCategories[])
- User asks about rules/eligibility requirements → action: "show-rules"
- User asks to explain a specific rule → action: "explain-rule" (include ruleId in parameters)
- User asks for summary/metrics → action: "summary"
- User asks about failed/ineligible loans → action: "show-ineligible"
- User wants to download/export ineligible loans → action: "download-ineligible" (include parameters.format: "csv" | "excel" | "pdf" | "json")
- User asks for help/commands → action: "help"
- User wants sample/demo data → action: "load-sample"
- User asks a specific data question that YOU can answer from the provided loan data → action: "data-query" (IMPORTANT: analyze the loan data and provide the COMPLETE answer in the message field with specific loan numbers, values, and calculations)
- General questions about loans/guidelines → action: "general"

## Data Query Examples
When action is "data-query", analyze the provided loan data and answer directly in the message:
- "How many loans have rate above 5%?" → Count and list specific loan numbers
- "What is the average UPB?" → Calculate and provide the exact value
- "Show me the highest interest rate loan" → Find and describe it with all details
- "Which loans are in pool PL-001?" → List them with key details
- "What property types do we have?" → List unique property types with counts
- "Compare loans by coupon rate" → Sort and present the comparison

## Response Formatting
- ALWAYS use markdown tables when displaying loan data, comparisons, or lists with multiple attributes
- Tables should have clear headers and proper alignment
- For data queries with multiple loans, present results in a table
- Include relevant columns based on the query context
- Use | for column separators and --- for header delimiter

## Guidelines
- Be concise but thorough
- Reference specific rule IDs when discussing eligibility
- If unsure, ask clarifying questions
- When loan data is provided, ALWAYS analyze it to answer questions accurately
- For data queries, include specific loan numbers and values in your response
- When filtering, generate precise filter parameters based on user intent
- For questions about the data, calculate statistics and provide exact numbers
- ALWAYS format multi-row data as tables for readability
- Suggest next steps when appropriate

## Filter Parameter Schema
When action is "filter", include parameters.filter with applicable fields:
{
  "minCouponRate": number,
  "maxCouponRate": number,
  "minInterestRate": number,  
  "maxInterestRate": number,
  "minUPB": number,
  "maxUPB": number,
  "minLoanAge": number,
  "maxLoanAge": number,
  "loanStatusCode": "A" | "C" | "D",
  "propertyTypes": ["SF", "CO", "CP", "PU", "MH", "2-4"],
  "mbsPoolPrefix": "FG" | "FH" | "FN",
  "poolNumber": string,
  "specialCategories": string[]
}`;

// ── Provider Display Names ──────────────────────────────────────────

export const PROVIDER_INFO: Record<AIProvider, { name: string; description: string; icon: string }> = {
  groq: { 
    name: 'Groq', 
    description: 'Ultra-fast LLaMA 3.1 70B', 
    icon: '⚡' 
  },
  claude: { 
    name: 'Claude', 
    description: 'Anthropic Claude Sonnet (paid)', 
    icon: '🧠' 
  },
};

// ── Service ─────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ClaudeAIService {
  private conversationHistory: AIMessage[] = [];
  
  // LocalStorage keys
  private readonly STORAGE_KEYS = {
    groqApiKey: 'mortgagemax_groq_api_key',
    claudeApiKey: 'mortgagemax_claude_api_key',
    provider: 'mortgagemax_ai_provider',
  };
  
  // API Keys (can be set at runtime, persisted to localStorage)
  private groqApiKey = signal<string>(this.loadFromStorage(this.STORAGE_KEYS.groqApiKey) || environment.ai?.groq?.apiKey || '');
  private claudeApiKey = signal<string>(this.loadFromStorage(this.STORAGE_KEYS.claudeApiKey) || environment.ai?.claude?.apiKey || '');
  
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
  
  // Current provider - defaults to Groq, persisted to localStorage
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
  
  readonly isConfigured = computed(() => {
    const p = this.provider();
    if (p === 'groq') return this.groqApiKey() !== '';
    if (p === 'claude') return this.claudeApiKey() !== '' || (environment.ai?.claude?.proxyUrl ?? '') !== '';
    return false;
  });

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

  setGroqApiKey(key: string): void {
    this.groqApiKey.set(key);
    this.saveToStorage(this.STORAGE_KEYS.groqApiKey, key);
    if (key) {
      this.setProvider('groq');
    }
  }

  setClaudeApiKey(key: string): void {
    this.claudeApiKey.set(key);
    this.saveToStorage(this.STORAGE_KEYS.claudeApiKey, key);
    if (key) {
      this.setProvider('claude');
    }
  }

  // Legacy methods for compatibility
  setApiKey(key: string): void {
    this.setClaudeApiKey(key);
  }

  enableLiveMode(): void {
    if (this.groqApiKey()) {
      this.setProvider('groq');
    } else if (this.claudeApiKey() || environment.ai?.claude?.proxyUrl) {
      this.setProvider('claude');
    } else {
      this.lastError.set('No API key configured');
    }
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

  // ── Main API ──────────────────────────────────────────────────────

  async classifyIntent(
    userInput: string,
    context?: LoanDataContext
  ): Promise<AIResponse> {
    const currentProvider = this.provider();

    // Always use Groq for responses
    try {
      // Build context message with loan data
      let contextMsg = '';
      if (context) {
        const parts: string[] = [];
        if (context.loanCount !== undefined) {
          parts.push(`${context.loanCount} loans loaded`);
        }
        if (context.hasValidationResults && context.eligibleCount !== undefined) {
          parts.push(`${context.eligibleCount} eligible, ${context.ineligibleCount} ineligible`);
        }
        
        // Add loan statistics
        if (context.stats) {
          parts.push(`Avg Rate: ${context.stats.avgInterestRate.toFixed(2)}%`);
          parts.push(`Total UPB: $${context.stats.totalUPB.toLocaleString()}`);
          parts.push(`Property Types: ${context.stats.propertyTypes.join(', ')}`);
        }
        
        if (parts.length > 0) {
          contextMsg = `\n\n[Context: ${parts.join('; ')}]`;
        }
        
        // Include full loan data for accurate analysis
        if (context.allLoans && context.allLoans.length > 0) {
          contextMsg += `\n\n[LOAN DATA - You MUST use this to answer questions accurately]\n`;
          contextMsg += JSON.stringify(context.allLoans, null, 0);
        }
      }

      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: userInput + contextMsg,
      });

      // Keep conversation history manageable
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      let response: AIResponse;
      
      if (currentProvider === 'groq') {
        response = await this.callGroqAPI();
      } else {
        response = await this.callClaudeAPI();
      }
      
      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response.message,
      });

      this.lastError.set(null);
      return response;

    } catch (error: any) {
      console.error(`${currentProvider} API error:`, error);
      this.lastError.set(error.message || `Failed to connect to ${currentProvider}`);
      // Return error response
      return {
        intent: { action: 'general', confidence: 0 },
        message: `⚠️ **API Error**: ${error.message || 'Failed to connect to AI service'}. Please check your API key configuration.`,
        provider: currentProvider,
      };
    }
  }

  // ── Groq API Call ─────────────────────────────────────────────────

  private async callGroqAPI(): Promise<AIResponse> {
    const apiKey = this.groqApiKey();
    
    if (!apiKey) {
      throw new Error('Groq API key not configured. Get a key at console.groq.com');
    }

    const requestBody = {
      model: environment.ai?.groq?.model || 'llama-3.3-70b-versatile',
      max_tokens: environment.ai?.groq?.maxTokens || 1024,
      messages: [
        { role: 'system', content: LOAN_ADVISOR_SYSTEM_PROMPT },
        ...this.conversationHistory.map(m => ({ role: m.role, content: m.content })),
      ],
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `Groq API error: ${response.status}`);
    }

    const data: GroqApiResponse = await response.json();
    const content = data.choices[0]?.message?.content || '';

    return this.parseAIResponse(content, 'groq');
  }

  // ── Claude API Call ───────────────────────────────────────────────

  private async callClaudeAPI(): Promise<AIResponse> {
    const apiKey = this.claudeApiKey();
    const proxyUrl = environment.ai?.claude?.proxyUrl;
    const useProxy = !apiKey && proxyUrl;

    const requestBody = {
      model: environment.ai?.claude?.model || 'claude-sonnet-4-20250514',
      max_tokens: environment.ai?.claude?.maxTokens || 1024,
      system: LOAN_ADVISOR_SYSTEM_PROMPT,
      messages: this.conversationHistory,
    };

    let responseData: AnthropicApiResponse;

    if (useProxy) {
      const response = await fetch(proxyUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Proxy error: ${response.status} - ${error}`);
      }

      responseData = await response.json();
    } else if (apiKey) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `Claude API error: ${response.status}`);
      }

      responseData = await response.json();
    } else {
      throw new Error('No Claude API key or proxy configured');
    }

    const textContent = responseData.content.find(c => c.type === 'text');
    if (!textContent) {
      throw new Error('No text content in response');
    }

    return this.parseAIResponse(textContent.text, 'claude');
  }

  // ── Response Parsing ──────────────────────────────────────────────

  private parseAIResponse(text: string, provider: AIProvider): AIResponse {
    try {
      // Strip markdown code block markers (```json ... ``` or ```...```)
      let cleanedText = text
        .replace(/^\s*```(?:json)?\s*/i, '') // Remove opening ```json or ```
        .replace(/\s*```\s*$/i, '');           // Remove closing ```
      
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          intent: {
            action: parsed.intent?.action || 'general',
            parameters: parsed.intent?.parameters,
            confidence: parsed.intent?.confidence || 0.8,
          },
          message: parsed.message || text,
          reasoning: parsed.reasoning,
          provider,
        };
      }
    } catch {
      // JSON parsing failed
    }

    return {
      intent: { action: 'general', confidence: 0.5 },
      message: text,
      provider,
    };
  }
}

// Re-export for compatibility
export { AIMessage as ClaudeMessage, AIIntent as ClaudeIntent, AIResponse as ClaudeResponse };
