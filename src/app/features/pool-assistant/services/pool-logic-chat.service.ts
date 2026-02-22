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
import { ClaudeAIService, AIProvider, PROVIDER_INFO } from './claude-ai.service';

@Injectable({ providedIn: 'root' })
export class PoolLogicChatService {
  private readonly validationService = inject(LoanValidationService);
  private readonly eligibilityApi = inject(EligibilityApiService);
  private readonly poolingApi = inject(PoolingApiService);
  private readonly claudeService = inject(ClaudeAIService);

  // ── AI Mode ───────────────────────────────────────────────────────
  readonly aiModeEnabled = computed(() => this.claudeService.isEnabled());
  readonly aiConfigured = computed(() => this.claudeService.isConfigured());
  readonly aiError = computed(() => this.claudeService.lastError());
  readonly demoMode = computed(() => this.claudeService.demoMode());
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
    this.updateActiveSession(s => ({ ...s, uploadedLoans: loans }));
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
      const text = await file.text();

      if (fileType !== 'csv' && fileType !== 'json') {
        attachment.status = 'error';
        attachment.errorMessage = 'Unsupported file format. Please upload a CSV or JSON file.';
        this.appendAssistantMessage(`I'm unable to parse **${file.name}**. Currently supported formats are CSV and JSON. Please convert your file and try again.`);
        this.updateAgentStatus('idle', 0, '');
        return;
      }

      const result = fileType === 'csv'
        ? this.validationService.parseCSV(text)
        : this.validationService.parseJSON(text);

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

      // Build a preview table of the first 10 rows
      const preview = loans.slice(0, 10);
      previewMsg += `### Data Preview${loans.length > 10 ? ` (first 10 of ${loans.length})` : ''}\n\n`;
      previewMsg += `| # | Loan # | Pool | Prefix | Rate | Coupon | UPB | Age | Status | Rate Type | Property |\n`;
      previewMsg += `|---|---|---|---|---|---|---|---|---|---|---|\n`;
      preview.forEach((l, i) => {
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
      `Switched back to keyword-based mode. Use commands like "validate", "build pool", "filter", etc.`
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
          `⚠️ API key required. Get a free key at [console.groq.com](https://console.groq.com)`
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
        `Connected to Groq's ultra-fast LLaMA 3.1 70B. Free and fast!`
      );
    }
  }

  toggleDemoMode(): void {
    // Cycle through providers: demo -> groq -> claude -> demo
    const current = this.claudeService.provider();
    if (current === 'demo') {
      this.setAIProvider('groq');
    } else if (current === 'groq') {
      this.setAIProvider('claude');
    } else {
      this.setAIProvider('demo');
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
    // ── AI Mode: Use Claude for intent classification ───────────────
    if (this.claudeService.isEnabled()) {
      await this.processWithClaude(input);
      return;
    }

    // ── Rule-based Mode: Keyword matching ───────────────────────────
    await this.processWithKeywords(input);
  }

  private async processWithClaude(input: string): Promise<void> {
    const providerInfo = this.claudeService.providerInfo();
    this.updateAgentStatus('validating', 10, `Analyzing with ${providerInfo.name}...`);

    const context = {
      loanCount: this.uploadedLoans().length,
      eligibleCount: this.validationResults().filter(r => r.eligible).length,
      ineligibleCount: this.validationResults().filter(r => !r.eligible).length,
      hasValidationResults: this.validationResults().length > 0,
    };

    try {
      const response = await this.claudeService.classifyIntent(input, context);

      this.updateAgentStatus('idle', 0, '');

      // Check for errors from the AI service
      const error = this.claudeService.lastError();
      if (error) {
        this.appendAssistantMessage(`⚠️ **API Error**: ${error}\n\nFalling back to demo mode.`);
        return;
      }

      // If AI provided a custom message for general queries, use it
      if (response.intent.action === 'general' && response.message) {
        this.appendAssistantMessage(response.message);
        return;
      }

      // Otherwise, dispatch to the appropriate handler
      await this.dispatchIntent(response.intent.action, input, response.intent.parameters);
    } catch (err: any) {
      this.updateAgentStatus('idle', 0, '');
      this.appendAssistantMessage(`⚠️ **Error**: ${err.message || 'Failed to process request'}`);
    }
  }

  private async processWithKeywords(input: string): Promise<void> {
    const lower = input.toLowerCase().trim();

    if (this.matchesIntent(lower, ['validate', 'check', 'eligibility', 'run validation', 'check eligibility', 'verify'])) {
      await this.handleValidation();
      return;
    }

    if (this.matchesIntent(lower, ['build pool', 'construct pool', 'create pool', 'pool construction', 'build a pool'])) {
      await this.handleBuildPool();
      return;
    }

    if (this.matchesIntent(lower, ['filter', 'find loans', 'search loans', 'show loans with', 'loans where'])) {
      await this.handleFilter(input);
      return;
    }

    if (this.matchesIntent(lower, ['show rules', 'list rules', 'what rules', 'eligibility rules', 'poollogic rules'])) {
      this.handleShowRules();
      return;
    }

    if (lower.startsWith('explain rule') || lower.startsWith('explain ') && lower.includes('rule')) {
      const ruleId = input.match(/[A-Z]+-\d+/)?.[0];
      if (ruleId) {
        const explanation = this.validationService.explainRule(ruleId);
        this.appendAssistantMessage(explanation);
      } else {
        this.appendAssistantMessage('Please specify a rule ID (e.g., "explain rule RATE-001"). Type **"show rules"** to see all available rules.');
      }
      return;
    }

    if (this.matchesIntent(lower, ['summary', 'pool summary', 'show summary', 'results summary'])) {
      this.handleShowSummary();
      return;
    }

    if (this.matchesIntent(lower, ['show sample', 'preview', 'show data', 'sample data', 'preview data'])) {
      this.handleShowSampleData();
      return;
    }

    if (this.matchesIntent(lower, ['ineligible', 'failed', 'rejected', 'show ineligible', 'show failed'])) {
      this.handleShowIneligible();
      return;
    }

    if (this.matchesIntent(lower, ['help', 'what can you do', 'commands', 'how to use'])) {
      this.handleHelp();
      return;
    }

    if (this.matchesIntent(lower, ['load sample', 'demo data', 'sample loans', 'load demo'])) {
      this.loadSampleData();
      return;
    }

    this.handleGeneralQuestion(input);
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
        await this.handleFilter(originalInput);
        break;
      case 'show-rules':
        this.handleShowRules();
        break;
      case 'explain-rule':
        if (parameters?.['ruleId']) {
          const explanation = this.validationService.explainRule(parameters['ruleId']);
          this.appendAssistantMessage(explanation);
        } else {
          const ruleId = originalInput.match(/[A-Z]+-\d+/)?.[0];
          if (ruleId) {
            const explanation = this.validationService.explainRule(ruleId);
            this.appendAssistantMessage(explanation);
          } else {
            this.appendAssistantMessage('Please specify a rule ID (e.g., "explain rule RATE-001").');
          }
        }
        break;
      case 'summary':
        this.handleShowSummary();
        break;
      case 'show-ineligible':
        this.handleShowIneligible();
        break;
      case 'help':
        this.handleHelp();
        break;
      case 'load-sample':
        this.loadSampleData();
        break;
      default:
        this.handleGeneralQuestion(originalInput);
    }
  }

  // ── Intent Handlers ───────────────────────────────────────────────

  private async handleValidation(): Promise<void> {
    const loans = this.uploadedLoans();
    if (loans.length === 0) {
      this.appendAssistantMessage('No loan data is currently loaded. Please upload a CSV or JSON file, or type **"load sample"** to use demonstration data.');
      return;
    }

    this.updateAgentStatus('validating', 0, 'Calling eligibility API...');

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

    // ── Fallback to local validation ────────────────────────────────
    // NOTE: API fallback warning removed - local engine is the primary mode

    await this.simulateProgress('validating', [
      { pct: 20, msg: 'Applying interest rate rules...' },
      { pct: 40, msg: 'Checking balance & UPB requirements...' },
      { pct: 60, msg: 'Evaluating property and status codes...' },
      { pct: 80, msg: 'Validating pool assignments...' },
      { pct: 95, msg: 'Compiling results...' },
    ]);

    const results = this.validationService.validateLoans(loans);
    const summary = this.validationService.buildPoolSummary(results, loans);

    this.setValidationResults(results);
    this.setPoolSummary(summary);

    const eligible = results.filter(r => r.eligible);
    const ineligible = results.filter(r => !r.eligible);

    let response = `## Validation Complete  *(local)*\n\n`;
    response += `Analyzed **${loans.length} loans** against ${this.validationService.getRules().length} MortgageMax eligibility rules.\n\n`;
    response += `| Metric | Value |\n|---|---|\n`;
    response += `| Eligible Loans | **${eligible.length}** (${Math.round(eligible.length / loans.length * 100)}%) |\n`;
    response += `| Ineligible Loans | **${ineligible.length}** (${Math.round(ineligible.length / loans.length * 100)}%) |\n`;
    response += `| Total UPB | **$${summary.totalUPB.toLocaleString()}** |\n`;
    response += `| Eligible UPB | **$${summary.eligibleUPB.toLocaleString()}** |\n`;
    response += `| WA Interest Rate | **${summary.weightedAvgRate}%** |\n`;
    response += `| WA Coupon Rate | **${summary.weightedAvgCoupon}%** |\n`;
    response += `| WA Loan Age | **${summary.weightedAvgAge} months** |\n\n`;

    if (ineligible.length > 0) {
      response += `### Ineligible Loans\n\n`;
      response += `| Loan # | Pool | Failures | Failed Rules |\n|---|---|---|---|\n`;
      ineligible.forEach(r => {
        const errors = r.violations.filter(v => v.severity === 'error');
        response += `| ${r.loanNumber} | ${r.poolNumber || 'N/A'} | ${errors.length} | ${errors.map(e => e.rule.ruleName).join(', ') || 'Warnings only'} |\n`;
      });
      response += `\n> Remove or correct the ${ineligible.length} ineligible loan(s) before pool construction.\n\n`;
    }

    if (summary.topViolations.length > 0) {
      response += `### Top Rule Violations\n\n`;
      response += `| Rule | Occurrences |\n|---|---|\n`;
      summary.topViolations.forEach(v => {
        response += `| ${v.ruleName} | ${v.count} |\n`;
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
  }

  private async handleBuildPool(): Promise<void> {
    const loans = this.uploadedLoans();
    if (loans.length === 0) {
      this.appendAssistantMessage('No loan data is currently loaded. Please upload data first.');
      return;
    }

    let results = this.validationResults();
    if (results.length === 0) {
      this.appendAssistantMessage('Running validation before pool construction...');
      results = this.validationService.validateLoans(loans);
      this.setValidationResults(results);
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

    // ── Fallback to local pool construction ──────────────────────────
    // NOTE: API fallback warning removed - local engine is the primary mode

    await this.simulateProgress('building-pool', [
      { pct: 30, msg: 'Filtering eligible loans...' },
      { pct: 60, msg: 'Computing pool metrics...' },
      { pct: 90, msg: 'Finalizing pool composition...' },
    ]);

    const summary = this.validationService.buildPoolSummary(results, loans);
    this.setPoolSummary(summary);

    let response = `## Pool Construction Complete  *(local)*\n\n`;
    response += `A pool of **${eligible.length} eligible loans** has been constructed.\n\n`;
    response += `| Pool Metric | Value |\n|---|---|\n`;
    response += `| Pool Size | **${eligible.length} loans** |\n`;
    response += `| Total UPB | **$${summary.eligibleUPB.toLocaleString()}** |\n`;
    response += `| WA Interest Rate | **${summary.weightedAvgRate}%** |\n`;
    response += `| WA Coupon Rate | **${summary.weightedAvgCoupon}%** |\n`;
    response += `| WA Loan Age | **${summary.weightedAvgAge} months** |\n`;
    response += `| Excluded Loans | **${summary.ineligibleLoans}** |\n\n`;

    if (summary.ineligibleLoans > 0) {
      response += `> **${summary.ineligibleLoans} loan(s)** were excluded due to eligibility rule violations. `;
      response += `Type **"show ineligible"** to review these loans.\n\n`;
    }

    response += `The pool meets MortgageMax guidelines and is ready for delivery considerations. `;
    response += `You may further **filter** loans or ask about specific **rules** that apply to this pool.`;

    const msg = this.createMessage('assistant', response);
    msg.poolSummary = summary;
    this.appendMessage(msg);

    this.updateAgentStatus('complete', 100, 'Pool built');
    setTimeout(() => this.updateAgentStatus('idle', 0, ''), 2000);
  }

  private async handleFilter(input: string): Promise<void> {
    const loans = this.uploadedLoans();
    if (loans.length === 0) {
      this.appendAssistantMessage('No loan data is currently loaded. Please upload data first.');
      return;
    }

    const filter = this.parseFilterFromInput(input);
    this.updateAgentStatus('filtering', 50, 'Applying filters...');

    await this.delay(500);

    const filtered = this.validationService.filterLoans(loans, filter);

    // Build a readable list of active filters
    const appliedFilters = this.describeAppliedFilters(filter);

    let response = `## Filter Results\n\n`;
    if (appliedFilters.length > 0) {
      response += `**Active filters:** ${appliedFilters.join(' · ')}\n\n`;
    }
    response += `Applied filters to **${loans.length} loans** — **${filtered.length}** match your criteria.\n\n`;

    if (filtered.length > 0 && filtered.length <= 10) {
      response += `| Loan # | Pool | Prefix | Rate | Coupon | UPB | Age | Status | Property | Special |\n`;
      response += `|---|---|---|---|---|---|---|---|---|---|\n`;
      filtered.forEach(l => {
        response += `| ${l.loanNumber} | ${l.poolNumber || 'N/A'} | ${l.mbsPoolPrefix || '-'} | ${l.interestRate}% | ${l.couponRate}% | $${l.upb.toLocaleString()} | ${l.loanAgeMonths}mo | ${l.loanStatusCode} | ${l.propertyType} | ${l.specialCategory || '-'} |\n`;
      });
    } else if (filtered.length > 10) {
      response += `Showing first 10 of ${filtered.length} matches:\n\n`;
      response += `| Loan # | Pool | Rate | Coupon | UPB | Age | Status | Property |\n`;
      response += `|---|---|---|---|---|---|---|---|\n`;
      filtered.slice(0, 10).forEach(l => {
        response += `| ${l.loanNumber} | ${l.poolNumber || 'N/A'} | ${l.interestRate}% | ${l.couponRate}% | $${l.upb.toLocaleString()} | ${l.loanAgeMonths}mo | ${l.loanStatusCode} | ${l.propertyType} |\n`;
      });
    } else {
      response += `No loans match the specified criteria. Try broadening your filters.\n\n`;
      response += `**Available filter criteria:** coupon range, loan age, status, property type, prefix, UPB range, special category`;
    }

    this.appendAssistantMessage(response);
    this.updateAgentStatus('idle', 0, '');
  }

  private handleShowRules(): void {
    const rules = this.validationService.getRules();
    let response = `## MortgageMax Eligibility Rules\n\n`;
    response += `The following **${rules.length} rules** are evaluated during loan validation:\n\n`;
    response += `| Rule ID | Name | Category | Guide Ref |\n`;
    response += `|---|---|---|---|\n`;
    rules.forEach(r => {
      response += `| ${r.ruleId} | ${r.ruleName} | ${r.category} | ${r.guideReference} |\n`;
    });
    response += `\nType **"explain rule [RULE-ID]"** for a detailed explanation of any rule (e.g., "explain rule RATE-001").`;
    this.appendAssistantMessage(response);
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

    let response = `## Ineligible Loan Details\n\n`;
    response += `**${ineligible.length} loan(s)** failed eligibility checks:\n\n`;

    ineligible.forEach(r => {
      response += `### ${r.loanNumber} — Pool: ${r.poolNumber || 'N/A'} — Score: ${r.score}/100\n\n`;
      response += `| Severity | Rule | Actual | Required | Explanation | Action | Reference |\n|---|---|---|---|---|---|---|\n`;
      r.violations.forEach(v => {
        const icon = v.severity === 'error' ? '❌' : '⚠️';
        response += `| ${icon} ${v.severity} | ${v.rule.ruleName} (${v.rule.ruleId}) | ${v.actualValue} | ${v.expectedValue} | ${v.explanation} | ${v.recommendedAction} | ${v.rule.guideReference} |\n`;
      });
      response += `\n`;
    });

    response += `> **Action Required:** Remove or correct the above loans before proceeding with pool construction.`;
    this.appendAssistantMessage(response);
  }

  private handleHelp(): void {
    this.appendAssistantMessage(
      `## Loan Pool Advisor — Commands\n\n` +
      `| Command | Description |\n|---|---|\n` +
      `| **Upload a file** | Drag & drop or click to upload CSV/JSON loan files |\n` +
      `| **"load sample"** | Load demonstration loan data |\n` +
      `| **"validate"** | Run eligibility checks on loaded loans |\n` +
      `| **"build pool"** | Construct a pool with eligible loans only |\n` +
      `| **"filter"** + criteria | Filter by coupon range, age, status, property type, prefix, UPB range, special category |\n` +
      `| **"show rules"** | Display all eligibility rules |\n` +
      `| **"explain rule [ID]"** | Explain a specific rule (e.g., "explain rule RATE-001") |\n` +
      `| **"show ineligible"** | View detailed failure reasons for ineligible loans |\n` +
      `| **"summary"** | Display current pool summary metrics |\n` +
      `| **"show sample"** | Preview loaded loan data |\n` +
      `| **"help"** | Show this command reference |\n\n` +
      `**Required CSV/JSON fields:** ${[...REQUIRED_LOAN_FIELDS].join(', ')}\n\n` +
      `You can also ask natural language questions about loans, rules, or MortgageMax guidelines.`
    );
  }

  private handleGeneralQuestion(input: string): void {
    const lower = input.toLowerCase();
    const loans = this.uploadedLoans();
    const results = this.validationResults();

    if (lower.includes('how many') && lower.includes('loan')) {
      if (loans.length > 0) {
        const eligible = results.filter(r => r.eligible).length;
        this.appendAssistantMessage(
          `There are **${loans.length} loans** currently loaded.` +
          (results.length > 0 ? ` Of these, **${eligible}** are eligible and **${results.length - eligible}** are ineligible.` : ' Run **"validate"** to check their eligibility.')
        );
      } else {
        this.appendAssistantMessage('No loans are currently loaded. Upload a file or type **"load sample"** to get started.');
      }
      return;
    }

    if (lower.includes('interest rate') || lower.includes('coupon rate') || lower.includes('net yield')) {
      this.appendAssistantMessage(
        `Per MortgageMax eligibility rules:\n\n` +
        `- **Interest Rate**: Must be > 0% and ≤ 12% (RATE-001)\n` +
        `- **Coupon Rate**: Must not exceed the interest rate (RATE-002)\n` +
        `- **Net Yield**: Must be ≥ 0 and ≤ coupon rate (RATE-003)\n\n` +
        `Need to check your loans? Type **"validate"** to run a full eligibility analysis.`
      );
      return;
    }

    if (lower.includes('upb') || lower.includes('unpaid principal') || lower.includes('balance')) {
      this.appendAssistantMessage(
        `Per MortgageMax balance requirements:\n\n` +
        `- **UPB**: Must be greater than zero (BAL-001)\n` +
        `- **Investor Balance**: Must not exceed UPB (BAL-002)\n` +
        `- **Conforming Limit**: UPB must not exceed $766,550 (BAL-003)\n\n` +
        `Type **"validate"** to check all loans against these rules.`
      );
      return;
    }

    if (lower.includes('property type')) {
      this.appendAssistantMessage(
        `Eligible property type codes per MortgageMax:\n\n` +
        `- **SF** — Single-Family\n` +
        `- **CO** — Condominium\n` +
        `- **CP** — Co-op\n` +
        `- **PU** — PUD\n` +
        `- **MH** — Manufactured Housing\n` +
        `- **2-4** — 2-4 Unit\n\n` +
        `Loans with other property type codes will be flagged as ineligible.`
      );
      return;
    }

    if (lower.includes('status') || lower.includes('loan status')) {
      this.appendAssistantMessage(
        `Per MortgageMax guidelines, loans must have an active status to be pool-eligible:\n\n` +
        `- **A** — Active\n` +
        `- **C** — Current\n\n` +
        `Loans with status codes such as D (Delinquent), F (Foreclosure), etc. will fail the STATUS-001 rule.`
      );
      return;
    }

    if (lower.includes('conforming') || lower.includes('loan limit')) {
      this.appendAssistantMessage(
        `The **2025 conforming loan limit** is **$766,550** for single-unit properties. ` +
        `Loans with UPB exceeding this limit are not eligible for standard MortgageMax purchase. ` +
        `Higher limits apply in designated high-cost areas.`
      );
      return;
    }

    if (lower.includes('required field') || lower.includes('what fields') || lower.includes('columns')) {
      this.appendAssistantMessage(
        `## Required Loan Fields\n\n` +
        `Your CSV or JSON file must contain these fields (case-insensitive, underscores/hyphens ignored):\n\n` +
        `| Field | Description |\n|---|---|\n` +
        `| loanNumber | Unique loan identifier |\n` +
        `| interestRate | Note interest rate (%) |\n` +
        `| currentInvestorBalance | Current investor balance ($) |\n` +
        `| propertyType | Property type code (SF, CO, etc.) |\n` +
        `| upb | Unpaid principal balance ($) |\n\n` +
        `**Optional but recommended:** poolNumber, mbsPoolPrefix, couponRate, netYield, loanAgeMonths, loanStatusCode, rateTypeCode, specialCategory`
      );
      return;
    }

    // Fallback
    this.appendAssistantMessage(
      `I understand you're asking about: "${input}"\n\n` +
      `As your Loan Pool Advisor, I can help with:\n` +
      `- **Loan validation** against MortgageMax eligibility rules\n` +
      `- **Pool construction** with eligible loans\n` +
      `- **Rule explanations** for any eligibility requirement\n` +
      `- **Data filtering** by rate, UPB, property type, and more\n\n` +
      `Upload a loan file or type **"help"** to see available commands.`
    );
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
        validationResults: [], // don't persist results
        poolSummary: null,
      }));
      sessionStorage.setItem(PoolLogicChatService.SESSIONS_KEY, JSON.stringify(sessions));
      sessionStorage.setItem(PoolLogicChatService.ACTIVE_SESSION_KEY, this.activeSessionId());
    } catch {
      // quota exceeded or unavailable — silently fail
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────

  private addSystemWelcome(): void {
    this.appendMessage(this.createMessage('assistant',
      `## Welcome to Loan Pool Advisor\n\n` +
      `I am your intelligent assistant for mortgage loan validation and pool construction. ` +
      `I evaluate loans against MortgageMax Single-Family Seller/Servicer Guide requirements and help you build compliant loan pools.\n\n` +
      `**Getting started:**\n` +
      `1. **Upload a loan file** (CSV or JSON) using the upload area below\n` +
      `2. Or type **"load sample"** to use demonstration data\n` +
      `3. Then type **"validate"** to run eligibility checks\n\n` +
      `**Required fields:** ${[...REQUIRED_LOAN_FIELDS].join(', ')}\n\n` +
      `I never modify your loan data — only analyze and report. Type **"help"** for all available commands.`
    ));
  }

  private matchesIntent(input: string, keywords: string[]): boolean {
    return keywords.some(k => input.includes(k));
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
    // Also match "FG" or "FH" after "prefix"
    if (!filter.mbsPoolPrefix) {
      const shortPrefix = lower.match(/prefix\s+(fg|fh|fn)/);
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
