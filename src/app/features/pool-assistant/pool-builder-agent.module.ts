/**
 * Pool Builder Agent Module
 * 
 * Exportable Angular module containing all Pool Assistant components
 * and services. Can be packaged as an Angular library for reuse.
 * 
 * Usage:
 *   import { PoolBuilderAgentModule } from '@pool-advisor/agent';
 *   
 *   @NgModule({
 *     imports: [PoolBuilderAgentModule]
 *   })
 *   export class AppModule {}
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

// Components
import { PoolChatComponent } from './components/pool-chat/pool-chat.component';

// Services
import { PoolLogicChatService } from './services/pool-logic-chat.service';
import { LoanValidationService } from './services/loan-validation.service';
import { DynamicValidationEngine } from './services/dynamic-validation-engine.service';
import { ClaudeAIService } from './services/claude-ai.service';
import { ExportService } from './services/export.service';
import { LLMAdapterService } from './services/llm-adapter.service';

/**
 * Module configuration options
 */
export interface PoolBuilderAgentConfig {
  rulesApiUrl?: string;
  aiProvider?: 'groq' | 'claude';
  enableAuditLogging?: boolean;
}

/**
 * Pool Builder Agent Module
 * 
 * Provides all components and services for loan pool validation,
 * AI-powered chat interface, and pool construction.
 */
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    PoolChatComponent,  // Standalone component
  ],
  exports: [
    PoolChatComponent,
  ],
  providers: [
    PoolLogicChatService,
    LoanValidationService,
    DynamicValidationEngine,
    ClaudeAIService,
    ExportService,
    LLMAdapterService,
  ],
})
export class PoolBuilderAgentModule {
  /**
   * Configure the module with custom settings
   */
  static forRoot(config: PoolBuilderAgentConfig) {
    return {
      ngModule: PoolBuilderAgentModule,
      providers: [
        { provide: 'POOL_AGENT_CONFIG', useValue: config },
      ],
    };
  }
}

// Re-export all components and services for direct import
export { PoolChatComponent } from './components/pool-chat/pool-chat.component';
export { PoolLogicChatService } from './services/pool-logic-chat.service';
export { LoanValidationService } from './services/loan-validation.service';
export { DynamicValidationEngine, DynamicRule } from './services/dynamic-validation-engine.service';
export { ClaudeAIService, AIProvider, AIResponse, AIIntent } from './services/claude-ai.service';
export { ExportService, ExportFormat, IneligibleLoanExport } from './services/export.service';
export { LLMAdapterService, HumanMessage, StructuredQuery } from './services/llm-adapter.service';

// Re-export models
export * from './models/pool-logic.model';
