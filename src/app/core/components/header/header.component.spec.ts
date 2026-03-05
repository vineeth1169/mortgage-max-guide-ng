import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── Utility Bar ─────────────────────────────────────────────

  describe('utility bar', () => {
    it('should render utility bar links', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const utilityBar = compiled.querySelector('.bg-\\[\\#666666\\]');
      expect(utilityBar).toBeTruthy();
    });

    it('should have MortgageMax.com link', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const links = compiled.querySelectorAll('a');
      const mortgageMaxLink = Array.from(links).find(
        l => l.textContent?.includes('MortgageMax.com')
      );
      expect(mortgageMaxLink).toBeTruthy();
    });

    it('should have Log In link', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const links = compiled.querySelectorAll('a');
      const loginLink = Array.from(links).find(
        l => l.textContent?.includes('Log In')
      );
      expect(loginLink).toBeTruthy();
    });
  });

  // ── Logo & Branding ─────────────────────────────────────────

  describe('logo and branding', () => {
    it('should display MortgageMax text', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('MortgageMax');
    });

    it('should display subtitle', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Single-Family Seller/Servicer Guide');
    });
  });

  // ── Search ──────────────────────────────────────────────────

  describe('search', () => {
    it('should have a search input', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const input = compiled.querySelector('input[type="text"]');
      expect(input).toBeTruthy();
    });

    it('should have a search button', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const btn = compiled.querySelector('button[aria-label="Search"]');
      expect(btn).toBeTruthy();
    });

    it('should have default placeholder text', () => {
      expect(component.searchPlaceholder()).toContain('Search the Guide');
    });

    it('should track search focus state', () => {
      expect(component.searchFocused()).toBeFalse();
      component.searchFocused.set(true);
      expect(component.searchFocused()).toBeTrue();
    });
  });

  // ── Navigation Links ────────────────────────────────────────

  describe('navigation links', () => {
    it('should have 7 nav links defined', () => {
      expect(component.navLinks.length).toBe(7);
    });

    it('should have Home as first nav link', () => {
      expect(component.navLinks[0].label).toBe('Home');
    });

    it('should have Bring Your Own Loans as second nav link', () => {
      expect(component.navLinks[1].label).toBe('Bring Your Own Loans');
    });

    it('should have Bulletins link', () => {
      const bulletins = component.navLinks.find(l => l.label === 'Bulletins');
      expect(bulletins).toBeTruthy();
    });

    it('should identify pool-assistant route correctly', () => {
      component.currentUrl.set('/pool-assistant');
      expect(component.isActive('/pool-assistant')).toBeTrue();
    });
  });

  // ── Mobile Menu ─────────────────────────────────────────────

  describe('mobile menu', () => {
    it('should start with menu closed', () => {
      expect(component.mobileMenuOpen()).toBeFalse();
    });

    it('should toggle mobile menu open', () => {
      component.mobileMenuOpen.set(true);
      expect(component.mobileMenuOpen()).toBeTrue();
    });

    it('should have hamburger button', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const btn = compiled.querySelector('button[aria-label="Toggle menu"]');
      expect(btn).toBeTruthy();
    });

    it('should show mobile menu when open', () => {
      component.mobileMenuOpen.set(true);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      // Mobile dropdown should appear
      const mobileNav = compiled.querySelectorAll('nav');
      expect(mobileNav.length).toBeGreaterThan(0);
    });
  });
});
