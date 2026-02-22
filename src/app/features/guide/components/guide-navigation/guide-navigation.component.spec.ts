import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GuideNavigationComponent } from './guide-navigation.component';
import { GuideDataService } from '../../services/guide-data.service';

describe('GuideNavigationComponent', () => {
  let component: GuideNavigationComponent;
  let fixture: ComponentFixture<GuideNavigationComponent>;
  let guideData: GuideDataService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuideNavigationComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(GuideNavigationComponent);
    component = fixture.componentInstance;
    guideData = TestBed.inject(GuideDataService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── Sidebar Structure ───────────────────────────────────────

  describe('sidebar structure', () => {
    it('should render aside element', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('aside')).toBeTruthy();
    });

    it('should display "Guide Contents" header', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Guide Contents');
    });

    it('should have a filter input', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const input = compiled.querySelector('input[placeholder="Filter sections..."]');
      expect(input).toBeTruthy();
    });

    it('should render nav tree items', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const treeItems = compiled.querySelectorAll('app-nav-tree-item');
      expect(treeItems.length).toBeGreaterThan(0);
    });

    it('should have Download Full Guide link', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Download Full Guide');
    });
  });

  // ── Collapse Toggle ─────────────────────────────────────────

  describe('collapse toggle', () => {
    it('should start in expanded state', () => {
      expect(component.collapsed()).toBeFalse();
    });

    it('should toggle collapsed state', () => {
      component.toggleCollapse();
      expect(component.collapsed()).toBeTrue();
    });

    it('should toggle back to expanded', () => {
      component.toggleCollapse();
      component.toggleCollapse();
      expect(component.collapsed()).toBeFalse();
    });

    it('should emit collapseToggled event', () => {
      spyOn(component.collapseToggled, 'emit');
      component.toggleCollapse();
      expect(component.collapseToggled.emit).toHaveBeenCalledWith(true);
    });

    it('should have collapse button', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const btn = compiled.querySelector('button[aria-label="Collapse sidebar"]');
      expect(btn).toBeTruthy();
    });
  });
});
