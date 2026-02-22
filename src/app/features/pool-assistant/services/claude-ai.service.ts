import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../../../environments/environment';

// ── Types ───────────────────────────────────────────────────────────

export type AIProvider = 'groq' | 'claude' | 'demo';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIIntent {
  action: 'validate' | 'build-pool' | 'filter' | 'show-rules' | 'explain-rule' | 'summary' | 'show-ineligible' | 'help' | 'load-sample' | 'general';
  parameters?: Record<string, any>;
  confidence: number;
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

// ── Demo Mode Response Templates ────────────────────────────────────

const DEMO_RESPONSES: Record<AIIntent['action'], (ctx?: any, params?: any) => string> = {
  'validate': (ctx) => {
    if (!ctx?.loanCount) return "I'll run eligibility validation once you upload loan data. Try 'load sample' to get started with demo loans.";
    return `Running validation against 11 MortgageMax eligibility rules for ${ctx.loanCount} loans. I'll check interest rates, balances, property types, loan age, and pool assignments.`;
  },
  'build-pool': (ctx) => {
    if (!ctx?.eligibleCount) return "Let's validate the loans first to identify eligible candidates. Type 'validate' to run eligibility checks.";
    return `Building a compliant pool from ${ctx.eligibleCount} eligible loans. I'll calculate weighted average coupon, net yield, and verify pool composition requirements.`;
  },
  'filter': (ctx, params) => {
    const criteria = params?.criteria || params?.filterCriteria || 'your specified criteria';
    if (!ctx?.loanCount) return "Upload loan data first, then I can filter by rate, UPB, property type, age, status, or any combination.";
    return `Filtering ${ctx.loanCount} loans based on ${criteria}. I'll show matching loans that meet your criteria.`;
  },
  'show-rules': () => `Here are the 11 MortgageMax eligibility rules I enforce:

**Rate Rules:**
• RATE-001: Interest rate must be >0% and ≤12%
• RATE-002: Coupon rate ≤ interest rate
• RATE-003: Net yield between 0 and coupon rate

**Balance Rules:**
• BAL-001: UPB must be positive
• BAL-002: Investor balance ≤ UPB
• BAL-003: Conforming limit $766,550 (2025)

**Property & Status:**
• PROP-001: Eligible types: SF, CO, CP, PU, MH, 2-4
• STATUS-001: Active status (A or C)

**Pool Requirements:**
• AGE-001: Minimum 4 months seasoning
• POOL-001: Pool number assigned
• PREFIX-001: Valid MBS prefix (FG, FH, FN)`,

  'explain-rule': (ctx, params) => {
    const ruleId = params?.ruleId?.toUpperCase() || '';
    const explanations: Record<string, string> = {
      'RATE-001': `**RATE-001: Interest Rate Range**\nThe note rate must be greater than 0% and not exceed 12%. This ensures loans have reasonable rates for MBS investors.`,
      'RATE-002': `**RATE-002: Coupon vs Interest Rate**\nThe pool coupon rate cannot exceed the loan's interest rate. The difference (servicing spread) compensates the servicer.`,
      'RATE-003': `**RATE-003: Net Yield Range**\nNet yield must be ≥0 and ≤ coupon rate. Net yield = coupon minus guarantee fee.`,
      'BAL-001': `**BAL-001: Positive UPB**\nUnpaid Principal Balance must be greater than $0. Zero or negative balances indicate paid-off loans.`,
      'BAL-002': `**BAL-002: Investor Balance**\nCurrent investor balance cannot exceed UPB. The investor owns at most 100% of the loan.`,
      'BAL-003': `**BAL-003: Conforming Loan Limit**\nUPB cannot exceed $766,550 (2025 limit for most areas).`,
      'PROP-001': `**PROP-001: Property Type**\nEligible property types: SF (Single Family), CO (Condo), CP (Co-op), PU (PUD), MH (Manufactured Housing), 2-4 (2-4 Unit).`,
      'STATUS-001': `**STATUS-001: Active Status**\nLoan status must be Active (A) or Current (C). Delinquent loans are ineligible.`,
      'AGE-001': `**AGE-001: Minimum Age**\nLoans must be at least 4 months old (seasoned).`,
      'POOL-001': `**POOL-001: Pool Assignment**\nLoans must have an assigned pool number for delivery.`,
      'PREFIX-001': `**PREFIX-001: MBS Prefix**\nValid prefixes: FG (Gold PC), FH (ARM), FN (Fixed Rate).`,
    };
    return explanations[ruleId] || `I can explain any of these rules: RATE-001, RATE-002, RATE-003, BAL-001, BAL-002, BAL-003, PROP-001, STATUS-001, AGE-001, POOL-001, PREFIX-001.`;
  },

  'summary': (ctx) => {
    if (!ctx?.loanCount) return "No loans loaded yet. Upload a CSV/JSON file or type 'load sample' to see summary metrics.";
    const eligible = ctx.eligibleCount ?? 'unknown';
    const ineligible = ctx.ineligibleCount ?? 'unknown';
    return `**Portfolio Summary:**\n• Total loans: ${ctx.loanCount}\n• Eligible: ${eligible}\n• Ineligible: ${ineligible}\n• Validation status: ${ctx.hasValidationResults ? 'Complete' : 'Pending'}\n\nType 'validate' for detailed eligibility analysis.`;
  },

  'show-ineligible': (ctx) => {
    if (!ctx?.hasValidationResults) return "Run validation first to identify ineligible loans. Type 'validate' to start.";
    if (ctx.ineligibleCount === 0) return "All loans passed eligibility checks! You can proceed to build a pool.";
    return `Found ${ctx.ineligibleCount} ineligible loans. I'll display them with their specific rule violations.`;
  },

  'help': () => `**Loan Pool Advisor Commands:**

📂 **Data Management:**
• \`load sample\` - Load demo loan data
• \`upload\` - Upload CSV or JSON file
• \`clear\` - Clear current session

✅ **Validation:**
• \`validate\` - Run eligibility checks
• \`show ineligible\` - View failed loans
• \`show rules\` - List all rules
• \`explain rule [ID]\` - Rule details

📊 **Analysis:**
• \`summary\` - Portfolio metrics
• \`filter [criteria]\` - Find specific loans
• \`build pool\` - Construct compliant pool

💡 Or just ask naturally - I understand questions like "which loans failed?" or "what's wrong with the rates?"`,

  'load-sample': () => "Loading sample loan portfolio with 15 diverse loans including some intentional rule violations for testing.",

  'general': (ctx) => {
    if (!ctx?.loanCount) {
      return "I'm your Loan Pool Advisor. I help validate loans against MortgageMax guidelines and build compliant pools. Start by typing 'load sample' or uploading your loan data.";
    }
    return "I'm analyzing your question. Could you be more specific? I can validate loans, explain rules, filter data, or help build pools.";
  },
};

// ── System Prompt (for live API modes) ──────────────────────────────

const LOAN_ADVISOR_SYSTEM_PROMPT = `You are Loan Pool Advisor, an AI assistant specialized in MortgageMax mortgage loan validation and pool construction.

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
- User wants to filter/find/search loans → action: "filter" (include filter criteria in parameters)
- User asks about rules/eligibility requirements → action: "show-rules"
- User asks to explain a specific rule → action: "explain-rule" (include ruleId in parameters)
- User asks for summary/metrics → action: "summary"
- User asks about failed/ineligible loans → action: "show-ineligible"
- User asks for help/commands → action: "help"
- User wants sample/demo data → action: "load-sample"
- General questions about loans/guidelines → action: "general"

## Guidelines
- Be concise but thorough
- Reference specific rule IDs when discussing eligibility
- If unsure, ask clarifying questions
- Never make up loan data - only analyze what's provided
- Suggest next steps when appropriate`;

// ── Provider Display Names ──────────────────────────────────────────

export const PROVIDER_INFO: Record<AIProvider, { name: string; description: string; icon: string }> = {
  groq: { 
    name: 'Groq', 
    description: 'Free, ultra-fast LLaMA 3.1 70B', 
    icon: '⚡' 
  },
  claude: { 
    name: 'Claude', 
    description: 'Anthropic Claude Sonnet (paid)', 
    icon: '🧠' 
  },
  demo: { 
    name: 'Demo', 
    description: 'Offline pattern matching', 
    icon: '🎯' 
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
  
  // Current provider - defaults to Groq (free), persisted to localStorage
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
    if (p === 'demo') return true;
    if (p === 'groq') return this.groqApiKey() !== '';
    if (p === 'claude') return this.claudeApiKey() !== '' || (environment.ai?.claude?.proxyUrl ?? '') !== '';
    return false;
  });

  // Legacy compatibility
  readonly demoMode = computed(() => this.provider() === 'demo');
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

  enableDemoMode(): void {
    this.setProvider('demo');
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
    context?: {
      loanCount?: number;
      eligibleCount?: number;
      ineligibleCount?: number;
      hasValidationResults?: boolean;
    }
  ): Promise<AIResponse> {
    if (!this.isEnabled()) {
      return this.buildDemoResponse(userInput, context);
    }

    const currentProvider = this.provider();

    // Demo mode: use smart local classification
    if (currentProvider === 'demo') {
      await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 200));
      return this.buildDemoResponse(userInput, context);
    }

    // Live mode: call appropriate API
    try {
      // Build context message
      let contextMsg = '';
      if (context) {
        const parts: string[] = [];
        if (context.loanCount !== undefined) {
          parts.push(`${context.loanCount} loans loaded`);
        }
        if (context.hasValidationResults && context.eligibleCount !== undefined) {
          parts.push(`${context.eligibleCount} eligible, ${context.ineligibleCount} ineligible`);
        }
        if (parts.length > 0) {
          contextMsg = `\n\n[Context: ${parts.join('; ')}]`;
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
      // Fall back to demo mode on API errors
      return this.buildDemoResponse(userInput, context);
    }
  }

  // ── Groq API Call ─────────────────────────────────────────────────

  private async callGroqAPI(): Promise<AIResponse> {
    const apiKey = this.groqApiKey();
    
    if (!apiKey) {
      throw new Error('Groq API key not configured. Get a free key at console.groq.com');
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
      const jsonMatch = text.match(/\{[\s\S]*\}/);
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

  // ── Demo Mode Classification ──────────────────────────────────────

  private buildDemoResponse(input: string, context?: any): AIResponse {
    const lower = input.toLowerCase().trim();
    
    const ruleMatch = lower.match(/\b(rate|bal|prop|status|age|pool|prefix)-?0*(\d+)\b/i) 
                   || lower.match(/\brule\s+(rate|bal|prop|status|age|pool|prefix)[\s-]?0*(\d+)/i);
    const ruleId = ruleMatch ? `${ruleMatch[1].toUpperCase()}-00${ruleMatch[2]}`.replace(/0+(\d{3})/, '$1') : null;
    
    const filterCriteria = this.extractFilterCriteria(lower);
    
    let action: AIIntent['action'] = 'general';
    let confidence = 0.85;
    let parameters: Record<string, any> = {};

    if (/^(validate|check eligibility|run validation|verify loans?)$/i.test(lower)) {
      action = 'validate';
      confidence = 0.98;
    }
    else if (/^(build pool|create pool|construct pool)$/i.test(lower)) {
      action = 'build-pool';
      confidence = 0.98;
    }
    else if (/^(show rules?|list rules?|what are the rules?)$/i.test(lower)) {
      action = 'show-rules';
      confidence = 0.98;
    }
    else if (/^(help|commands?|what can you do)$/i.test(lower)) {
      action = 'help';
      confidence = 0.98;
    }
    else if (/^(load sample|sample data|demo data|load demo)$/i.test(lower)) {
      action = 'load-sample';
      confidence = 0.98;
    }
    else if (/^(summary|show summary|portfolio summary|metrics)$/i.test(lower)) {
      action = 'summary';
      confidence = 0.98;
    }
    else if (/validate|check.*eligib|verify.*loan|run.*check|eligibility\s*check/.test(lower)) {
      action = 'validate';
      confidence = 0.90;
    }
    else if (/build.*pool|construct.*pool|create.*pool|make.*pool|pool.*build/.test(lower)) {
      action = 'build-pool';
      confidence = 0.90;
    }
    else if (/explain.*rule|what.*is.*rule|tell.*about.*rule|rule.*mean|how.*does.*rule/.test(lower) || ruleId) {
      action = 'explain-rule';
      confidence = ruleId ? 0.95 : 0.80;
      if (ruleId) parameters['ruleId'] = ruleId;
    }
    else if (/show.*rule|list.*rule|what.*rule|all.*rule|rules\?/.test(lower)) {
      action = 'show-rules';
      confidence = 0.88;
    }
    else if (/ineligible|failed|rejected|didn.?t pass|violations?|what.*wrong|which.*fail/.test(lower)) {
      action = 'show-ineligible';
      confidence = 0.88;
    }
    else if (/filter|find.*loan|search|show.*loan|loans?\s*with|loans?\s*where|which\s*loans?/.test(lower)) {
      action = 'filter';
      confidence = 0.85;
      if (filterCriteria) parameters['criteria'] = filterCriteria;
    }
    else if (/summary|overview|metrics|statistics|how\s*many|total|count/.test(lower)) {
      action = 'summary';
      confidence = 0.85;
    }
    else if (/help|command|how\s*to|what\s*can|usage|guide/.test(lower)) {
      action = 'help';
      confidence = 0.85;
    }
    else if (/sample|demo|test\s*data|example|load\s*data/.test(lower)) {
      action = 'load-sample';
      confidence = 0.85;
    }
    else if (/^(hi|hello|hey|good\s*(morning|afternoon|evening))/.test(lower)) {
      action = 'help';
      confidence = 0.70;
    }
    else {
      confidence = 0.50;
    }

    const responseGenerator = DEMO_RESPONSES[action];
    const message = responseGenerator ? responseGenerator(context, parameters) : '';

    return {
      intent: { 
        action, 
        confidence,
        parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
      },
      message,
      reasoning: `Demo mode: Classified as "${action}" with ${(confidence * 100).toFixed(0)}% confidence`,
      provider: 'demo',
    };
  }

  private extractFilterCriteria(input: string): string | null {
    const patterns = [
      /rate\s*(>|<|>=|<=|=|over|under|above|below|between)\s*(\d+\.?\d*)/i,
      /upb\s*(>|<|>=|<=|=|over|under|above|below)\s*\$?(\d+[\d,]*)/i,
      /property\s*type\s*(=|is|:)?\s*(sf|co|cp|pu|mh|2-4)/i,
      /age\s*(>|<|>=|<=|=|over|under|above|below)\s*(\d+)/i,
      /status\s*(=|is|:)?\s*([ac])/i,
      /(single\s*family|condo|manufactured|pud)/i,
    ];
    
    const matches: string[] = [];
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        matches.push(match[0]);
      }
    }
    
    return matches.length > 0 ? matches.join(', ') : null;
  }
}

// Re-export for compatibility
export { AIMessage as ClaudeMessage, AIIntent as ClaudeIntent, AIResponse as ClaudeResponse };
