import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink],
  template: `
    <!-- ===== Top Utility Bar ===== -->
    <div class="bg-[#666666] text-white text-xs">
      <div class="max-w-[1400px] mx-auto px-4 flex items-center justify-end h-8 gap-4">
        <a href="#" class="hover:underline transition-colors">MortgageMax.com</a>
        <span class="text-gray-400">|</span>
        <a href="#" class="hover:underline transition-colors">Multifamily Guide</a>
        <span class="text-gray-400">|</span>
        <a href="#" class="hover:underline transition-colors">Learning Center</a>
        <span class="text-gray-400">|</span>
        <a href="#" class="hover:underline transition-colors flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
            <polyline points="10 17 15 12 10 7"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
          Log In
        </a>
      </div>
    </div>

    <!-- ===== Main Header ===== -->
    <header class="bg-white border-b border-fm-border shadow-sm">
      <div class="max-w-[1400px] mx-auto px-4">

        <!-- Logo Row + Search -->
        <div class="flex items-center justify-between py-3 gap-4">
          <!-- Logo -->
          <a routerLink="/" class="flex items-center gap-3 flex-shrink-0">
            <!-- MortgageMax Logo Placeholder -->
            <div class="flex items-center">
              <div class="w-10 h-10 rounded-lg bg-fm-blue flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <div class="ml-2">
                <span class="text-fm-blue font-bold text-lg leading-tight block">MortgageMax</span>
                <span class="text-fm-text text-[11px] leading-tight block">Single-Family Seller/Servicer Guide</span>
              </div>
            </div>
          </a>

          <!-- Search Bar -->
          <div class="flex-1 max-w-2xl">
            <div class="relative">
              <input
                type="text"
                [placeholder]="searchPlaceholder()"
                (focus)="searchFocused.set(true)"
                (blur)="searchFocused.set(false)"
                class="w-full h-11 pl-4 pr-12 border-2 border-fm-border rounded-lg text-sm font-arial
                       text-fm-text placeholder-gray-400
                       focus:border-fm-blue focus:outline-none focus:ring-2 focus:ring-fm-blue/20
                       transition-all duration-200"
              />
              <button
                class="absolute right-0 top-0 h-11 w-11 flex items-center justify-center
                       bg-fm-blue text-white rounded-r-lg hover:bg-[#0088cc] transition-colors"
                aria-label="Search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Mobile Hamburger (visible on small screens) -->
          <button
            class="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg
                   border border-fm-border text-fm-text hover:bg-gray-100 transition-colors"
            (click)="mobileMenuOpen.set(!mobileMenuOpen())"
            aria-label="Toggle menu"
          >
            @if (mobileMenuOpen()) {
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            }
          </button>
        </div>

        <!-- Navigation Links -->
        <nav class="hidden lg:flex items-center gap-1 border-t border-fm-border -mb-px">
          @for (link of navLinks; track link.label) {
            <a
              [routerLink]="link.route"
              class="px-4 py-2.5 text-sm font-semibold text-fm-text
                     hover:text-fm-blue hover:border-b-2 hover:border-fm-blue
                     transition-all duration-150 cursor-pointer"
              [class.text-fm-blue]="isActive(link.route)"
              [class.border-b-2]="isActive(link.route)"
              [class.border-fm-blue]="isActive(link.route)"
            >
              {{ link.label }}
            </a>
          }
        </nav>
      </div>
    </header>

    <!-- Mobile Menu Dropdown -->
    @if (mobileMenuOpen()) {
      <div class="lg:hidden bg-white border-b border-fm-border shadow-lg animate-slideDown">
        <nav class="max-w-[1400px] mx-auto px-4 py-2">
          @for (link of navLinks; track link.label) {
            <a
              [routerLink]="link.route"
              class="block px-4 py-3 text-sm font-semibold text-fm-text
                     hover:text-fm-blue hover:bg-fm-bg rounded-lg transition-colors"
              (click)="mobileMenuOpen.set(false)"
            >
              {{ link.label }}
            </a>
          }
        </nav>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-slideDown {
      animation: slideDown 0.2s ease-out;
    }
  `],
})
export class HeaderComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private routerSub?: Subscription;

  readonly mobileMenuOpen = signal(false);
  readonly searchFocused = signal(false);
  readonly currentUrl = signal('/');

  readonly searchPlaceholder = signal(
    'Search the Guide — e.g., "borrower eligibility requirements" or "LTV ratio limits"'
  );

  readonly navLinks = [
    { label: 'Home', route: '/guide/4100' },
    { label: 'Bring Your Own Loans', route: '/bring-your-own-loans' },
    { label: 'Loan Pool Advisor', route: '/pool-assistant' },
    { label: 'Admin', route: '/admin/rules' },
    { label: 'Bulletins', route: '/guide/4100' },
    { label: 'FAQs', route: '/guide/4100' },
    { label: 'Forms & Documents', route: '/guide/4100' },
  ];

  ngOnInit(): void {
    this.currentUrl.set(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.currentUrl.set((e as NavigationEnd).urlAfterRedirects || (e as NavigationEnd).url);
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  isActive(route: string): boolean {
    const url = this.currentUrl();
    if (route === '/bring-your-own-loans') {
      return url.startsWith('/bring-your-own-loans');
    }
    if (route === '/pool-assistant') {
      return url.startsWith('/pool-assistant');
    }
    if (route === '/admin/rules') {
      return url.startsWith('/admin');
    }
    // Home or guide routes
    if (route.startsWith('/guide')) {
      return url.startsWith('/guide');
    }
    return url === route;
  }
}
