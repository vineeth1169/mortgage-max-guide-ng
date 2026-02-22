import { Component, signal, output } from '@angular/core';
import { GuideDataService } from '../../services/guide-data.service';
import { NavTreeItemComponent } from '../nav-tree-item/nav-tree-item.component';

@Component({
  selector: 'app-guide-navigation',
  standalone: true,
  imports: [NavTreeItemComponent],
  template: `
    <aside
      class="bg-white border-r border-fm-border h-full overflow-y-auto font-arial"
    >
      <!-- Sidebar Header -->
      <div class="sticky top-0 bg-white z-10 border-b border-fm-border">
        <div class="flex items-center justify-between px-4 py-3">
          <h2 class="text-sm font-bold text-fm-text uppercase tracking-wide">Guide Contents</h2>
          <!-- Collapse Toggle (Desktop) -->
          <button
            class="hidden lg:flex items-center justify-center w-7 h-7 rounded
                   text-fm-text hover:bg-fm-bg transition-colors"
            (click)="toggleCollapse()"
            [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 transition-transform duration-200"
                 [class.-scale-x-100]="collapsed()"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="11 17 6 12 11 7"/>
              <polyline points="18 17 13 12 18 7"/>
            </svg>
          </button>
        </div>

        <!-- Quick Filter -->
        <div class="px-3 pb-3">
          <div class="relative">
            <svg xmlns="http://www.w3.org/2000/svg"
                 class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Filter sections..."
              class="w-full h-8 pl-9 pr-3 text-xs border border-fm-border rounded-md
                     text-fm-text placeholder-gray-400
                     focus:border-fm-blue focus:outline-none focus:ring-1 focus:ring-fm-blue/20
                     transition-all"
            />
          </div>
        </div>
      </div>

      <!-- Navigation Tree -->
      <div class="py-2 relative">
        <app-nav-tree-item
          [items]="guideData.navigationTree()"
          [level]="0"
        />
      </div>

      <!-- Sidebar Footer -->
      <div class="sticky bottom-0 bg-white border-t border-fm-border px-4 py-3">
        <a href="#" class="flex items-center gap-2 text-xs text-fm-blue hover:underline">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download Full Guide (PDF)
        </a>
      </div>
    </aside>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `],
})
export class GuideNavigationComponent {
  readonly collapsed = signal(false);
  readonly collapseToggled = output<boolean>();

  constructor(public guideData: GuideDataService) {}

  toggleCollapse(): void {
    this.collapsed.update((v: boolean) => !v);
    this.collapseToggled.emit(this.collapsed());
  }
}
