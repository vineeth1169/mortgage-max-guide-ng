import { Component, input, forwardRef } from '@angular/core';
import { Router } from '@angular/router';
import { GuideDataService } from '../../services/guide-data.service';
import { NavigationItem } from '../../models/navigation.model';

@Component({
  selector: 'app-nav-tree-item',
  standalone: true,
  imports: [forwardRef(() => NavTreeItemComponent)],
  template: `
    @for (item of items(); track item.id) {
      <div class="select-none relative">
        <!-- Node Row -->
        <div
          class="flex items-center gap-1 cursor-pointer group"
          [style.padding-left.px]="level() * 16 + 8"
          (click)="onItemClick(item)"
        >
          <!-- Expand/Collapse Chevron -->
          @if (item.children && item.children.length > 0) {
            <span
              class="w-5 h-5 flex items-center justify-center flex-shrink-0 text-fm-text
                     transition-transform duration-200"
              [class.rotate-90]="guideData.isExpanded(item.id)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2.5"
                   stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </span>
          } @else {
            <span class="w-5 h-5 flex-shrink-0"></span>
          }

          <!-- Label -->
          <span
            class="py-2 pr-2 text-[13px] leading-snug flex-1 rounded-r-md transition-colors duration-150
                   group-hover:text-[#D97600]"
            [class.text-fm-orange]="guideData.selectedSectionId() === item.id"
            [class.font-bold]="guideData.selectedSectionId() === item.id"
            [class.text-fm-text]="guideData.selectedSectionId() !== item.id"
          >
            {{ item.title }}
          </span>
        </div>

        <!-- Active Indicator -->
        @if (guideData.selectedSectionId() === item.id) {
          <div class="absolute left-0 top-0 bottom-0 w-[3px] bg-fm-orange rounded-r"></div>
        }

        <!-- Children (recursive) -->
        @if (item.children && item.children.length > 0 && guideData.isExpanded(item.id)) {
          <div class="overflow-hidden">
            <app-nav-tree-item
              [items]="item.children"
              [level]="level() + 1"
            />
          </div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class NavTreeItemComponent {
  readonly items = input.required<NavigationItem[]>();
  readonly level = input<number>(0);

  constructor(
    public guideData: GuideDataService,
    private router: Router,
  ) {}

  onItemClick(item: NavigationItem): void {
    if (item.children && item.children.length > 0) {
      this.guideData.toggleNode(item.id);
    }
    // Navigate to this section
    this.guideData.selectSection(item.id);
    this.router.navigate(['/guide', item.id]);
  }
}
