import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EligibilityResponse, BYOLLoanRow } from '../../models/byol.model';
import { CsvExporterService } from '../../services/csv-exporter.service';

/**
 * EligibilityResultsComponent - Show eligible (green) / ineligible (red) loans
 * with expandable rule failure details
 */
@Component({
  selector: 'app-eligibility-results',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="byol-results-card p-6 bg-white rounded-lg border border-gray-200">
      <!-- Summary bar -->
      <div class="results-summary flex gap-8 mb-6 pb-6 border-b border-gray-200">
        <div class="summary-stat">
          <span class="stat-num text-2xl font-bold text-gray-900">{{ response().summary.total }}</span>
          <span class="stat-label text-sm text-gray-600">Total Loans</span>
        </div>
        <div class="summary-stat">
          <span class="stat-num text-2xl font-bold text-green-600">{{ response().summary.eligible }}</span>
          <span class="stat-label text-sm text-gray-600">Eligible</span>
        </div>
        <div class="summary-stat">
          <span class="stat-num text-2xl font-bold text-red-600">{{ response().summary.ineligible }}</span>
          <span class="stat-label text-sm text-gray-600">Ineligible</span>
        </div>
        @if (response().summary.ineligible > 0) {
          <button
            class="ml-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center gap-2"
            (click)="exportIneligible()"
          >
            💾 Export Ineligible
          </button>
        }
      </div>

      <!-- Results list -->
      <div class="results-list space-y-4">
        @for (result of response().results; track result.loanNumber) {
          <div
            class="eligibility-row border rounded-lg overflow-hidden transition"
            [class.border-green-300]="result.eligible"
            [class.bg-green-50]="result.eligible"
            [class.border-red-300]="!result.eligible"
            [class.bg-red-50]="!result.eligible"
          >
            <!-- Row header -->
            <div
              class="elig-row-header p-4 flex items-center gap-4 cursor-pointer hover:opacity-80 transition"
              (click)="toggleExpanded(result.loanNumber)"
            >
              <span class="elig-icon text-lg">
                @if (result.eligible) {
                  <span class="text-green-600">✓</span>
                } @else {
                  <span class="text-red-600">✗</span>
                }
              </span>
              <span class="elig-loan-num font-mono font-semibold text-gray-900">
                {{ result.loanNumber }}
              </span>
              <span
                class="elig-badge px-3 py-1 rounded-full text-xs font-semibold"
                [class.bg-green-200]="result.eligible"
                [class.text-green-800]="result.eligible"
                [class.bg-red-200]="!result.eligible"
                [class.text-red-800]="!result.eligible"
              >
                @if (result.eligible) {
                  Eligible
                } @else {
                  {{ result.failures.length }} rule failure{{ result.failures.length > 1 ? 's' : '' }}
                }
              </span>

              <!-- Actions -->
              @if (!result.eligible) {
                <span class="elig-actions ml-auto flex items-center gap-2">
                  <button
                    class="text-gray-400 hover:text-gray-600 transition"
                    title="Toggle failures"
                    (click)="toggleExpanded(result.loanNumber); $event.stopPropagation()"
                  >
                    @if (expandedLoans[result.loanNumber]) {
                      ▼
                    } @else {
                      ▶
                    }
                  </button>
                  <button
                    class="text-red-600 hover:text-red-800 transition"
                    title="Remove from results"
                    (click)="onRemoveIneligible.emit(result.loanNumber); $event.stopPropagation()"
                  >
                    🗑️
                  </button>
                </span>
              }
            </div>

            <!-- Expandable failures -->
            @if (expandedLoans[result.loanNumber] && !result.eligible && result.failures.length > 0) {
              <div class="elig-failures border-t border-current border-opacity-20 p-4 bg-opacity-50">
                @for (failure of result.failures; track failure.ruleId) {
                  <div class="elig-failure-item mb-3 pb-3 border-b border-gray-200 last:border-b-0 last:mb-0 last:pb-0">
                    <div class="flex items-start justify-between mb-2">
                      <span class="failure-rule font-mono text-sm font-semibold text-gray-900">
                        {{ failure.ruleId }} — {{ failure.ruleName }}
                      </span>
                      <span
                        class="failure-severity text-xs font-semibold px-2 py-1 rounded"
                        [class.bg-red-200]="failure.severity === 'error'"
                        [class.text-red-800]="failure.severity === 'error'"
                        [class.bg-amber-200]="failure.severity === 'warning'"
                        [class.text-amber-800]="failure.severity === 'warning'"
                      >
                        {{ failure.severity }}
                      </span>
                    </div>
                    <span class="failure-msg text-sm text-gray-700">{{ failure.message }}</span>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [],
})
export class EligibilityResultsComponent {
  readonly response = input.required<EligibilityResponse>();
  readonly loans = input.required<BYOLLoanRow[]>();
  readonly onRemoveIneligible = output<string>();

  expandedLoans: Record<string, boolean> = {};

  constructor(private csvExporter: CsvExporterService) {}

  toggleExpanded(loanNumber: string): void {
    this.expandedLoans[loanNumber] = !this.expandedLoans[loanNumber];
  }

  exportIneligible(): void {
    this.csvExporter.downloadIneligibleCsv(
      this.response().results,
      this.loans()
    );
  }
}
