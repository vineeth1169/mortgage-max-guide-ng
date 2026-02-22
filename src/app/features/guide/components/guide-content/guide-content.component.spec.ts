import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GuideContentComponent } from './guide-content.component';
import { GuideDataService } from '../../services/guide-data.service';

describe('GuideContentComponent', () => {
  let component: GuideContentComponent;
  let fixture: ComponentFixture<GuideContentComponent>;
  let guideData: GuideDataService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuideContentComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(GuideContentComponent);
    component = fixture.componentInstance;
    guideData = TestBed.inject(GuideDataService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── Breadcrumbs ─────────────────────────────────────────────

  describe('breadcrumbs', () => {
    it('should render breadcrumbs', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const section = guideData.currentSection();
      if (section.breadcrumbs && section.breadcrumbs.length > 0) {
        const lastCrumb = section.breadcrumbs[section.breadcrumbs.length - 1];
        expect(compiled.textContent).toContain(lastCrumb.label);
      }
    });

    it('should render breadcrumb separators', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const section = guideData.currentSection();
      if (section.breadcrumbs && section.breadcrumbs.length > 1) {
        const svgs = compiled.querySelectorAll('svg');
        expect(svgs.length).toBeGreaterThan(0);
      }
    });

    it('should render last breadcrumb as plain text', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const section = guideData.currentSection();
      if (section.breadcrumbs && section.breadcrumbs.length > 0) {
        const lastCrumb = section.breadcrumbs[section.breadcrumbs.length - 1];
        const spans = compiled.querySelectorAll('.font-semibold');
        const matchingSpan = Array.from(spans).find(s =>
          s.textContent?.trim() === lastCrumb.label
        );
        expect(matchingSpan).toBeTruthy();
      }
    });
  });

  // ── Page Title ──────────────────────────────────────────────

  describe('page title', () => {
    it('should display section title in H1', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const h1 = compiled.querySelector('h1');
      expect(h1).toBeTruthy();
      expect(h1?.textContent?.trim()).toBe(guideData.currentSection().title);
    });

    it('should style title with orange MortgageMax color', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const h1 = compiled.querySelector('h1');
      expect(h1?.classList.contains('text-fm-orange')).toBeTrue();
    });
  });

  // ── Effective Date Banner ───────────────────────────────────

  describe('effective date banner', () => {
    it('should display effective date', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Effective Date');
      expect(compiled.textContent).toContain(guideData.currentSection().effectiveDate);
    });

    it('should have blue styling', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const banner = compiled.querySelector('.bg-blue-50');
      expect(banner).toBeTruthy();
    });
  });

  // ── Content Area ────────────────────────────────────────────

  describe('content area', () => {
    it('should render HTML content', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const contentDiv = compiled.querySelector('[class*="prose"]');
      expect(contentDiv).toBeTruthy();
      expect(contentDiv?.innerHTML).toBeTruthy();
    });

    it('should use innerHTML binding for content', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const contentDiv = compiled.querySelector('[class*="prose"]');
      // Content should be non-empty and contain HTML from the service
      expect(contentDiv?.textContent?.trim().length).toBeGreaterThan(0);
    });
  });

  // ── Data Table ──────────────────────────────────────────────

  describe('data table', () => {
    it('should show table when section has tableData', () => {
      // Select a section that has table data (4101)
      guideData.selectSection('4101');
      fixture.detectChanges();
      const section = guideData.currentSection();
      if (section.tableData) {
        const compiled = fixture.nativeElement as HTMLElement;
        const table = compiled.querySelector('table');
        expect(table).toBeTruthy();
      }
    });

    it('should NOT show table when section has no tableData', () => {
      // Select a section without table data (1100)
      guideData.selectSection('1100');
      fixture.detectChanges();
      const section = guideData.currentSection();
      if (!section.tableData) {
        const compiled = fixture.nativeElement as HTMLElement;
        const table = compiled.querySelector('table');
        expect(table).toBeFalsy();
      }
    });

    it('should render correct number of header columns', () => {
      guideData.selectSection('4101');
      fixture.detectChanges();
      const section = guideData.currentSection();
      if (section.tableData) {
        const compiled = fixture.nativeElement as HTMLElement;
        const headers = compiled.querySelectorAll('th');
        expect(headers.length).toBe(section.tableData.headers.length);
      }
    });

    it('should render correct number of rows', () => {
      guideData.selectSection('4101');
      fixture.detectChanges();
      const section = guideData.currentSection();
      if (section.tableData) {
        const compiled = fixture.nativeElement as HTMLElement;
        const rows = compiled.querySelectorAll('tbody tr');
        expect(rows.length).toBe(section.tableData.rows.length);
      }
    });
  });

  // ── Section Footer ──────────────────────────────────────────

  describe('section footer', () => {
    it('should have Print Section button', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Print Section');
    });

    it('should have Copy Link button', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Copy Link');
    });

    it('should display MortgageMax attribution', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('MortgageMax Single-Family Seller/Servicer Guide');
    });
  });

  // ── Section Switching ───────────────────────────────────────

  describe('section switching', () => {
    it('should update content when section changes', () => {
      const initialTitle = guideData.currentSection().title;
      guideData.selectSection('5100');
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const h1 = compiled.querySelector('h1');
      const newTitle = guideData.currentSection().title;
      expect(h1?.textContent?.trim()).toBe(newTitle);
      expect(newTitle).not.toBe(initialTitle);
    });
  });
});
