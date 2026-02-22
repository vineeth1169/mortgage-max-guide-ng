import { Component, inject, computed } from '@angular/core';
import { PoolChatComponent } from '../../components/pool-chat/pool-chat.component';
import { PoolLogicChatService } from '../../services/pool-logic-chat.service';

@Component({
  selector: 'app-pool-assistant-page',
  standalone: true,
  imports: [PoolChatComponent],
  template: `
    <div class="pool-page-layout">

      <!-- ===== Left Panel: Info & Status ===== -->
      <aside class="info-panel">

        <!-- Agent Identity Card -->
        <div class="p-4 border-b border-gray-200">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-fm-blue to-[#0077b6] flex items-center justify-center shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 8V4H8"/>
                <rect width="16" height="12" x="4" y="8" rx="2"/>
                <path d="M2 14h2"/>
                <path d="M20 14h2"/>
                <path d="M15 13v2"/>
                <path d="M9 13v2"/>
              </svg>
            </div>
            <div>
              <h2 class="text-sm font-bold text-gray-800">Loan Pool Advisor</h2>
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full" [class]="statusDotClass()"></span>
                <span class="text-xs text-gray-500">{{ statusLabel() }}</span>
              </div>
            </div>
          </div>
          <p class="text-xs text-gray-500 leading-relaxed">
            Autonomous agent for mortgage loan validation and pool construction
            per MortgageMax Seller/Servicer Guide requirements.
          </p>
        </div>

        <!-- Data Overview -->
        <div class="p-4 border-b border-gray-200">
          <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Data Overview</h3>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-600">Loans Loaded</span>
              <span class="text-xs font-semibold text-gray-800">{{ chatService.uploadedLoans().length }}</span>
            </div>
            @if (chatService.validationResults().length > 0) {
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-600">Eligible</span>
                <span class="text-xs font-semibold text-green-600">{{ eligibleCount() }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-600">Ineligible</span>
                <span class="text-xs font-semibold text-red-600">{{ ineligibleCount() }}</span>
              </div>
            }
            @if (chatService.currentPoolSummary(); as summary) {
              <div class="mt-3 pt-3 border-t border-gray-100">
                <div class="flex items-center justify-between">
                  <span class="text-xs text-gray-600">Eligible UPB</span>
                  <span class="text-xs font-semibold text-fm-blue">{{'$' + formatCurrency(summary.eligibleUPB) }}</span>
                </div>
                <div class="flex items-center justify-between mt-1">
                  <span class="text-xs text-gray-600">WA Rate</span>
                  <span class="text-xs font-semibold text-gray-800">{{ summary.weightedAvgRate }}%</span>
                </div>
                <div class="flex items-center justify-between mt-1">
                  <span class="text-xs text-gray-600">WA Coupon</span>
                  <span class="text-xs font-semibold text-gray-800">{{ summary.weightedAvgCoupon }}%</span>
                </div>
                <div class="flex items-center justify-between mt-1">
                  <span class="text-xs text-gray-600">WA Age</span>
                  <span class="text-xs font-semibold text-gray-800">{{ summary.weightedAvgAge }} mo</span>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Capabilities -->
        <div class="p-4 border-b border-gray-200">
          <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Capabilities</h3>
          <div class="space-y-2">
            @for (cap of capabilities; track cap.label) {
              <div class="flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-fm-blue flex-shrink-0 mt-0.5"
                     viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span class="text-xs text-gray-600">{{ cap.label }}</span>
              </div>
            }
          </div>
        </div>

        <!-- Agent Progress (visible during processing) -->
        @if (chatService.isProcessing()) {
          <div class="p-4 border-b border-gray-200">
            <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Agent Activity</h3>
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <div class="w-4 h-4 border-2 border-fm-blue border-t-transparent rounded-full animate-spin"></div>
                <span class="text-xs text-gray-600">{{ chatService.agentStatus().currentStep }}</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-1.5">
                <div class="bg-fm-blue h-1.5 rounded-full transition-all duration-500"
                     [style.width.%]="chatService.agentStatus().progress"></div>
              </div>
            </div>
          </div>
        }

        <!-- Supported Formats -->
        <div class="p-4">
          <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Accepted Formats</h3>
          <div class="flex flex-wrap gap-2">
            <span class="px-2 py-0.5 text-[10px] font-medium rounded-md bg-green-100 text-green-700">CSV</span>
            <span class="px-2 py-0.5 text-[10px] font-medium rounded-md bg-blue-100 text-blue-700">JSON</span>
            <span class="px-2 py-0.5 text-[10px] font-medium rounded-md bg-gray-100 text-gray-500">XLSX (planned)</span>
          </div>
        </div>
      </aside>

      <!-- ===== Main Chat Area ===== -->
      <main class="chat-area">
        <app-pool-chat />
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .pool-page-layout {
      display: flex;
      height: calc(100vh - 106px);
    }

    .info-panel {
      width: 280px;
      flex-shrink: 0;
      background: #ffffff;
      border-right: 1px solid #e5e7eb;
      overflow-y: auto;
    }

    .chat-area {
      flex: 1;
      min-width: 0;
      background: #ffffff;
    }

    @media (max-width: 768px) {
      .pool-page-layout {
        flex-direction: column;
      }
      .info-panel {
        width: 100%;
        max-height: 200px;
        border-right: none;
        border-bottom: 1px solid #e5e7eb;
      }
    }
  `],
})
export class PoolAssistantPageComponent {
  readonly chatService = inject(PoolLogicChatService);

  readonly eligibleCount = computed(() =>
    this.chatService.validationResults().filter(r => r.eligible).length
  );

  readonly ineligibleCount = computed(() =>
    this.chatService.validationResults().filter(r => !r.eligible).length
  );

  readonly statusLabel = computed(() => {
    const state = this.chatService.agentStatus().state;
    switch (state) {
      case 'idle': return 'Ready';
      case 'parsing': return 'Parsing file...';
      case 'validating': return 'Validating loans...';
      case 'building-pool': return 'Building pool...';
      case 'filtering': return 'Filtering...';
      case 'complete': return 'Complete';
      case 'error': return 'Error';
      default: return 'Ready';
    }
  });

  readonly statusDotClass = computed(() => {
    const state = this.chatService.agentStatus().state;
    if (state === 'error') return 'bg-red-500';
    if (state === 'idle' || state === 'complete') return 'bg-green-500 animate-pulse';
    return 'bg-yellow-500 animate-pulse';
  });

  readonly capabilities = [
    { label: 'Parse CSV, JSON loan files' },
    { label: 'Validate against PoolLogic rules' },
    { label: 'Explain rule failures in plain language' },
    { label: 'Filter loans by criteria' },
    { label: 'Build compliant loan pools' },
    { label: 'Return structured results & guidance' },
  ];

  formatCurrency(value: number): string {
    if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
    if (value >= 1_000) return (value / 1_000).toFixed(0) + 'K';
    return value.toLocaleString();
  }
}
