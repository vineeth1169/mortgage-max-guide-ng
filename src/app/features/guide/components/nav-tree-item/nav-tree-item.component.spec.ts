import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { NavTreeItemComponent } from './nav-tree-item.component';
import { GuideDataService } from '../../services/guide-data.service';
import { NavigationItem } from '../../models/navigation.model';

describe('NavTreeItemComponent', () => {
  let component: NavTreeItemComponent;
  let fixture: ComponentFixture<NavTreeItemComponent>;
  let guideData: GuideDataService;
  let router: Router;

  const mockItems: NavigationItem[] = [
    {
      id: '1000',
      title: 'Series 1000: Test Series',
      children: [
        { id: '1100', title: 'Chapter 1100: Test Chapter' },
        { id: '1200', title: 'Chapter 1200: Another Chapter' },
      ],
    },
    {
      id: '2000',
      title: 'Series 2000: Another Series',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavTreeItemComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NavTreeItemComponent);
    component = fixture.componentInstance;
    guideData = TestBed.inject(GuideDataService);
    router = TestBed.inject(Router);

    fixture.componentRef.setInput('items', mockItems);
    fixture.componentRef.setInput('level', 0);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── Rendering ───────────────────────────────────────────────

  describe('rendering', () => {
    it('should render all top-level items', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Series 1000');
      expect(compiled.textContent).toContain('Series 2000');
    });

    it('should show chevron for items with children', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const svgs = compiled.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });

    it('should NOT show children when parent is collapsed', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('Chapter 1100');
    });

    it('should show children when parent is expanded', () => {
      guideData.toggleNode('1000');
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Chapter 1100');
      expect(compiled.textContent).toContain('Chapter 1200');
    });
  });

  // ── Toggle Behavior ─────────────────────────────────────────

  describe('toggle behavior', () => {
    it('should toggle expansion when clicking item with children', () => {
      expect(guideData.isExpanded('1000')).toBeFalse();
      component.onItemClick(mockItems[0]);
      expect(guideData.isExpanded('1000')).toBeTrue();
    });

    it('should collapse when toggling an expanded item', () => {
      guideData.toggleNode('1000');
      expect(guideData.isExpanded('1000')).toBeTrue();
      component.onItemClick(mockItems[0]);
      expect(guideData.isExpanded('1000')).toBeFalse();
    });

    it('should NOT toggle for leaf items', () => {
      component.onItemClick(mockItems[1]);
      expect(guideData.isExpanded('2000')).toBeFalse();
    });
  });

  // ── Selection & Navigation ──────────────────────────────────

  describe('selection and navigation', () => {
    it('should select section on click', () => {
      component.onItemClick(mockItems[1]);
      expect(guideData.selectedSectionId()).toBe('2000');
    });

    it('should navigate on click', () => {
      spyOn(router, 'navigate');
      component.onItemClick(mockItems[0]);
      expect(router.navigate).toHaveBeenCalledWith(['/guide', '1000']);
    });

    it('should navigate leaf items', () => {
      spyOn(router, 'navigate');
      component.onItemClick(mockItems[1]);
      expect(router.navigate).toHaveBeenCalledWith(['/guide', '2000']);
    });
  });

  // ── Active State ────────────────────────────────────────────

  describe('active state', () => {
    it('should highlight the selected section with orange indicator', () => {
      guideData.selectSection('2000');
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const indicator = compiled.querySelector('.bg-fm-orange');
      expect(indicator).toBeTruthy();
    });

    it('should not highlight non-selected items', () => {
      guideData.selectSection('9999');
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const indicators = compiled.querySelectorAll('.bg-fm-orange');
      expect(indicators.length).toBe(0);
    });
  });
});
