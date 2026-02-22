import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { Subscription } from 'rxjs';
import { GuideDataService } from '../../services/guide-data.service';
import { GuideNavigationComponent } from '../../components/guide-navigation/guide-navigation.component';
import { GuideContentComponent } from '../../components/guide-content/guide-content.component';
import { RelatedSidebarComponent } from '../../components/related-sidebar/related-sidebar.component';

@Component({
  selector: 'app-guide-page',
  standalone: true,
  imports: [
    GuideNavigationComponent,
    GuideContentComponent,
    RelatedSidebarComponent,
  ],
  template: `
    <div class="guide-layout relative">

      <!-- ===== Mobile Sidebar Overlay ===== -->
      @if (mobileSidebarOpen()) {
        <div
          class="sidebar-overlay"
          (click)="mobileSidebarOpen.set(false)"
        ></div>
      }

      <!-- ===== Left Sidebar: Guide Navigation ===== -->
      <div
        class="sidebar-wrapper"
        [class.mobile-open]="mobileSidebarOpen()"
        [class.mobile-closed]="!mobileSidebarOpen()"
        [class.nav-collapsed]="navCollapsed()"
      >
        <app-guide-navigation
          (collapseToggled)="onNavCollapseToggled($event)"
        />
      </div>

      <!-- ===== Collapsed Sidebar Toggle (Desktop) ===== -->
      @if (navCollapsed()) {
        <div class="collapsed-toggle">
          <button
            class="w-7 h-7 rounded flex items-center justify-center
                   text-fm-text hover:bg-fm-bg transition-colors"
            (click)="navCollapsed.set(false)"
            aria-label="Expand sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <polyline points="13 17 18 12 13 7"/>
              <polyline points="6 17 11 12 6 7"/>
            </svg>
          </button>
        </div>
      }

      <!-- ===== Mobile Sidebar Toggle Button ===== -->
      <button
        class="mobile-fab"
        (click)="toggleMobileSidebar()"
        aria-label="Toggle navigation"
      >
        @if (mobileSidebarOpen()) {
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        } @else {
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        }
      </button>

      <!-- ===== Main Content ===== -->
      <div class="content-area">
        <app-guide-content />
      </div>

      <!-- ===== Right Sidebar: Related Resources ===== -->
      <div class="right-sidebar">
        <app-related-sidebar />
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .guide-layout {
      display: flex;
      height: calc(100vh - 106px);
    }

    /* -- Left Sidebar -- */
    .sidebar-wrapper {
      width: 280px;
      flex-shrink: 0;
      z-index: 40;
      background: #fff;
      transition: transform 0.3s ease, width 0.3s ease;
    }

    @media (max-width: 1023px) {
      .sidebar-wrapper {
        position: fixed;
        top: 106px;
        bottom: 0;
        left: 0;
      }
      .sidebar-wrapper.mobile-closed { transform: translateX(-100%); }
      .sidebar-wrapper.mobile-open   { transform: translateX(0); }
    }

    @media (min-width: 1024px) {
      .sidebar-wrapper {
        position: relative;
        transform: translateX(0) !important;
      }
      .sidebar-wrapper.nav-collapsed {
        width: 0;
        overflow: hidden;
      }
    }

    /* -- Mobile Overlay -- */
    .sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 30;
    }
    @media (max-width: 1023px) {
      .sidebar-overlay { display: block; }
    }

    /* -- Collapsed Toggle -- */
    .collapsed-toggle {
      display: none;
      flex-shrink: 0;
      width: 40px;
      border-right: 1px solid #D9D9D9;
      background: #fff;
      align-items: flex-start;
      padding-top: 12px;
      justify-content: center;
    }
    @media (min-width: 1024px) {
      .collapsed-toggle { display: flex; }
    }

    /* -- Main Content -- */
    .content-area {
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }

    /* -- Right Sidebar -- */
    .right-sidebar {
      display: none;
      flex-shrink: 0;
      width: 280px;
    }
    @media (min-width: 1280px) {
      .right-sidebar { display: block; }
    }

    /* -- Mobile FAB -- */
    .mobile-fab {
      display: flex;
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 50;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #009BE4;
      color: #fff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      align-items: center;
      justify-content: center;
      border: none;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
    }
    .mobile-fab:hover { background: #0088cc; }
    .mobile-fab:active { transform: scale(0.95); }
    @media (min-width: 1024px) {
      .mobile-fab { display: none; }
    }
  `],
})
export class GuidePageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly guideData = inject(GuideDataService);
  private routeSub?: Subscription;

  readonly mobileSidebarOpen = signal(false);
  readonly navCollapsed = signal(false);

  ngOnInit(): void {
    this.routeSub = this.route.params.subscribe((params: Params) => {
      const sectionId = params['sectionId'];
      if (sectionId) {
        this.guideData.selectSection(sectionId);
        // Close mobile sidebar on navigation
        this.mobileSidebarOpen.set(false);
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  onNavCollapseToggled(collapsed: boolean): void {
    this.navCollapsed.set(collapsed);
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update((v: boolean) => !v);
  }
}
