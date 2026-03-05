import { Injectable, signal, computed, inject } from '@angular/core';
import {
  ChatMessage,
  ChatSession,
  FileAttachment,
  LoanRecord,
  LoanValidationResult,
  PoolSummary,
  AgentStatus,
  LoanFilter,
  REQUIRED_LOAN_FIELDS,
  IneligibleLoanResult,
  RuleFailureSummary,
  EligibilityEvaluateResponse,
  PoolingBuildResponse,
} from '../models/pool-logic.model';
import { LoanValidationService } from './loan-validation.service';
import { EligibilityApiService } from './eligibility-api.service';
import { PoolingApiService } from './pooling-api.service';
import { ClaudeAIService, AIProvider, PROVIDER_INFO, LoanDataContext, LoanSample, LoanStats } from './claude-ai.service';
import { ExportService, ExportFormat } from './export.service';
import { BackendChatService } from './backend-chat.service';

@Injectable({ providedIn: 'root' })
export class PoolLogicChatService {
  private readonly validationService = inject(LoanValidationService);
  private readonly eligibilityApi = inject(EligibilityApiService);
  private readonly poolingApi = inject(PoolingApiService);
  private readonly claudeService = inject(ClaudeAIService);
  private readonly exportService = inject(ExportService);
  private readonly backendChat = inject(BackendChatService);

  // Backend session ID for conversation continuity
  private backendSessionId: string | null = null;

  // ── AI Mode ───────────────────────────────────────────────────────
  readonly aiModeEnabled = computed(() => this.claudeService.isEnabled());
  readonly aiConfigured = computed(() => this.claudeService.isConfigured());
  readonly aiError = computed(() => this.claudeService.lastError());
  readonly aiProvider = computed(() => this.claudeService.provider());
  readonly aiProviderInfo = computed(() => this.claudeService.providerInfo());
  readonly aiModeLabel = computed(() => this.claudeService.aiModeLabel());

  private static readonly SESSIONS_KEY = 'poollogic_sessions';
  private static readonly ACTIVE_SESSION_KEY = 'poollogic_active_session';

  // ── Session State ─────────────────────────────────────────────────
  readonly sessions = signal<ChatSession[]>([]);
  readonly activeSessionId = signal<string>('');

  readonly activeSession = computed(() => {
    const id = this.activeSessionId();
    return this.sessions().find(s => s.id === id) ?? null;
  });

  // Computed views into active session
  readonly messages = computed(() => this.activeSession()?.messages ?? []);
  readonly uploadedLoans = computed(() => this.activeSession()?.uploadedLoans ?? []);
  readonly validationResults = computed(() => this.activeSession()?.validationResults ?? []);
  readonly currentPoolSummary = computed(() => this.activeSession()?.poolSummary ?? null);

  readonly agentStatus = signal<AgentStatus>({ state: 'idle', progress: 0, currentStep: '' });

  readonly isProcessing = computed(() => {
    const state = this.agentStatus().state;
    return state !== 'idle' && state !== 'complete' && state !== 'error';
  });

  private messageIdCounter = 0;

  constructor() {
    this.restoreSessions();
  }

  // ── Session Management ────────────────────────────────────────────

  createSession(name?: string): string {
    const id = `session-${Date.now()}`;
    const sessionName = name || `Session ${this.sessions().length + 1}`;
    const newSession: ChatSession = {
      id,
      name: sessionName,
      createdAt: new Date(),
      messages: [],
      uploadedLoans: [],
      validationResults: [],
      poolSummary: null,
    };
    this.sessions.update(s => [...s, newSession]);
    this.activeSessionId.set(id);
    this.addSystemWelcome();
    this.saveSessions();
    return id;
  }

  switchSession(id: string): void {
    const session = this.sessions().find(s => s.id === id);
    if (session) {
      this.activeSessionId.set(id);
      this.saveSessions();
    }
  }

  deleteSession(id: string): void {
    const allSessions = this.sessions();
    if (allSessions.length <= 1) return; // keep at least one session

    this.sessions.update(s => s.filter(sess => sess.id !== id));

    if (this.activeSessionId() === id) {
      const remaining = this.sessions();
      this.activeSessionId.set(remaining[0].id);
    }
    this.saveSessions();
  }

  renameSession(id: string, name: string): void {
    this.sessions.update(s =>
      s.map(sess => sess.id === id ? { ...sess, name: name.trim() || sess.name } : sess)
    );
    this.saveSessions();
  }

  // ── Active Session Updates ────────────────────────────────────────

  private updateActiveSession(updater: (session: ChatSession) => ChatSession): void {
    const activeId = this.activeSessionId();
    this.sessions.update(list =>
      list.map(s => s.id === activeId ? updater(s) : s)
    );
    this.saveSessions();
  }

  private setMessages(messages: ChatMessage[]): void {
    this.updateActiveSession(s => ({ ...s, messages }));
  }

  private setUploadedLoans(loans: LoanRecord[]): void {
    console.log('[DEBUG] setUploadedLoans called with', loans.length, 'loans');
    this.updateActiveSession(s => ({ ...s, uploadedLoans: loans }));
    console.log('[DEBUG] After update - uploadedLoans:', this.uploadedLoans().length);
  }

  private setValidationResults(results: LoanValidationResult[]): void {
    this.updateActiveSession(s => ({ ...s, validationResults: results }));
  }

  private setPoolSummary(summary: PoolSummary | null): void {
    this.updateActiveSession(s => ({ ...s, poolSummary: summary }));
  }

  // ── Public API ────────────────────────────────────────────────────

  async sendMessage(content: string): Promise<void> {
    const userMsg = this.createMessage('user', content);
    this.appendMessage(userMsg);
    
    // Handle retry command - user wants to reconnect to backend
    if (content.toLowerCase().trim() === 'retry') {
      await this.retryBackendConnection();
      return;
    }
    
    await this.processUserInput(content);
  }

  async handleFileUpload(file: File): Promise<void> {
    const fileType = this.getFileType(file.name);
    const attachment: FileAttachment = {
      name: file.name,
      size: file.size,
      type: fileType,
      status: 'uploading',
    };

    const userMsg = this.createMessage('user', `Uploaded file: **${file.name}**`, [attachment]);
    this.appendMessage(userMsg);

    this.updateAgentStatus('parsing', 10, `Reading ${file.name}...`);

    try {
      if (fileType !== 'csv' && fileType !== 'json' && fileType !== 'xlsx') {
        attachment.status = 'error';
        attachment.errorMessage = 'Unsupported file format. Please upload a CSV, JSON, or Excel file.';
        this.appendAssistantMessage(`I'm unable to parse **${file.name}**. Currently supported formats are CSV, JSON, and Excel (.xlsx, .xls). Please convert your file and try again.`);
        this.updateAgentStatus('idle', 0, '');
        return;
      }

      let result;
      if (fileType === 'xlsx') {
        const buffer = await file.arrayBuffer();
        result = this.validationService.parseXLSX(buffer);
      } else {
        const text = await file.text();
        result = fileType === 'csv'
          ? this.validationService.parseCSV(text)
          : this.validationService.parseJSON(text);
      }

      if (!result.ok) {
        attachment.status = 'error';
        attachment.errorMessage = result.error.message;

        let errorMsg = `I parsed **${file.name}** but encountered an error:\n\n`;
        errorMsg += `**${result.error.message}**\n\n`;
        if (result.error.missingFields.length > 0) {
          errorMsg += `The following required fields were not found:\n`;
          result.error.missingFields.forEach(f => { errorMsg += `- **${f}**\n`; });
          errorMsg += `\nPlease ensure your file contains columns for: ${[...REQUIRED_LOAN_FIELDS].join(', ')}`;
        }
        this.appendAssistantMessage(errorMsg);
        this.updateAgentStatus('idle', 0, '');
        return;
      }

      const loans = result.loans;
      if (loans.length === 0) {
        attachment.status = 'error';
        attachment.errorMessage = 'No valid loan records found in the file.';
        this.appendAssistantMessage(`I parsed **${file.name}** but couldn't find any valid loan records. Please ensure the file contains the required columns (${[...REQUIRED_LOAN_FIELDS].join(', ')}) and try again.`);
        this.updateAgentStatus('idle', 0, '');
        return;
      }

      attachment.status = 'parsed';
      attachment.loanCount = loans.length;
      this.setUploadedLoans(loans);

      this.updateAgentStatus('parsing', 100, 'File parsed successfully');

      let previewMsg = `Successfully parsed **${file.name}** — **${loans.length} loan records** identified.\n\n`;

      // Build a complete table of all loans
      previewMsg += `### All Uploaded Loans (${loans.length} records)\n\n`;
      previewMsg += `| # | Loan # | Pool | Prefix | Rate | Coupon | UPB | Age | Status | Rate Type | Property |\n`;
      previewMsg += `|---|---|---|---|---|---|---|---|---|---|---|\n`;
      loans.forEach((l, i) => {
        previewMsg += `| ${i + 1} | ${l.loanNumber} | ${l.poolNumber || 'N/A'} | ${l.mbsPoolPrefix || '-'} | ${l.interestRate}% | ${l.couponRate}% | $${l.upb.toLocaleString()} | ${l.loanAgeMonths}mo | ${l.loanStatusCode || '-'} | ${l.rateTypeCode || '-'} | ${l.propertyType || '-'} |\n`;
      });

      previewMsg += `\nWhat would you like me to do next?\n` +
        `- **Validate all loans** against MortgageMax eligibility rules\n` +
        `- **Filter loans** by specific criteria (rate, UPB, property type, etc.)\n` +
        `- **Build a pool** with only eligible loans`;

      this.appendAssistantMessage(previewMsg);

      this.updateAgentStatus('idle', 0, '');
    } catch (err) {
      attachment.status = 'error';
      attachment.errorMessage = 'Failed to read the file.';
      this.appendAssistantMessage(`An error occurred while reading **${file.name}**. Please ensure the file is not corrupted and try again.`);
      this.updateAgentStatus('error', 0, 'File read failed');
    }
  }

  loadSampleData(): void {
    const loans = this.validationService.getSampleLoans();
    this.setUploadedLoans(loans);

    this.appendMessage(this.createMessage('user', 'Load sample loan data for demonstration'));
    this.appendAssistantMessage(
      `Loaded **${loans.length} sample loan records** for demonstration.\n\n` +
      `The sample set includes a mix of pool assignments, rate types, and potential eligibility issues. ` +
      `You can now:\n` +
      `- Type **"validate"** to run eligibility checks\n` +
      `- Type **"build pool"** to construct a pool with eligible loans\n` +
      `- Type **"show rules"** to view all eligibility rules\n` +
      `- Ask me any question about the loans or MortgageMax guidelines`
    );
  }

  clearChat(): void {
    this.setMessages([]);
    this.setUploadedLoans([]);
    this.setValidationResults([]);
    this.setPoolSummary(null);
    this.updateAgentStatus('idle', 0, '');
    
    // Stop any background polling
    this.stopBackendHealthPolling();
    
    // Clear backend session for fresh conversation
    if (this.backendSessionId) {
      this.backendChat.clearSession(this.backendSessionId).catch(() => {});
      this.backendSessionId = null;
    }
    
    this.addSystemWelcome();
  }

  // ── AI Mode Controls ──────────────────────────────────────────────

  enableAIMode(): void {
    this.claudeService.enable();
    const info = this.claudeService.providerInfo();
    this.appendAssistantMessage(
      `🤖 **AI Mode Enabled (${info.name})**\n\n` +
      `${info.icon} ${info.description}\n\n` +
      `I understand natural language! Ask questions conversationally.`
    );
  }

  disableAIMode(): void {
    this.claudeService.disable();
    this.claudeService.clearHistory();
    this.appendAssistantMessage(
      `**AI Mode Disabled**\n\n` +
      `AI conversation history cleared. Use commands like "validate", "build pool", "filter", etc.`
    );
  }

  setAIProvider(provider: AIProvider): void {
    const oldProvider = this.claudeService.provider();
    this.claudeService.setProvider(provider);
    const info = PROVIDER_INFO[provider];
    
    if (provider !== oldProvider) {
      if (provider === 'groq' && !this.claudeService.isConfigured()) {
        this.appendAssistantMessage(
          `${info.icon} **Switched to ${info.name}**\n\n` +
          `${info.description}\n\n` +
          `⚠️ API key required. Get a key at [console.groq.com](https://console.groq.com)`
        );
      } else if (provider === 'claude' && !this.claudeService.isConfigured()) {
        this.appendAssistantMessage(
          `${info.icon} **Switched to ${info.name}**\n\n` +
          `${info.description}\n\n` +
          `⚠️ API key required. This is a paid service.`
        );
      } else {
        this.appendAssistantMessage(
          `${info.icon} **Switched to ${info.name}**\n\n` +
          `${info.description}`
        );
      }
    }
  }

  setGroqApiKey(key: string): void {
    this.claudeService.setGroqApiKey(key);
    if (key) {
      this.appendAssistantMessage(
        `⚡ **Groq API Key Set**\n\n` +
        `Connected to Groq's ultra-fast LLaMA 3.1 70B.`
      );
    }
  }

  setClaudeApiKey(key: string): void {
    this.claudeService.setApiKey(key);
    if (key) {
      this.appendAssistantMessage(
        `✓ **API Key Configured**\n\n` +
        `Switched to Live mode. Claude API is ready.`
      );
    }
  }

  // ── Intent Processing ─────────────────────────────────────────────

  private async processUserInput(input: string): Promise<void> {
    // If welcome wasn't fetched, mark it as fetched (user is now interacting)
    // Don't trigger welcome again - just proceed with processing
    if (!this.welcomeFetched) {
      const isHealthy = await this.backendChat.checkHealth().catch(() => false);
      if (isHealthy) {
        this.stopBackendHealthPolling();
        this.welcomeFetched = true; // Mark as fetched without showing again
      }
    }
    
    // Always use AI (Groq or Claude) for intent classification
    await this.processWithClaude(input);
  }

  private async processWithClaude(input: string): Promise<void> {
    const providerInfo = this.claudeService.providerInfo();
    this.updateAgentStatus('validating', 10, `Processing with AI...`);

    // Build comprehensive context with loan data for AI
    const context = this.buildAIContext();

    try {
      // Send message to backend AI service (all AI interactions go through backend)
      const response = await this.backendChat.sendMessage({
        message: input,
        sessionId: this.backendSessionId || undefined,
        context: context,
      });

      // Store session ID for conversation continuity
      this.backendSessionId = response.sessionId;
      
      // If we got here, backend is working - mark welcome as complete
      if (!this.welcomeFetched) {
        this.stopBackendHealthPolling();
        this.welcomeFetched = true;
      }

      this.updateAgentStatus('idle', 0, '');

      // For intents where AI provides the complete response, use AI's message directly
      const aiMessageIntents = ['data-query', 'general', 'help', 'explain-rule', 'summary'];
      if (aiMessageIntents.includes(response.intent.action) && response.message) {
        this.appendAssistantMessage(response.message);
        return;
      }

      // For action intents (validate, build-pool, filter, etc.), the handlers create their own
      // formatted responses, so we don't show the AI message separately to avoid duplication
      await this.dispatchIntent(response.intent.action, input, response.intent.parameters);
    } catch (err: any) {
      this.updateAgentStatus('idle', 0, '');
      // Let AI generate error context when possible - pass error to backend for AI response
      const errorContext = err.message || 'Connection error';
      this.appendAssistantMessage(
        `I couldn't process that request. ${errorContext}\n\n` +
        `If the backend just started, try your request again in a moment.`
      );
    }
  }

  /** Build comprehensive context with loan data for AI analysis */
  private buildAIContext(): LoanDataContext {
    const loans = this.uploadedLoans();
    const validationResults = this.validationResults();
    
    const context: LoanDataContext = {
      loanCount: loans.length,
      eligibleCount: validationResults.filter(r => r.eligible).length,
      ineligibleCount: validationResults.filter(r => !r.eligible).length,
      hasValidationResults: validationResults.length > 0,
    };

    if (loans.length > 0) {
      // Convert all loans to samples for AI analysis
      context.allLoans = loans.map(loan => ({
        loanNumber: loan.loanNumber,
        poolNumber: loan.poolNumber || '',
        interestRate: loan.interestRate,
        couponRate: loan.couponRate,
        upb: loan.upb,
        loanAgeMonths: loan.loanAgeMonths,
        loanStatusCode: loan.loanStatusCode,
        propertyType: loan.propertyType,
        mbsPoolPrefix: loan.mbsPoolPrefix || '',
        specialCategory: loan.specialCategory || undefined,
      }));

      // Also provide first 10 as sample for quicker reference
      context.sampleLoans = context.allLoans.slice(0, 10);

      // Calculate statistics
      const totalUPB = loans.reduce((sum, l) => sum + l.upb, 0);
      const avgInterestRate = loans.reduce((sum, l) => sum + l.interestRate, 0) / loans.length;
      const avgCouponRate = loans.reduce((sum, l) => sum + l.couponRate, 0) / loans.length;
      const avgUPB = totalUPB / loans.length;
      const avgLoanAge = loans.reduce((sum, l) => sum + l.loanAgeMonths, 0) / loans.length;
      
      const propertyTypes = [...new Set(loans.map(l => l.propertyType))];
      const statusCodes = [...new Set(loans.map(l => l.loanStatusCode))];
      const prefixes = [...new Set(loans.map(l => l.mbsPoolPrefix).filter(Boolean))];

      context.stats = {
        avgInterestRate,
        avgCouponRate,
        avgUPB,
        avgLoanAge,
        totalUPB,
        propertyTypes,
        statusCodes,
        prefixes,
      };
    }

    return context;
  }

  private async dispatchIntent(
    action: string,
    originalInput: string,
    parameters?: Record<string, any>
  ): Promise<void> {
    switch (action) {
      case 'validate':
        await this.handleValidation();
        break;
      case 'build-pool':
        await this.handleBuildPool();
        break;
      case 'filter':
        // Use AI-generated filter parameters if available
        if (parameters?.['filter']) {
          await this.handleFilterWithParams(parameters['filter']);
        } else {
          await this.handleFilter(originalInput);
        }
        break;
      case 'data-query':
        // AI already analyzed the data and provided response in processWithClaude
        // This case should not be reached as data-query is handled before dispatch
        break;
      case 'show-rules':
        await this.handleShowRules();
        break;
      case 'explain-rule':
        // AI should have already provided the explanation in its message
        // No local fallback - all rule explanations come from backend AI
        break;
      case 'summary':
        this.handleShowSummary();
        break;
      case 'show-ineligible':
        this.handleShowIneligible();
        break;
      case 'download-ineligible':
        const format = parameters?.['format'] || this.parseExportFormat(originalInput) || 'csv';
        this.exportIneligibleLoans(format as ExportFormat);
        break;
      case 'help':
        // AI should have provided help in message; this is a fallback
        break;
      case 'load-sample':
        this.loadSampleData();
        break;
      default:
        // All responses should come from AI - no hardcoded fallback
        break;
    }
  }

  /** Handle filter with AI-generated parameters */
  private async handleFilterWithParams(filter: LoanFilter): Promise<void> {
    const loans = this.uploadedLoans();
    if (loans.length === 0) {
      this.appendAssistantMessage('No loan data is currently loaded. Please upload data first.');
      return;
    }

    this.updateAgentStatus('filtering', 50, 'Filtering via backend...');

    try {
      // Use backend filtering (all logic on server)
      const filterResult = await this.backendChat.filterLoans(loans, filter);
      
      this.updateAgentStatus('idle', 0, '');

      const appliedFilters = this.describeAppliedFilters(filter);

      let response = `## Filter Results\n\n`;
      if (appliedFilters.length > 0) {
        response += `**Active filters:** ${appliedFilters.join(' · ')}\n\n`;
      }
      response += `Applied filters to **${filterResult.originalCount} loans** — **${filterResult.filteredCount}** match your criteria.\n\n`;

      if (filterResult.filteredCount > 0 && filterResult.filteredCount <= 10) {
        response += `| Loan # | Pool | Prefix | Rate | Coupon | UPB | Age | Status | Property |\n`;
        response += `|---|---|---|---|---|---|---|---|---|\n`;
        filterResult.loans.forEach(l => {
          response += `| ${l.loanNumber} | ${l.poolNumber || 'N/A'} | ${l.mbsPoolPrefix || '-'} | ${l.interestRate}% | ${l.couponRate}% | $${l.upb.toLocaleString()} | ${l.loanAgeMonths}mo | ${l.loanStatusCode} | ${l.propertyType} |\n`;
        });
      } else if (filterResult.filteredCount > 10) {
        response += `Showing first 10 of ${filterResult.filteredCount} matches:\n\n`;
        response += `| Loan # | Pool | Rate | Coupon | UPB | Age | Status | Property |\n`;
        response += `|---|---|---|---|---|---|---|---|\n`;
        filterResult.loans.slice(0, 10).forEach(l => {
          response += `| ${l.loanNumber} | ${l.poolNumber || 'N/A'} | ${l.interestRate}% | ${l.couponRate}% | $${l.upb.toLocaleString()} | ${l.loanAgeMonths}mo | ${l.loanStatusCode} | ${l.propertyType} |\n`;
        });
      } else {
        response += `No loans match the specified criteria. Try broadening your filters.`;
      }

      this.appendAssistantMessage(response);
    } catch (error: any) {
      this.updateAgentStatus('idle', 0, '');
      this.appendAssistantMessage(`⚠️ **Filter Error**: ${error.message || 'Failed to filter loans'}`);
    }
  }

  // ── Intent Handlers ───────────────────────────────────────────────

  private async handleValidation(): Promise<void> {
    const loans = this.uploadedLoans();
    if (loans.length === 0) {
      this.appendAssistantMessage('No loan data is currently loaded. Please upload a CSV or JSON file, or type **"load sample"** to use demonstration data.');
      return;
    }

    this.updateAgentStatus('validating', 10, 'Validating loans via backend...');

    try {
      // Use backend validation (all rule evaluation on server)
      const validationResult = await this.backendChat.validateLoans(loans);
      
      this.updateAgentStatus('validating', 90, 'Processing results...');

      // Map backend response to local format
      const results = this.mapBackendToValidationResults(validationResult);
      const summary = this.mapBackendToPoolSummary(validationResult);

      this.setValidationResults(results);
      this.setPoolSummary(summary);

      // Use AI-generated message if available, otherwise build basic response
      let response: string;
      if (validationResult.aiMessage) {
        response = validationResult.aiMessage;
      } else {
        response = `## Validation Complete\n\n`;
        response += `Analyzed **${validationResult.summary.totalLoans} loans** against eligibility rules.\n\n`;
        response += `| Metric | Value |\n|---|---|\n`;
        response += `| Eligible Loans | **${validationResult.summary.eligibleCount}** |\n`;
        response += `| Ineligible Loans | **${validationResult.summary.ineligibleCount}** |\n`;
        response += `| Total UPB | **$${validationResult.summary.totalUPB.toLocaleString()}** |\n`;
        response += `| Eligible UPB | **$${validationResult.summary.eligibleUPB.toLocaleString()}** |\n\n`;
        response += `Type **"build pool"** to construct a pool with eligible loans.`;
      }

      const msg = this.createMessage('assistant', response);
      msg.loanResults = results;
      msg.poolSummary = summary;
      this.appendMessage(msg);

      this.updateAgentStatus('complete', 100, 'Validation complete');
      setTimeout(() => this.updateAgentStatus('idle', 0, ''), 2000);
    } catch (error: any) {
      this.updateAgentStatus('error', 0, 'Validation failed');
      this.appendAssistantMessage(`⚠️ **Validation Error**: ${error.message || 'Failed to validate loans'}`);
    }
  }

  /**
   * Map backend validation response to local LoanValidationResult[]
   */
  private mapBackendToValidationResults(response: import('./backend-chat.service').ValidationResponse): LoanValidationResult[] {
    const results: LoanValidationResult[] = [];

    // Add eligible loans
    response.eligibleLoans.forEach(loan => {
      results.push({
        loanNumber: loan.loanNumber,
        poolNumber: loan.poolNumber,
        eligible: true,
        violations: [],
        score: 100,
      });
    });

    // Add ineligible loans
    response.ineligibleLoans.forEach(il => {
      results.push({
        loanNumber: il.loanNumber,
        poolNumber: il.poolNumber,
        eligible: false,
        violations: il.failedRules.map(fr => ({
          rule: {
            ruleId: fr.ruleId,
            ruleName: fr.ruleName,
            category: fr.category as any,
            description: fr.explanation,
            guideReference: fr.guideReference,
          },
          actualValue: fr.actualValue,
          expectedValue: fr.expectedValue,
          severity: fr.severity,
          explanation: fr.explanation,
          recommendedAction: fr.recommendedAction,
        })),
        score: il.score,
      });
    });

    return results;
  }

  /**
   * Map backend validation response to local PoolSummary
   */
  private mapBackendToPoolSummary(response: import('./backend-chat.service').ValidationResponse): PoolSummary {
    return {
      totalLoans: response.summary.totalLoans,
      eligibleLoans: response.summary.eligibleCount,
      ineligibleLoans: response.summary.ineligibleCount,
      warningLoans: response.summary.warningCount || 0,
      totalUPB: response.summary.totalUPB,
      eligibleUPB: response.summary.eligibleUPB,
      weightedAvgRate: response.summary.weightedAvgRate,
      weightedAvgCoupon: response.summary.weightedAvgCoupon,
      weightedAvgAge: response.summary.weightedAvgAge,
      topViolations: response.summary.ruleFailures.map(rf => ({
        ruleName: rf.ruleName,
        count: rf.count,
      })),
    };
  }

  // Legacy handlers for backward compatibility - these now call the backend
  private async handleValidationLegacy(): Promise<void> {
    const loans = this.uploadedLoans();
    if (loans.length === 0) {
      this.appendAssistantMessage('No loan data is currently loaded. Please upload a CSV or JSON file, or type **"load sample"** to use demonstration data.');
      return;
    }

    // ── Load rules from API first ───────────────────────────────────
    this.updateAgentStatus('validating', 0, 'Loading validation rules...');
    await this.validationService.loadRules();

    this.updateAgentStatus('validating', 10, 'Calling eligibility API...');

    // ── Try remote API first ────────────────────────────────────────
    const apiResult = await this.eligibilityApi.evaluate(loans);

    if (apiResult.ok) {
      this.updateAgentStatus('validating', 90, 'Processing API response...');

      const apiData = apiResult.data;
      const results = this.mapApiToValidationResults(apiData);
      const summary = this.mapApiToPoolSummary(apiData);

      this.setValidationResults(results);
      this.setPoolSummary(summary);

      let response = `## Validation Complete  *(via API)*\n\n`;
      response += `Analyzed **${apiData.summary.totalLoans} loans** against MortgageMax eligibility rules.\n\n`;
      response += `| Metric | Value |\n|---|---|\n`;
      response += `| Eligible Loans | **${apiData.summary.eligibleCount}** (${Math.round(apiData.summary.eligibleCount / apiData.summary.totalLoans * 100)}%) |\n`;
      response += `| Ineligible Loans | **${apiData.summary.ineligibleCount}** (${Math.round(apiData.summary.ineligibleCount / apiData.summary.totalLoans * 100)}%) |\n`;
      response += `| Total UPB | **$${apiData.summary.totalUPB.toLocaleString()}** |\n`;
      response += `| Eligible UPB | **$${apiData.summary.eligibleUPB.toLocaleString()}** |\n`;
      response += `| WA Interest Rate | **${apiData.summary.weightedAvgRate}%** |\n`;
      response += `| WA Coupon Rate | **${apiData.summary.weightedAvgCoupon}%** |\n`;
      response += `| WA Loan Age | **${apiData.summary.weightedAvgAge} months** |\n\n`;

      if (apiData.ineligibleLoans.length > 0) {
        response += `### Ineligible Loans\n\n`;
        response += `| Loan # | Pool | Failures | Failed Rules |\n|---|---|---|---|\n`;
        apiData.ineligibleLoans.forEach(il => {
          const errors = il.failedRules.filter(fr => fr.severity === 'error');
          response += `| ${il.loanNumber} | ${il.poolNumber || 'N/A'} | ${errors.length} | ${errors.map(fr => fr.ruleName).join(', ')} |\n`;
        });
        response += `\n> Remove or correct the ${apiData.ineligibleLoans.length} ineligible loan(s) before pool construction.\n\n`;
      }

      if (apiData.summary.ruleFailures.length > 0) {
        response += `### Rule Failure Summary\n\n`;
        response += `| Rule | Rule ID | Occurrences |\n|---|---|---|\n`;
        apiData.summary.ruleFailures.forEach(rf => {
          response += `| ${rf.ruleName} | ${rf.ruleId} | ${rf.count} |\n`;
        });
        response += `\n`;
      }

      response += `Type **"build pool"** to construct a pool with eligible loans only, or **"show ineligible"** for detailed failure reasons.`;

      const msg = this.createMessage('assistant', response);
      msg.loanResults = results;
      msg.poolSummary = summary;
      this.appendMessage(msg);

      this.updateAgentStatus('complete', 100, 'Validation complete');
      setTimeout(() => this.updateAgentStatus('idle', 0, ''), 2000);
      return;
    }

    // API failed - no local fallback allowed
    console.error('Validation API unavailable');
    this.appendMessage(this.createMessage('assistant',
      `⚠️ **Validation Service Unavailable**\n\n` +
      `Unable to connect to the validation service. Please ensure the backend server is running and try again.\n\n` +
      `Contact your administrator if the problem persists.`
    ));
    this.updateAgentStatus('error', 0, 'Service unavailable');
  }

  private async handleBuildPool(): Promise<void> {
    const loans = this.uploadedLoans();
    if (loans.length === 0) {
      this.appendAssistantMessage('No loan data is currently loaded. Please upload data first.');
      return;
    }

    this.updateAgentStatus('building-pool', 10, 'Building pool via backend...');

    try {
      // Use backend pool building (all logic on server)
      const poolResult = await this.backendChat.buildPool(loans);
      
      this.updateAgentStatus('building-pool', 90, 'Processing results...');

      // Map to local pool summary
      const summary: PoolSummary = {
        totalLoans: loans.length,
        eligibleLoans: poolResult.eligibleCount,
        ineligibleLoans: poolResult.invalidLoans.length,
        warningLoans: 0,
        totalUPB: loans.reduce((sum, l) => sum + (l.upb || 0), 0),
        eligibleUPB: poolResult.notionalAmount,
        weightedAvgRate: poolResult.poolCoupon, // Approximate
        weightedAvgCoupon: poolResult.poolCoupon,
        weightedAvgAge: 0, // Not returned by backend in this endpoint
        topViolations: [],
      };
      this.setPoolSummary(summary);

      // Use AI-generated message if available
      let response: string;
      if (poolResult.aiMessage) {
        response = poolResult.aiMessage;
      } else {
        response = `## Pool Construction ${poolResult.status === 'CREATED' ? 'Complete' : poolResult.status}\n\n`;
        response += `| Pool Metric | Value |\n|---|---|\n`;
        response += `| Pool Type | **${poolResult.poolType}** |\n`;
        response += `| Notional Amount | **$${poolResult.notionalAmount.toLocaleString()}** |\n`;
        response += `| Status | **${poolResult.status}** |\n`;
        response += `| Pool Coupon | **${poolResult.poolCoupon}%** |\n`;
        response += `| Request ID | \`${poolResult.requestId}\` |\n\n`;

        if (poolResult.invalidLoans.length > 0) {
          response += `**${poolResult.invalidLoans.length} loan(s)** were excluded. Type **"show ineligible"** to review.\n`;
        }
      }

      const msg = this.createMessage('assistant', response);
      msg.poolSummary = summary;
      this.appendMessage(msg);

      this.updateAgentStatus('complete', 100, 'Pool built');
      setTimeout(() => this.updateAgentStatus('idle', 0, ''), 2000);
    } catch (error: any) {
      this.updateAgentStatus('error', 0, 'Pool building failed');
      this.appendAssistantMessage(`⚠️ **Pool Build Error**: ${error.message || 'Failed to build pool'}`);
    }
  }

  // Legacy handleBuildPool for backward compatibility
  private async handleBuildPoolLegacy(): Promise<void> {
    const loans = this.uploadedLoans();
    if (loans.length === 0) {
      this.appendAssistantMessage('No loan data is currently loaded. Please upload data first.');
      return;
    }

    let results = this.validationResults();
    if (results.length === 0) {
      this.appendAssistantMessage('Please run **validate** first before building a pool.');
      this.updateAgentStatus('idle', 0, '');
      return;
    }

    this.updateAgentStatus('building-pool', 0, 'Calling pooling API...');

    // Derive a target coupon from the WA coupon of eligible loans
    const eligible = results.filter(r => r.eligible);
    const eligibleLoans = loans.filter(l => eligible.some(e => e.loanNumber === l.loanNumber));
    const eligibleUPB = eligibleLoans.reduce((sum, l) => sum + l.upb, 0);
    const targetCoupon = eligibleUPB > 0
      ? Math.round(eligibleLoans.reduce((sum, l) => sum + l.couponRate * l.upb, 0) / eligibleUPB * 1000) / 1000
      : 0;
    const requestId = `REQ-${Date.now()}`;

    // ── Try remote pooling API first ────────────────────────────────
    const apiResult = await this.poolingApi.build(requestId, targetCoupon);

    if (apiResult.ok) {
      this.updateAgentStatus('building-pool', 90, 'Processing pooling response...');

      const poolData = apiResult.data;
      const summary = this.validationService.buildPoolSummary(results, loans);
      this.setPoolSummary(summary);

      let response = `## Pool Construction Complete  *(via API)*\n\n`;
      response += `| Pool Metric | Value |\n|---|---|\n`;
      response += `| Pool Type | **${poolData.poolType}** |\n`;
      response += `| Notional Amount | **$${poolData.notionalAmount.toLocaleString()}** |\n`;
      response += `| Status | **${poolData.status}** |\n`;
      response += `| Target Coupon | **${targetCoupon}%** |\n`;
      response += `| Request ID | \`${requestId}\` |\n\n`;

      if (poolData.invalidLoans.length > 0) {
        response += `### Invalid Loans (${poolData.invalidLoans.length})\n\n`;
        response += `| Loan # | Pool | Severity | Rule | Explanation | Recommended Action |\n|---|---|---|---|---|---|\n`;
        poolData.invalidLoans.forEach(il => {
          il.failedRules.forEach(fr => {
            const icon = fr.severity === 'error' ? '❌' : '⚠️';
            response += `| ${il.loanNumber} | ${il.poolNumber || 'N/A'} | ${icon} ${fr.severity} | ${fr.ruleName} (${fr.ruleId}) | ${fr.explanation} | ${fr.recommendedAction || '—'} |\n`;
          });
        });
        response += `\n> Remove or correct the invalid loans and rebuild the pool.\n\n`;
      }

      response += `The pool has been submitted and is ready for delivery considerations. `;
      response += `You may further **filter** loans or ask about specific **rules** that apply.`;

      const msg = this.createMessage('assistant', response);
      msg.poolSummary = summary;
      this.appendMessage(msg);

      this.updateAgentStatus('complete', 100, 'Pool built');
      setTimeout(() => this.updateAgentStatus('idle', 0, ''), 2000);
      return;
    }

    // API failed - no local fallback allowed
    console.error('Pooling API unavailable');
    this.appendMessage(this.createMessage('assistant',
      `⚠️ **Pool Service Unavailable**\n\n` +
      `Unable to connect to the pool construction service. Please ensure the backend server is running and try again.\n\n` +
      `Contact your administrator if the problem persists.`
    ));
    this.updateAgentStatus('error', 0, 'Service unavailable');
  }

  private async handleFilter(input: string): Promise<void> {
    const loans = this.uploadedLoans();
    if (loans.length === 0) {
      this.appendAssistantMessage('No loan data is currently loaded. Please upload data first.');
      return;
    }

    // Parse filter from input and use backend filtering
    const filter = this.parseFilterFromInput(input);
    await this.handleFilterWithParams(filter);
  }

  private async handleShowRules(): Promise<void> {
    this.updateAgentStatus('validating', 10, 'Loading rules...');
    
    try {
      // Get rule summary from backend (no thresholds exposed)
      const ruleSummary = await this.backendChat.getRuleSummary();
      
      this.updateAgentStatus('idle', 0, '');
      
      let response = `## MortgageMax Eligibility Rules\n\n`;
      response += `The following **${ruleSummary.totalRules} rules** are evaluated during loan validation:\n\n`;
      response += `| Rule ID | Name | Category | Guide Ref |\n`;
      response += `|---|---|---|---|\n`;
      ruleSummary.rules.forEach(r => {
        response += `| ${r.id} | ${r.name} | ${r.category} | ${r.guideReference} |\n`;
      });
      response += `\nType **"explain rule [RULE-ID]"** for a detailed explanation of any rule (e.g., "explain rule RATE-001").`;
      this.appendAssistantMessage(response);
    } catch (error: any) {
      this.updateAgentStatus('idle', 0, '');
      this.appendAssistantMessage(`⚠️ **Error**: ${error.message || 'Failed to load rules'}`);
    }
  }

  private handleShowSummary(): void {
    const summary = this.currentPoolSummary();
    if (!summary) {
      this.appendAssistantMessage('No validation has been performed yet. Please run **"validate"** first.');
      return;
    }

    let response = `## Current Pool Summary\n\n`;
    response += `| Metric | Value |\n|---|---|\n`;
    response += `| Total Loans Analyzed | ${summary.totalLoans} |\n`;
    response += `| Eligible | ${summary.eligibleLoans} |\n`;
    response += `| Ineligible | ${summary.ineligibleLoans} |\n`;
    response += `| With Warnings | ${summary.warningLoans} |\n`;
    response += `| Total UPB | $${summary.totalUPB.toLocaleString()} |\n`;
    response += `| Eligible UPB | $${summary.eligibleUPB.toLocaleString()} |\n`;
    response += `| WA Interest Rate | ${summary.weightedAvgRate}% |\n`;
    response += `| WA Coupon Rate | ${summary.weightedAvgCoupon}% |\n`;
    response += `| WA Loan Age | ${summary.weightedAvgAge} months |\n`;
    this.appendAssistantMessage(response);
  }

  private handleShowSampleData(): void {
    const loans = this.uploadedLoans();
    if (loans.length === 0) {
      this.appendAssistantMessage('No loan data is currently loaded.');
      return;
    }

    const preview = loans.slice(0, 5);
    let response = `## Loan Data Preview\n\nShowing **${preview.length} of ${loans.length}** records:\n\n`;
    response += `| Loan # | Pool | Rate | Coupon | Net Yield | UPB | Inv. Balance | Age | Status | Rate Type | Property |\n`;
    response += `|---|---|---|---|---|---|---|---|---|---|---|\n`;
    preview.forEach(l => {
      response += `| ${l.loanNumber} | ${l.poolNumber || 'N/A'} | ${l.interestRate}% | ${l.couponRate}% | ${l.netYield}% | $${l.upb.toLocaleString()} | $${l.currentInvestorBalance.toLocaleString()} | ${l.loanAgeMonths}mo | ${l.loanStatusCode} | ${l.rateTypeCode} | ${l.propertyType} |\n`;
    });
    this.appendAssistantMessage(response);
  }

  private handleShowIneligible(): void {
    const results = this.validationResults();
    if (results.length === 0) {
      this.appendAssistantMessage('No validation results available. Please run **"validate"** first.');
      return;
    }

    const ineligible = results.filter(r => !r.eligible);
    if (ineligible.length === 0) {
      this.appendAssistantMessage('All loans passed eligibility validation. No ineligible loans to display.');
      return;
    }

    const loans = this.uploadedLoans();
    const eligibleLoans = loans.filter(l => 
      results.find(r => r.loanNumber === l.loanNumber)?.eligible
    );

    let response = `## Ineligible Loan Details\n\n`;
    response += `**${ineligible.length} loan(s)** failed eligibility checks.\n\n`;
    response += `📥 **Download Report:** Type \`download ineligible csv\`, \`download ineligible excel\`, \`download ineligible pdf\`, or \`download ineligible json\`\n\n`;

    ineligible.forEach(r => {
      const loan = loans.find(l => l.loanNumber === r.loanNumber);
      response += `### 📋 ${r.loanNumber} — Pool: ${r.poolNumber || 'N/A'} — Score: ${r.score}/100\n\n`;
      
      // Violations table
      response += `| Severity | Rule | Actual | Required | Explanation |\n|---|---|---|---|---|\n`;
      r.violations.forEach(v => {
        const icon = v.severity === 'error' ? '❌' : '⚠️';
        response += `| ${icon} ${v.severity} | ${v.rule.ruleName} (${v.rule.ruleId}) | ${v.actualValue} | ${v.expectedValue} | ${v.explanation} |\n`;
      });
      response += `\n`;

      // How to fix section
      response += `#### 💡 How to Fix:\n`;
      r.violations.forEach(v => {
        const fix = this.generateFixSuggestion(v.rule.ruleId, v.actualValue, v.expectedValue, loan);
        response += `- **${v.rule.ruleId}:** ${fix}\n`;
      });
      response += `\n`;

      // Similar eligible loans that could replace this one
      if (loan && eligibleLoans.length > 0) {
        const similar = this.exportService.findSimilarEligibleLoans(loan, eligibleLoans, 2);
        if (similar.length > 0) {
          response += `#### 🔄 Similar Eligible Loans (potential replacements):\n`;
          response += `| Loan # | Rate | UPB | Property | Age |\n|---|---|---|---|---|\n`;
          similar.forEach(sl => {
            response += `| ${sl.loanNumber} | ${sl.interestRate}% | $${sl.upb.toLocaleString()} | ${sl.propertyType} | ${sl.loanAgeMonths}mo |\n`;
          });
          response += `\n`;
        }
      }
    });

    response += `---\n`;
    response += `> 📊 **Export Options:** Download this report with full details and recommendations.\n`;
    response += `> - \`download ineligible csv\` - Spreadsheet format\n`;
    response += `> - \`download ineligible excel\` - Excel-compatible format\n`;
    response += `> - \`download ineligible pdf\` - Printable report with fix suggestions\n`;
    response += `> - \`download ineligible json\` - Machine-readable format\n`;

    this.appendAssistantMessage(response);
  }

  /** Generate specific fix suggestions for a rule violation */
  private generateFixSuggestion(ruleId: string, actual: string, expected: string, loan?: LoanRecord): string {
    switch (ruleId) {
      case 'RATE-001':
        return `Adjust interest rate from ${actual} to within 0-12% range. Consider rate modification or refinancing.`;
      case 'RATE-002':
        return `Reduce coupon rate (${actual}) to be ≤ interest rate. Reassign to a lower coupon pool.`;
      case 'RATE-003':
        return `Correct net yield (${actual}) to be between 0 and coupon rate.`;
      case 'BAL-001':
        return `Loan has ${actual} UPB - appears paid off or has data error. Remove from pool.`;
      case 'BAL-002':
        return `Reduce investor balance to ≤ UPB. Current: ${actual}, max allowed: ${expected}.`;
      case 'BAL-003':
        return `UPB ${actual} exceeds $766,550 conforming limit. Consider high-balance designation or exclude.`;
      case 'PROP-001':
        return `Property type "${actual}" is ineligible. Only SF, CO, CP, PU, MH, 2-4 accepted.`;
      case 'STATUS-001':
        return `Status "${actual}" indicates non-performing. Wait for status update to Active (A) or Current (C).`;
      case 'AGE-001':
        const currentAge = parseInt(actual) || 0;
        const monthsNeeded = Math.max(0, 4 - currentAge);
        return `Loan needs ${monthsNeeded} more month(s) of seasoning. Current: ${actual} months, required: 4+ months.`;
      case 'POOL-001':
        return `Assign a valid pool number (e.g., PL-001) before delivery.`;
      case 'PREFIX-001':
        return `Assign valid MBS prefix: MX (Fixed Rate), MA (Adjustable Rate), or MF (Fixed Rate Note). Current: "${actual || 'none'}".`;
      default:
        return `Review ${ruleId} requirements and correct ${actual} to meet ${expected} criteria.`;
    }
  }

  /** Export ineligible loans to specified format */
  exportIneligibleLoans(format: ExportFormat): void {
    const results = this.validationResults();
    const ineligible = results.filter(r => !r.eligible);
    
    if (ineligible.length === 0) {
      this.appendAssistantMessage('No ineligible loans to export. Run validation first.');
      return;
    }

    const loans = this.uploadedLoans();
    this.exportService.exportIneligibleLoans(ineligible, loans, format, {
      includeRecommendations: true,
      includeSimilarLoans: true
    });

    const formatLabels: Record<ExportFormat, string> = {
      csv: 'CSV spreadsheet',
      excel: 'Excel file',
      json: 'JSON data',
      pdf: 'PDF report'
    };

    this.appendAssistantMessage(`✅ Downloading ${ineligible.length} ineligible loan(s) as ${formatLabels[format]}...`);
  }

  // ── API → Internal Mappers ─────────────────────────────────────────

  /** Map an EligibilityEvaluateResponse to LoanValidationResult[] so the
   *  rest of the chat service (show-ineligible, build-pool, etc.) works
   *  identically regardless of whether the API or local engine was used. */
  private mapApiToValidationResults(api: EligibilityEvaluateResponse): LoanValidationResult[] {
    const eligible: LoanValidationResult[] = api.eligibleLoans.map(l => ({
      loanNumber: l.loanNumber,
      poolNumber: l.poolNumber,
      eligible: true,
      violations: [],
      score: 100,
    }));

    const ineligible: LoanValidationResult[] = api.ineligibleLoans.map(il => ({
      loanNumber: il.loanNumber,
      poolNumber: il.poolNumber,
      eligible: false,
      score: il.score,
      violations: il.failedRules.map(fr => ({
        rule: {
          ruleId: fr.ruleId,
          ruleName: fr.ruleName,
          category: fr.category as any,
          description: fr.explanation,
          guideReference: fr.guideReference,
        },
        actualValue: fr.actualValue,
        expectedValue: fr.expectedValue,
        severity: fr.severity,
        explanation: fr.explanation,
        recommendedAction: fr.recommendedAction || '',
      })),
    }));

    return [...eligible, ...ineligible];
  }

  private mapApiToPoolSummary(api: EligibilityEvaluateResponse): PoolSummary {
    return {
      totalLoans: api.summary.totalLoans,
      eligibleLoans: api.summary.eligibleCount,
      ineligibleLoans: api.summary.ineligibleCount,
      warningLoans: 0,
      totalUPB: api.summary.totalUPB,
      eligibleUPB: api.summary.eligibleUPB,
      weightedAvgRate: api.summary.weightedAvgRate,
      weightedAvgCoupon: api.summary.weightedAvgCoupon,
      weightedAvgAge: api.summary.weightedAvgAge,
      topViolations: api.summary.ruleFailures.map(rf => ({
        ruleName: rf.ruleName,
        count: rf.count,
      })),
    };
  }

  // ── Session Persistence ────────────────────────────────────────────

  private restoreSessions(): void {
    try {
      const saved = sessionStorage.getItem(PoolLogicChatService.SESSIONS_KEY);
      const activeId = sessionStorage.getItem(PoolLogicChatService.ACTIVE_SESSION_KEY);

      if (saved) {
        const parsed: ChatSession[] = JSON.parse(saved);
        if (parsed.length > 0) {
          // Restore timestamps as Date objects
          parsed.forEach(s => {
            s.createdAt = new Date(s.createdAt);
            s.messages.forEach(m => m.timestamp = new Date(m.timestamp));
          });
          this.sessions.set(parsed);
          this.messageIdCounter = parsed.reduce((max, s) => Math.max(max, s.messages.length), 0);
          this.activeSessionId.set(activeId || parsed[0].id);
          return;
        }
      }
    } catch {
      // sessionStorage unavailable or corrupted — start fresh
    }
    // No sessions found — create the first one
    this.createSession('Session 1');
  }

  private saveSessions(): void {
    try {
      const sessions = this.sessions().map(s => ({
        id: s.id,
        name: s.name,
        createdAt: s.createdAt,
        messages: s.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          attachments: m.attachments,
        })),
        uploadedLoans: s.uploadedLoans,
        validationResults: s.validationResults, // persist validation results for Data Overview
        poolSummary: s.poolSummary, // persist pool summary for Data Overview
      }));
      sessionStorage.setItem(PoolLogicChatService.SESSIONS_KEY, JSON.stringify(sessions));
      sessionStorage.setItem(PoolLogicChatService.ACTIVE_SESSION_KEY, this.activeSessionId());
    } catch {
      // quota exceeded or unavailable — silently fail
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────

  // Track if welcome has been successfully fetched
  private welcomeFetched = false;
  private welcomeRetryCount = 0;
  private readonly MAX_WELCOME_RETRIES = 3;
  private welcomeRetryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private addSystemWelcome(): void {
    // Get AI-generated welcome message from backend
    this.welcomeFetched = false;
    this.welcomeRetryCount = 0;
    this.fetchAIWelcomeMessage();
  }

  /**
   * Fetch welcome message from backend AI with automatic retry
   * Implements exponential backoff for resilience when backend starts up
   */
  private async fetchAIWelcomeMessage(): Promise<void> {
    this.updateAgentStatus('validating', 10, 'Connecting to AI service...');
    
    try {
      const response = await this.backendChat.getWelcomeMessage();
      this.welcomeFetched = true;
      this.welcomeRetryCount = 0;
      this.appendMessage(this.createMessage('assistant', response.message));
      this.updateAgentStatus('idle', 0, '');
    } catch (error: any) {
      console.error('Backend service unavailable:', error.message);
      
      // Auto-retry with exponential backoff (2s, 4s, 8s)
      if (this.welcomeRetryCount < this.MAX_WELCOME_RETRIES) {
        this.welcomeRetryCount++;
        const delay = Math.pow(2, this.welcomeRetryCount) * 1000;
        this.updateAgentStatus('validating', 20 * this.welcomeRetryCount, 
          `Connecting... (attempt ${this.welcomeRetryCount + 1}/${this.MAX_WELCOME_RETRIES + 1})`);
        
        this.welcomeRetryTimeoutId = setTimeout(() => {
          this.fetchAIWelcomeMessage();
        }, delay);
        return;
      }
      
      // All retries exhausted - show connection message with retry option
      this.appendMessage(this.createMessage('assistant',
        `## Waiting for Backend Service\n\n` +
        `The AI service is not yet available. This typically means:\n` +
        `- The server is still starting up\n` +
        `- Network connectivity issue\n\n` +
        `**What to do:** Type **"retry"** or just start typing once the server is ready - I'll automatically reconnect.\n\n` +
        `*The service will auto-detect when the backend becomes available.*`
      ));
      this.updateAgentStatus('idle', 0, '');
      
      // Start background health polling
      this.startBackendHealthPolling();
    }
  }

  /**
   * Retry connection to backend - can be called by user typing "retry"
   */
  async retryBackendConnection(): Promise<void> {
    if (this.welcomeFetched) return;
    
    this.welcomeRetryCount = 0;
    // Remove the last "waiting for service" message
    const currentMessages = this.messages();
    if (currentMessages.length > 0) {
      const lastMsg = currentMessages[currentMessages.length - 1];
      if (lastMsg.role === 'assistant' && lastMsg.content.includes('Waiting for Backend Service')) {
        this.setMessages(currentMessages.slice(0, -1));
      }
    }
    
    await this.fetchAIWelcomeMessage();
  }

  /**
   * Background health polling - checks backend and auto-fetches welcome when available
   */
  private healthPollIntervalId: ReturnType<typeof setInterval> | null = null;
  
  private startBackendHealthPolling(): void {
    // Don't start multiple polling loops
    if (this.healthPollIntervalId) return;
    
    this.healthPollIntervalId = setInterval(async () => {
      if (this.welcomeFetched) {
        this.stopBackendHealthPolling();
        return;
      }
      
      try {
        const isHealthy = await this.backendChat.checkHealth();
        if (isHealthy && !this.welcomeFetched) {
          this.stopBackendHealthPolling();
          await this.retryBackendConnection();
        }
      } catch {
        // Still unavailable, continue polling
      }
    }, 5000); // Check every 5 seconds
  }

  private stopBackendHealthPolling(): void {
    if (this.healthPollIntervalId) {
      clearInterval(this.healthPollIntervalId);
      this.healthPollIntervalId = null;
    }
    if (this.welcomeRetryTimeoutId) {
      clearTimeout(this.welcomeRetryTimeoutId);
      this.welcomeRetryTimeoutId = null;
    }
  }

  /** Parse export format from user input */
  private parseExportFormat(input: string): ExportFormat | null {
    const lower = input.toLowerCase();
    if (lower.includes('excel') || lower.includes('xlsx') || lower.includes('xls')) {
      return 'excel';
    }
    if (lower.includes('pdf')) {
      return 'pdf';
    }
    if (lower.includes('json')) {
      return 'json';
    }
    if (lower.includes('csv')) {
      return 'csv';
    }
    // Default to CSV if format not specified but download is requested
    if (lower.includes('download')) {
      return 'csv';
    }
    return null;
  }

  private parseFilterFromInput(input: string): LoanFilter {
    const filter: LoanFilter = {};
    const lower = input.toLowerCase();

    // ── Coupon range ────────────────────────────────────────────────
    const couponAboveMatch = lower.match(/coupon\s*(?:rate\s*)?(?:above|over|>=?|greater\s*than|from)\s*(\d+\.?\d*)/);
    if (couponAboveMatch) filter.minCouponRate = parseFloat(couponAboveMatch[1]);

    const couponBelowMatch = lower.match(/coupon\s*(?:rate\s*)?(?:below|under|<=?|less\s*than|to)\s*(\d+\.?\d*)/);
    if (couponBelowMatch) filter.maxCouponRate = parseFloat(couponBelowMatch[1]);

    // "coupon between X and Y" / "coupon X-Y"
    const couponBetween = lower.match(/coupon\s*(?:rate\s*)?(?:between\s*)?(\d+\.?\d*)\s*(?:and|-)\s*(\d+\.?\d*)/);
    if (couponBetween) {
      filter.minCouponRate = parseFloat(couponBetween[1]);
      filter.maxCouponRate = parseFloat(couponBetween[2]);
    }

    // ── Interest rate ────────────────────────────────────────────────
    const rateAboveMatch = lower.match(/(?:interest\s*)?rate\s*(?:above|over|>=?|greater\s*than)\s*(\d+\.?\d*)/);
    if (rateAboveMatch && !couponAboveMatch) filter.minInterestRate = parseFloat(rateAboveMatch[1]);

    const rateBelowMatch = lower.match(/(?:interest\s*)?rate\s*(?:below|under|<=?|less\s*than)\s*(\d+\.?\d*)/);
    if (rateBelowMatch && !couponBelowMatch) filter.maxInterestRate = parseFloat(rateBelowMatch[1]);

    // ── UPB range ────────────────────────────────────────────────────
    const upbAboveMatch = lower.match(/(?:upb|balance|amount)\s*(?:above|over|>=?|greater\s*than)\s*\$?(\d[\d,]*)/);
    if (upbAboveMatch) filter.minUPB = parseInt(upbAboveMatch[1].replace(/,/g, ''));

    const upbBelowMatch = lower.match(/(?:upb|balance|amount)\s*(?:below|under|<=?|less\s*than)\s*\$?(\d[\d,]*)/);
    if (upbBelowMatch) filter.maxUPB = parseInt(upbBelowMatch[1].replace(/,/g, ''));

    // "upb between X and Y"
    const upbBetween = lower.match(/(?:upb|balance)\s*(?:between\s*)?\$?(\d[\d,]*)\s*(?:and|-)\s*\$?(\d[\d,]*)/);
    if (upbBetween) {
      filter.minUPB = parseInt(upbBetween[1].replace(/,/g, ''));
      filter.maxUPB = parseInt(upbBetween[2].replace(/,/g, ''));
    }

    // ── Loan age ─────────────────────────────────────────────────────
    const ageAboveMatch = lower.match(/(?:age|loan\s*age|months)\s*(?:above|over|>=?|greater\s*than)\s*(\d+)/);
    if (ageAboveMatch) filter.minLoanAge = parseInt(ageAboveMatch[1]);

    const ageBelowMatch = lower.match(/(?:age|loan\s*age|months)\s*(?:below|under|<=?|less\s*than)\s*(\d+)/);
    if (ageBelowMatch) filter.maxLoanAge = parseInt(ageBelowMatch[1]);

    // "age between X and Y"
    const ageBetween = lower.match(/(?:age|loan\s*age)\s*(?:between\s*)?(\d+)\s*(?:and|-)\s*(\d+)/);
    if (ageBetween) {
      filter.minLoanAge = parseInt(ageBetween[1]);
      filter.maxLoanAge = parseInt(ageBetween[2]);
    }

    // ── Status ───────────────────────────────────────────────────────
    if (lower.includes('status a') || /\bactive\b/.test(lower)) filter.loanStatusCode = 'A';
    else if (lower.includes('status c') || /\bcurrent\b/.test(lower)) filter.loanStatusCode = 'C';
    else if (lower.includes('status d') || /\bdelinquent\b/.test(lower)) filter.loanStatusCode = 'D';

    // Exact status code match  e.g. "status=A"
    const statusExact = lower.match(/status\s*[=:]\s*([a-z])/i);
    if (statusExact) filter.loanStatusCode = statusExact[1].toUpperCase();

    // ── Property type ────────────────────────────────────────────────
    const propTypes: string[] = [];
    const propMatch = lower.match(/(?:property\s*(?:type)?|prop\s*type)\s*(?:=|:)?\s*([a-z0-9,\s\-]+?)(?:\s*(?:and|with|,\s*(?:coupon|upb|age|status|prefix|rate|special))|\.?$)/i);
    if (propMatch) {
      propMatch[1].split(/[,\s]+/).forEach(t => {
        const normalized = t.trim().toUpperCase();
        if (['SF', 'CO', 'CP', 'PU', 'MH', '2-4'].includes(normalized) && !propTypes.includes(normalized)) {
          propTypes.push(normalized);
        }
      });
    }
    // Also detect standalone property codes near "property"
    ['SF', 'CO', 'CP', 'PU', 'MH'].forEach(pt => {
      if (lower.includes(pt.toLowerCase()) && lower.includes('property') && !propTypes.includes(pt)) {
        propTypes.push(pt);
      }
    });
    if (lower.includes('2-4') && !propTypes.includes('2-4')) propTypes.push('2-4');
    if (propTypes.length > 0) filter.propertyTypes = propTypes;

    // ── MBS Pool prefix ──────────────────────────────────────────────
    const prefixMatch = lower.match(/(?:prefix|mbs\s*(?:pool)?\s*prefix)\s*(?:=|:)?\s*([a-z]{2})/i);
    if (prefixMatch) filter.mbsPoolPrefix = prefixMatch[1].toUpperCase();
    // Also match "MX" or "MA" after "prefix"
    if (!filter.mbsPoolPrefix) {
      const shortPrefix = lower.match(/prefix\s+(mx|ma|mf)/);
      if (shortPrefix) filter.mbsPoolPrefix = shortPrefix[1].toUpperCase();
    }

    // ── Rate type ────────────────────────────────────────────────────
    if (lower.includes('fixed') || lower.includes('frm')) filter.rateTypeCode = 'FRM';
    if (lower.includes('adjustable') || lower.includes('arm')) filter.rateTypeCode = 'ARM';

    // ── Pool number ──────────────────────────────────────────────────
    const poolMatch = lower.match(/pool\s*(?:number|#|no)?\s*(pl-\d+)/i);
    if (poolMatch) filter.poolNumber = poolMatch[1].toUpperCase();

    // ── Special category ─────────────────────────────────────────────
    const specialMatch = lower.match(/(?:special\s*(?:category)?|category)\s*(?:=|:)?\s*([a-z0-9]+)/i);
    if (specialMatch) {
      const cat = specialMatch[1].toUpperCase();
      if (cat !== 'FILTER' && cat !== 'LOANS') {
        filter.specialCategories = [cat];
      }
    }
    // Known categories
    ['HARP', 'HAMP', 'DUS', 'FHFA', 'GREEN'].forEach(sc => {
      if (lower.includes(sc.toLowerCase())) {
        filter.specialCategories = filter.specialCategories || [];
        if (!filter.specialCategories.includes(sc)) filter.specialCategories.push(sc);
      }
    });

    return filter;
  }

  /** Build a human-readable list of the filters that were actually applied. */
  private describeAppliedFilters(filter: LoanFilter): string[] {
    const parts: string[] = [];
    if (filter.minCouponRate != null || filter.maxCouponRate != null) {
      const lo = filter.minCouponRate != null ? `${filter.minCouponRate}%` : '0%';
      const hi = filter.maxCouponRate != null ? `${filter.maxCouponRate}%` : '∞';
      parts.push(`Coupon ${lo}–${hi}`);
    }
    if (filter.minInterestRate != null || filter.maxInterestRate != null) {
      const lo = filter.minInterestRate != null ? `${filter.minInterestRate}%` : '0%';
      const hi = filter.maxInterestRate != null ? `${filter.maxInterestRate}%` : '∞';
      parts.push(`Rate ${lo}–${hi}`);
    }
    if (filter.minLoanAge != null || filter.maxLoanAge != null) {
      const lo = filter.minLoanAge ?? 0;
      const hi = filter.maxLoanAge != null ? `${filter.maxLoanAge}` : '∞';
      parts.push(`Age ${lo}–${hi} mo`);
    }
    if (filter.loanStatusCode) parts.push(`Status: ${filter.loanStatusCode}`);
    if (filter.propertyTypes?.length) parts.push(`Property: ${filter.propertyTypes.join(', ')}`);
    if (filter.mbsPoolPrefix) parts.push(`Prefix: ${filter.mbsPoolPrefix}`);
    if (filter.minUPB != null || filter.maxUPB != null) {
      const lo = filter.minUPB != null ? `$${filter.minUPB.toLocaleString()}` : '$0';
      const hi = filter.maxUPB != null ? `$${filter.maxUPB.toLocaleString()}` : '∞';
      parts.push(`UPB ${lo}–${hi}`);
    }
    if (filter.specialCategories?.length) parts.push(`Special: ${filter.specialCategories.join(', ')}`);
    if (filter.rateTypeCode) parts.push(`Rate type: ${filter.rateTypeCode}`);
    if (filter.poolNumber) parts.push(`Pool: ${filter.poolNumber}`);
    return parts;
  }

  private createMessage(role: ChatMessage['role'], content: string, attachments?: FileAttachment[]): ChatMessage {
    return {
      id: `msg-${++this.messageIdCounter}`,
      role,
      content,
      timestamp: new Date(),
      attachments,
    };
  }

  private appendMessage(msg: ChatMessage): void {
    this.updateActiveSession(s => ({
      ...s,
      messages: [...s.messages, msg],
    }));
  }

  private appendAssistantMessage(content: string): void {
    this.appendMessage(this.createMessage('assistant', content));
  }

  private updateAgentStatus(state: AgentStatus['state'], progress: number, currentStep: string): void {
    this.agentStatus.set({ state, progress, currentStep });
  }

  private async simulateProgress(state: AgentStatus['state'], steps: { pct: number; msg: string }[]): Promise<void> {
    for (const step of steps) {
      this.updateAgentStatus(state, step.pct, step.msg);
      await this.delay(400 + Math.random() * 300);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getFileType(filename: string): FileAttachment['type'] {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'csv') return 'csv';
    if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
    if (ext === 'json') return 'json';
    return 'unknown';
  }
}
