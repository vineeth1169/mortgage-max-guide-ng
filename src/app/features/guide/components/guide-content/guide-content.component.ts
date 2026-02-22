import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GuideDataService } from '../../services/guide-data.service';

@Component({
  selector: 'app-guide-content',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="h-full overflow-y-auto">

      <!-- ===== Sticky Breadcrumbs ===== -->
      <div class="sticky top-0 z-10 bg-fm-bg border-b border-fm-border">
        <div class="px-6 py-2.5 flex items-center gap-1.5 text-xs text-fm-text">
          @for (crumb of guideData.currentSection().breadcrumbs; track crumb.label; let last = $last) {
            @if (!last) {
              <a
                [routerLink]="crumb.sectionId ? ['/guide', crumb.sectionId] : ['/']"
                class="hover:text-fm-blue hover:underline transition-colors cursor-pointer"
              >
                {{ crumb.label }}
              </a>
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-gray-400 flex-shrink-0"
                   viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            } @else {
              <span class="font-semibold text-fm-text">{{ crumb.label }}</span>
            }
          }
        </div>
      </div>

      <!-- ===== Content Area ===== -->
      <div class="px-6 py-6 max-w-4xl">

        <!-- Page Title (H1 in Orange) -->
        <h1 class="text-2xl lg:text-[28px] font-bold text-fm-orange font-arial leading-tight mb-4">
          {{ guideData.currentSection().title }}
        </h1>

        <!-- Effective Date Banner -->
        <div class="flex items-center gap-2.5 bg-blue-50 border border-fm-blue/20 rounded-lg px-4 py-2.5 mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-fm-blue flex-shrink-0"
               viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span class="text-sm text-fm-blue font-semibold">
            Effective Date: {{ guideData.currentSection().effectiveDate }}
          </span>
          <span class="text-xs text-fm-text ml-auto hidden sm:inline">
            Last updated via Guide Bulletin
          </span>
        </div>

        <!-- Guide Text Content -->
        <div
          class="prose prose-sm max-w-none text-fm-text leading-relaxed
                 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-fm-text [&_h2]:mt-6 [&_h2]:mb-3
                 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-fm-text [&_h3]:mt-4 [&_h3]:mb-2
                 [&_p]:mb-4 [&_p]:text-[15px] [&_p]:leading-relaxed
                 [&_ul]:mb-4 [&_ul]:space-y-1
                 [&_li]:text-[15px] [&_li]:leading-relaxed
                 [&_a]:text-fm-blue [&_a]:hover:underline
                 [&_strong]:text-gray-700"
          [innerHTML]="guideData.currentSection().contentHtml"
        ></div>

        <!-- ===== Data Table with Sticky Headers ===== -->
        @if (guideData.currentSection().tableData) {
          <div class="mt-8 mb-6">
            <h2 class="text-lg font-bold text-fm-text mb-3">
              Eligibility Matrix
            </h2>
            <div class="sticky-table-container rounded-lg shadow-sm">
              <table class="w-full text-sm text-left border-collapse min-w-[700px]">
                <thead>
                  <tr>
                    @for (header of guideData.currentSection().tableData!.headers; track header) {
                      <th class="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider
                                 bg-fm-blue border-r border-blue-400/30 last:border-r-0
                                 sticky top-0 z-10">
                        {{ header }}
                      </th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of guideData.currentSection().tableData!.rows; track $index; let even = $even) {
                    <tr [class]="even ? 'bg-white' : 'bg-gray-50'"
                        class="hover:bg-blue-50/50 transition-colors border-b border-fm-border">
                      @for (cell of row; track $index; let first = $first) {
                        <td class="px-4 py-3 text-fm-text border-r border-fm-border/50 last:border-r-0"
                            [class.font-semibold]="first">
                          {{ cell }}
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="text-xs text-gray-400 mt-2 italic">
              * This matrix is for illustration purposes. Refer to the complete Guide section for detailed requirements and exceptions.
            </p>
          </div>
        }

        <!-- Section Footer -->
        <div class="mt-10 pt-6 border-t border-fm-border">
          <div class="flex items-center justify-between text-xs text-gray-400">
            <span>MortgageMax Single-Family Seller/Servicer Guide</span>
            <div class="flex items-center gap-4">
              <button class="flex items-center gap-1 text-fm-blue hover:underline">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                Print Section
              </button>
              <button class="flex items-center gap-1 text-fm-blue hover:underline">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                Copy Link
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `],
})
export class GuideContentComponent {
  readonly guideData = inject(GuideDataService);
}
