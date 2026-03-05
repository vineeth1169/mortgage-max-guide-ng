import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileUploadComponent } from '../file-upload/file-upload.component';
import { PreviewTableComponent } from '../preview-table/preview-table.component';
import { EligibilityResultsComponent } from '../eligibility-results/eligibility-results.component';
import {
  BYOLLoanRow,
  ValidatedLoanRow,
  EligibilityResponse,
  BYOLStep,
} from '../../models/byol.model';
import { FileParserService } from '../../services/file-parser.service';
import { LoanValidatorService } from '../../services/loan-validator.service';
import { EligibilityService } from '../../services/eligibility.service';
import { NotificationService } from '../../services/notification.service';

/**
 * BYOLTabComponent - Main component for Bring Your Own Loans workflow
 * 3-step workflow: Upload → Preview → Eligibility Results
 */
@Component({
  selector: 'app-byol-tab',
  standalone: true,
  imports: [
    CommonModule,
    FileUploadComponent,
    PreviewTableComponent,
    EligibilityResultsComponent,
  ],
  template: `
    <!-- Stepper Header -->
    <div class="byol-stepper flex gap-8 mb-8 px-6 pt-6">
      @for (s of STEPS; track s.key; let i = $index) {
        <div
          class="stepper-step flex items-center gap-3"
          [class.opacity-50]="i > currentStepIndex()"
        >
          <div
            class="stepper-circle w-10 h-10 rounded-full flex items-center justify-center font-semibold transition"
            [class.bg-blue-600]="i <= currentStepIndex()"
            [class.text-white]="i <= currentStepIndex()"
            [class.bg-gray-200]="i > currentStepIndex()"
            [class.text-gray-600]="i > currentStepIndex()"
          >
            @if (i < currentStepIndex()) {
              ✓
            } @else {
              {{ i + 1 }}
            }
          </div>
          <span class="stepper-label font-semibold text-gray-900">{{ s.label }}</span>
          @if (i < STEPS.length - 1) {
            <div
              class="stepper-line flex-1 h-1 rounded-full transition"
              [class.bg-blue-600]="i < currentStepIndex()"
              [class.bg-gray-200]="i >= currentStepIndex()"
            ></div>
          }
        </div>
      }
    </div>

    <!-- Panel header -->
    <div class="panel-header px-6 pb-6 flex justify-between items-start">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Bring Your Own Loans</h2>
        <p class="panel-subtitle text-gray-600 mt-2">
          @switch (currentStep()) {
            @case ('upload') {
              Upload a loan file to begin eligibility evaluation.
            }
            @case ('preview') {
              {{ validatedRows().length }} rows loaded — review and validate before submission.
            }
            @case ('results') {
              Eligibility evaluation complete. Review results below.
            }
          }
        </p>
      </div>

      <!-- Panel actions -->
      <div class="panel-actions flex gap-3">
        @if (currentStep() !== 'upload') {
          <button
            class="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded hover:bg-gray-50 transition flex items-center gap-2"
            (click)="
              currentStep() === 'preview'
                ? handleReset()
                : currentStep.set('preview')
            "
          >
            ← {{ currentStep() === 'preview' ? 'Start Over' : 'Back to Preview' }}
          </button>
        }
        @if (currentStep() === 'preview') {
          <button
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            [disabled]="validCount() === 0 || evaluating()"
            (click)="handleSubmitForEvaluation()"
          >
            @if (evaluating()) {
              ⟳ Evaluating…
            } @else {
              → Submit for Evaluation ({{ validCount() }})
            }
          </button>
        }
        @if (currentStep() === 'results') {
          <button
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center gap-2"
            (click)="handleReset()"
          >
            ⟳ New Upload
          </button>
        }
      </div>
    </div>

    <!-- Step content -->
    <div class="px-6 pb-6">
      @switch (currentStep()) {
        @case ('upload') {
          <app-file-upload
            [loading]="parsing()"
            (onFileSelected)="handleFileSelected($event)"
          />
        }
        @case ('preview') {
          <app-preview-table
            [rows]="validatedRows()"
            (onRemoveRow)="handleRemoveRow($event)"
          />
        }
        @case ('results') {
          @if (eligibilityResponse(); as response) {
            <app-eligibility-results
              [response]="response"
              [loans]="parsedRows()"
              (onRemoveIneligible)="handleRemoveIneligible($event)"
            />
          }
        }
      }
    </div>
  `,
  styles: [],
})
export class BYOLTabComponent {
  private readonly fileParserService = inject(FileParserService);
  private readonly loanValidatorService = inject(LoanValidatorService);
  private readonly eligibilityService = inject(EligibilityService);
  private readonly notificationService = inject(NotificationService);

  readonly STEPS = [
    { key: 'upload' as BYOLStep, label: 'Upload File' },
    { key: 'preview' as BYOLStep, label: 'Preview & Validate' },
    { key: 'results' as BYOLStep, label: 'Eligibility Results' },
  ];

  readonly currentStep = signal<BYOLStep>('upload');
  readonly parsing = signal(false);
  readonly evaluating = signal(false);
  readonly parsedRows = signal<BYOLLoanRow[]>([]);
  readonly validatedRows = signal<ValidatedLoanRow[]>([]);
  readonly eligibilityResponse = signal<EligibilityResponse | null>(null);

  currentStepIndex(): number {
    return this.STEPS.findIndex((s) => s.key === this.currentStep());
  }

  validCount(): number {
    return this.validatedRows().filter((vr) => vr.isValid).length;
  }

  /**
   * Step 1: File upload & parse
   */
  async handleFileSelected(file: File): Promise<void> {
    this.parsing.set(true);
    try {
      const rows = await this.fileParserService.parseFile(file);

      if (rows.length === 0) {
        this.notificationService.warning('File contains no data rows.');
        this.parsing.set(false);
        return;
      }

      this.parsedRows.set(rows);
      const validated = this.loanValidatorService.validateLoanRows(rows);
      this.validatedRows.set(validated);

      this.notificationService.success(`${rows.length} rows parsed from ${file.name}`);
      this.currentStep.set('preview');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to parse file.';
      this.notificationService.error(message);
    } finally {
      this.parsing.set(false);
    }
  }

  /**
   * Step 2: Remove row from preview
   */
  handleRemoveRow(rowIndex: number): void {
    this.parsedRows.update((prev) =>
      prev.filter((r) => r._rowIndex !== rowIndex)
    );
    this.validatedRows.update((prev) =>
      prev.filter((vr) => vr.row._rowIndex !== rowIndex)
    );
    this.notificationService.info(`Row ${rowIndex} removed.`);
  }

  /**
   * Step 3: Submit for eligibility evaluation
   */
  async handleSubmitForEvaluation(): Promise<void> {
    const validLoans = this.validatedRows()
      .filter((vr) => vr.isValid)
      .map((vr) => vr.row);

    if (validLoans.length === 0) {
      this.notificationService.warning(
        'No valid loans to submit. Fix validation errors first.'
      );
      return;
    }

    this.evaluating.set(true);
    try {
      const response = await this.eligibilityService.evaluateEligibility(
        validLoans
      );
      this.eligibilityResponse.set(response);

      const message = `Evaluation complete: ${response.summary.eligible} eligible, ${response.summary.ineligible} ineligible.`;
      this.notificationService.success(message);
      this.currentStep.set('results');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Eligibility evaluation failed.';
      this.notificationService.error(message);
    } finally {
      this.evaluating.set(false);
    }
  }

  /**
   * Remove ineligible loan from results
   */
  handleRemoveIneligible(loanNumber: string): void {
    this.eligibilityResponse.update((prev) => {
      if (!prev) return prev;

      const newResults = prev.results.filter(
        (r) => r.loanNumber !== loanNumber
      );
      return {
        results: newResults,
        summary: {
          total: newResults.length,
          eligible: newResults.filter((r) => r.eligible).length,
          ineligible: newResults.filter((r) => !r.eligible).length,
        },
      };
    });
    this.notificationService.info(`Loan ${loanNumber} removed from results.`);
  }

  /**
   * Reset to start
   */
  handleReset(): void {
    this.currentStep.set('upload');
    this.parsedRows.set([]);
    this.validatedRows.set([]);
    this.eligibilityResponse.set(null);
  }
}
