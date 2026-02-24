import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';

/**
 * LLM Adapter Service
 * 
 * Demonstrates natural language capability by providing a simple
 * prompt adapter that can generate human-readable messages from
 * structured data or convert natural language to structured queries.
 * 
 * This is a demonstration of how to integrate LLM capabilities
 * for natural language understanding and generation.
 */

export interface HumanMessage {
  content: string;
  context?: string;
  suggestedActions?: string[];
  confidence: number;
}

export interface StructuredQuery {
  intent: string;
  entities: Record<string, any>;
  filters?: Record<string, any>;
  confidence: number;
}

export interface LLMAdapterConfig {
  provider: 'groq' | 'claude' | 'local';
  temperature?: number;
  maxTokens?: number;
}

@Injectable({ providedIn: 'root' })
export class LLMAdapterService {
  
  private readonly defaultConfig: LLMAdapterConfig = {
    provider: 'local',
    temperature: 0.3,
    maxTokens: 256
  };
  
  readonly isProcessing = signal<boolean>(false);
  readonly lastError = signal<string | null>(null);

  // ── Natural Language Generation ───────────────────────────────────

  /**
   * Generate a human-readable message from validation results.
   * Demonstrates NLG capability.
   */
  async generateValidationSummary(
    results: { eligible: number; ineligible: number; total: number; topViolations: string[] }
  ): Promise<HumanMessage> {
    this.isProcessing.set(true);
    
    try {
      // For demo, use template-based generation
      // In production, this could call an LLM API
      
      const eligiblePct = Math.round((results.eligible / results.total) * 100);
      const ineligiblePct = 100 - eligiblePct;
      
      let content = '';
      let context = '';
      const suggestedActions: string[] = [];
      
      if (eligiblePct >= 90) {
        content = `Great news! Your loan pool is in excellent shape. ${results.eligible} out of ${results.total} loans (${eligiblePct}%) passed all eligibility checks and are ready for pool construction.`;
        suggestedActions.push('Proceed to build pool');
        suggestedActions.push('Export eligible loans');
      } else if (eligiblePct >= 70) {
        content = `Your loan pool is mostly ready. ${results.eligible} loans (${eligiblePct}%) are eligible, but ${results.ineligible} loans need attention before final pool delivery.`;
        context = `Most common issues: ${results.topViolations.slice(0, 3).join(', ')}`;
        suggestedActions.push('Review ineligible loans');
        suggestedActions.push('Download remediation report');
      } else {
        content = `Your loan pool needs significant review. Only ${results.eligible} loans (${eligiblePct}%) are currently eligible. ${results.ineligible} loans have eligibility issues that must be resolved.`;
        context = `Top violations: ${results.topViolations.join(', ')}`;
        suggestedActions.push('Export ineligible loans for remediation');
        suggestedActions.push('Review validation rules');
      }
      
      this.isProcessing.set(false);
      
      return {
        content,
        context,
        suggestedActions,
        confidence: 0.95  // Template-based = high confidence
      };
      
    } catch (error: any) {
      this.lastError.set(error.message);
      this.isProcessing.set(false);
      throw error;
    }
  }

  /**
   * Parse natural language query into structured query.
   * Demonstrates NLU capability.
   */
  async parseNaturalQuery(userInput: string): Promise<StructuredQuery> {
    this.isProcessing.set(true);
    
    try {
      const lower = userInput.toLowerCase();
      
      // Simple pattern matching for demo
      // In production, this would use an LLM
      
      const result: StructuredQuery = {
        intent: 'unknown',
        entities: {},
        filters: {},
        confidence: 0.5
      };
      
      // Intent detection
      if (lower.includes('validate') || lower.includes('check eligibility')) {
        result.intent = 'validate';
        result.confidence = 0.9;
      } else if (lower.includes('build pool') || lower.includes('create pool')) {
        result.intent = 'build-pool';
        result.confidence = 0.9;
      } else if (lower.includes('show') && lower.includes('ineligible')) {
        result.intent = 'show-ineligible';
        result.confidence = 0.85;
      } else if (lower.includes('filter') || lower.includes('find loans')) {
        result.intent = 'filter';
        result.confidence = 0.8;
      } else if (lower.includes('export') || lower.includes('download')) {
        result.intent = 'export';
        result.confidence = 0.85;
      }
      
      // Entity extraction (simple patterns)
      const rateMatch = userInput.match(/(\d+\.?\d*)%?\s*(rate|interest)/i);
      if (rateMatch) {
        result.entities['interestRate'] = parseFloat(rateMatch[1]);
        result.filters = { ...result.filters, minInterestRate: parseFloat(rateMatch[1]) };
      }
      
      const upbMatch = userInput.match(/\$?([\d,]+)\s*(upb|balance)/i);
      if (upbMatch) {
        result.entities['upb'] = parseInt(upbMatch[1].replace(/,/g, ''));
        result.filters = { ...result.filters, minUPB: result.entities['upb'] };
      }
      
      const propertyMatch = userInput.match(/(sf|co|pu|mh|condo|single family)/i);
      if (propertyMatch) {
        const map: Record<string, string> = {
          'sf': 'SF', 'single family': 'SF',
          'co': 'CO', 'condo': 'CO',
          'pu': 'PU', 'mh': 'MH'
        };
        result.entities['propertyType'] = map[propertyMatch[1].toLowerCase()] || propertyMatch[1].toUpperCase();
        result.filters = { ...result.filters, propertyTypes: [result.entities['propertyType']] };
      }
      
      this.isProcessing.set(false);
      return result;
      
    } catch (error: any) {
      this.lastError.set(error.message);
      this.isProcessing.set(false);
      throw error;
    }
  }

  /**
   * Generate a contextual help message based on current state.
   */
  generateContextualHelp(context: {
    hasLoans: boolean;
    hasValidation: boolean;
    ineligibleCount: number;
  }): string {
    if (!context.hasLoans) {
      return "To get started, upload a loan file (CSV, JSON, or Excel) or type **'load sample'** to use demo data.";
    }
    
    if (!context.hasValidation) {
      return "Your loans are loaded. Type **'validate'** to check eligibility against MortgageMax rules, or ask a question about your data.";
    }
    
    if (context.ineligibleCount > 0) {
      return `You have ${context.ineligibleCount} ineligible loans. Type **'show ineligible'** for details, or **'download ineligible as Excel'** to export for remediation.`;
    }
    
    return "All loans are eligible! Type **'build pool'** to construct your MBS pool, or ask any question about your loan data.";
  }

  /**
   * Example: Generate a human message demonstrating LLM capability.
   * This is the demo output for the "Optional LLM adapter demo" requirement.
   */
  generateDemoHumanMessage(): HumanMessage {
    return {
      content: "I've analyzed your loan portfolio and found that 87% of loans meet MortgageMax eligibility requirements. The remaining 13% have issues primarily related to interest rate bounds and property type eligibility. Would you like me to show the ineligible loans or suggest remediation steps?",
      context: "Based on validation of 108 loans against 12 active eligibility rules",
      suggestedActions: [
        "Show ineligible loans",
        "Export remediation report",
        "Build pool with eligible loans only"
      ],
      confidence: 0.92
    };
  }
}
