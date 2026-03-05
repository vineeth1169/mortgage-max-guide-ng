import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ValidatedLoanRow } from '../../models/byol.model';
import { LoanValidatorService } from '../../services/loan-validator.service';

/**
 * PreviewTableComponent - Display parsed & validated loan rows
 * Highlights missing / invalid fields. Row removal supported.
 */
@Component({
  selector: 'app-preview-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="byol-preview-card p-6 bg-white rounded-lg border border-gray-200">
      <!-- Summary strip -->
      <div class="preview-summary flex gap-6 mb-6 pb-6 border-b border-gray-200">
        <span class="preview-total font-semibold text-gray-900">{{ rows().length }} rows parsed</span>
        <span class="preview-valid flex items-center gap-2 text-green-600">
          ✓ {{ validCount() }} valid
        </span>
        @if (invalidCount() > 0) {
          <span class="preview-invalid flex items-center gap-2 text-amber-600">
            ⚠️ {{ invalidCount() }} with issues
          </span>
        }
      </div>

      <!-- Table wrapper -->
      <div class="table-wrap overflow-x-auto">
        <table class="data-table preview-table w-full text-sm border-collapse">
          <thead>
            <tr class="border-b border-gray-200 bg-gray-50">
              <th class="row-num px-4 py-3 text-left font-semibold text-gray-700">#</th>
              @for (col of COLUMNS; track col.key) {
                <th class="px-4 py-3 text-left font-semibold text-gray-700">{{ col.label }}</th>
              }
              <th class="row-status px-4 py-3 text-left font-semibold text-gray-700">Valid</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            @for (vr of rows(); track vr.row._rowIndex) {
              <tr
                [class.bg-red-50]="!vr.isValid"
                class="border-b border-gray-100 hover:bg-gray-50 transition"
              >
                <td class="row-num px-4 py-3 font-mono text-gray-600">{{ vr.row._rowIndex }}</td>
                @for (col of COLUMNS; track col.key) {
                  @let hasError = errorFields(vr).has(col.key);
                  <td
                    class="px-4 py-3"
                    [class.bg-red-100]="hasError"
                    [class.text-red-700]="hasError"
                    [title]="hasError ? 'Invalid or missing data' : ''"
                  >
                    {{ formatCell(getValue(vr.row, col.key)) }}
                  </td>
                }
                <td class="row-status px-4 py-3 text-center">
                  @if (vr.isValid) {
                    <span class="text-green-600 font-semibold">✓</span>
                  } @else {
                    <span class="text-red-600 font-semibold">✗</span>
                  }
                </td>
                <td class="px-4 py-3 text-right">
                  <button
                    class="text-red-600 hover:text-red-800 transition text-lg"
                    title="Remove row"
                    (click)="onRemoveRow.emit(vr.row._rowIndex)"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
              @if (!vr.isValid && vr.errors.length > 0) {
                <tr class="bg-red-50 border-b border-gray-100">
                  <td colspan="15" class="px-4 py-3">
                    <div class="text-xs text-red-700">
                      <strong>Issues:</strong> {{ getErrorMessages(vr) }}
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [],
})
export class PreviewTableComponent {
  readonly validatorService = new LoanValidatorService();

  readonly rows = input<ValidatedLoanRow[]>([]);
  readonly onRemoveRow = output<number>();

  readonly COLUMNS = [
    { key: 'loanNumber', label: 'Loan #' },
    { key: 'poolNumber', label: 'Pool #' },
    { key: 'interestRate', label: 'Int Rate' },
    { key: 'couponRate', label: 'Coupon' },
    { key: 'netYield', label: 'Net Yield' },
    { key: 'loanAgeMonths', label: 'Age (Mo)' },
    { key: 'loanStatusCode', label: 'Status' },
    { key: 'rateTypeCode', label: 'Rate Type' },
    { key: 'currentInvestorBalance', label: 'Inv Balance' },
    { key: 'propertyType', label: 'Prop Type' },
    { key: 'specialCategory', label: 'Special Cat' },
    { key: 'upb', label: 'UPB' },
  ];

  validCount(): number {
    return this.rows().filter((r) => r.isValid).length;
  }

  invalidCount(): number {
    return this.rows().length - this.validCount();
  }

  errorFields(vr: ValidatedLoanRow): Set<string> {
    return this.validatorService.getErrorFields(vr);
  }

  getErrorMessages(vr: ValidatedLoanRow): string {
    return vr.errors.map((e) => e.message).join('; ');
  }

  getValue(row: any, key: string): unknown {
    return (row as Record<string, unknown>)[key];
  }

  formatCell(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'number') {
      return value.toLocaleString('en-US');
    }
    return String(value);
  }
}
