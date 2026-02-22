import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { GuidePageComponent } from './guide-page.component';
import { GuideDataService } from '../../services/guide-data.service';
import { routes } from '../../../../app.routes';

describe('GuidePageComponent', () => {
  let component: GuidePageComponent;
  let fixture: ComponentFixture<GuidePageComponent>;
  let guideData: GuideDataService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuidePageComponent],
      providers: [provideRouter(routes)],
    }).compileComponents();

    fixture = TestBed.createComponent(GuidePageComponent);
    component = fixture.componentInstance;
    guideData = TestBed.inject(GuideDataService);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── Layout Structure ────────────────────────────────────────

  describe('layout structure', () => {
    it('should render guide-layout container', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.guide-layout')).toBeTruthy();
    });

    it('should render left sidebar (guide-navigation)', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const nav = compiled.querySelector('app-guide-navigation');
      expect(nav).toBeTruthy();
    });

    it('should render main content area (guide-content)', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const content = compiled.querySelector('app-guide-content');
      expect(content).toBeTruthy();
    });

    it('should render right sidebar (related-sidebar)', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const sidebar = compiled.querySelector('app-related-sidebar');
      expect(sidebar).toBeTruthy();
    });
  });

  // ── Mobile Sidebar ──────────────────────────────────────────

  describe('mobile sidebar', () => {
    it('should start with mobile sidebar closed', () => {
      expect(component.mobileSidebarOpen()).toBeFalse();
    });

    it('should toggle mobile sidebar', () => {
      component.toggleMobileSidebar();
      expect(component.mobileSidebarOpen()).toBeTrue();
    });

    it('should close when toggled again', () => {
      component.toggleMobileSidebar();
      component.toggleMobileSidebar();
      expect(component.mobileSidebarOpen()).toBeFalse();
    });

    it('should show overlay when sidebar is open', () => {
      component.mobileSidebarOpen.set(true);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const overlay = compiled.querySelector('.sidebar-overlay');
      expect(overlay).toBeTruthy();
    });

    it('should NOT show overlay when sidebar is closed', () => {
      component.mobileSidebarOpen.set(false);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const overlay = compiled.querySelector('.sidebar-overlay');
      expect(overlay).toBeFalsy();
    });

    it('should close sidebar on overlay click', () => {
      component.mobileSidebarOpen.set(true);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const overlay = compiled.querySelector('.sidebar-overlay') as HTMLElement;
      overlay?.click();
      expect(component.mobileSidebarOpen()).toBeFalse();
    });

    it('should have a mobile FAB button', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const fab = compiled.querySelector('.mobile-fab');
      expect(fab).toBeTruthy();
    });
  });

  // ── Nav Collapse ────────────────────────────────────────────

  describe('nav collapse', () => {
    it('should start with nav expanded', () => {
      expect(component.navCollapsed()).toBeFalse();
    });

    it('should handle collapse toggle from navigation', () => {
      component.onNavCollapseToggled(true);
      expect(component.navCollapsed()).toBeTrue();
    });

    it('should toggle back to expanded', () => {
      component.onNavCollapseToggled(true);
      component.onNavCollapseToggled(false);
      expect(component.navCollapsed()).toBeFalse();
    });

    it('should show expand button when collapsed', () => {
      component.navCollapsed.set(true);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const expandBtn = compiled.querySelector('.collapsed-toggle');
      expect(expandBtn).toBeTruthy();
    });

    it('should NOT show expand button when expanded', () => {
      component.navCollapsed.set(false);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const expandBtn = compiled.querySelector('.collapsed-toggle');
      expect(expandBtn).toBeFalsy();
    });

    it('should add nav-collapsed class when collapsed', () => {
      component.navCollapsed.set(true);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const sidebar = compiled.querySelector('.sidebar-wrapper');
      expect(sidebar?.classList.contains('nav-collapsed')).toBeTrue();
    });
  });

  // ── Cleanup ─────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('should clean up subscription on destroy', () => {
      const sub = (component as any).routeSub;
      if (sub) {
        spyOn(sub, 'unsubscribe');
        component.ngOnDestroy();
        expect(sub.unsubscribe).toHaveBeenCalled();
      }
    });
  });
});
