import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RelatedSidebarComponent } from './related-sidebar.component';
import { GuideDataService } from '../../services/guide-data.service';

describe('RelatedSidebarComponent', () => {
  let component: RelatedSidebarComponent;
  let fixture: ComponentFixture<RelatedSidebarComponent>;
  let guideData: GuideDataService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RelatedSidebarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RelatedSidebarComponent);
    component = fixture.componentInstance;
    guideData = TestBed.inject(GuideDataService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── Structure ───────────────────────────────────────────────

  describe('sidebar structure', () => {
    it('should render aside element', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('aside')).toBeTruthy();
    });

    it('should render Related Bulletins header', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Related Bulletins');
    });

    it('should render Related FAQs header', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Related FAQs');
    });

    it('should render Forms header', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Forms');
    });

    it('should render Help box', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Need Help?');
      expect(compiled.textContent).toContain('Contact Support');
    });
  });

  // ── Sections Toggle ─────────────────────────────────────────

  describe('sections toggle', () => {
    it('should have bulletins section open by default', () => {
      expect(component.isSectionOpen('bulletins')).toBeTrue();
    });

    it('should have faqs section open by default', () => {
      expect(component.isSectionOpen('faqs')).toBeTrue();
    });

    it('should have forms section open by default', () => {
      expect(component.isSectionOpen('forms')).toBeTrue();
    });

    it('should close a section when toggled', () => {
      component.toggleSection('bulletins');
      expect(component.isSectionOpen('bulletins')).toBeFalse();
    });

    it('should reopen a closed section', () => {
      component.toggleSection('bulletins');
      expect(component.isSectionOpen('bulletins')).toBeFalse();
      component.toggleSection('bulletins');
      expect(component.isSectionOpen('bulletins')).toBeTrue();
    });

    it('should toggle sections independently', () => {
      component.toggleSection('bulletins');
      expect(component.isSectionOpen('bulletins')).toBeFalse();
      expect(component.isSectionOpen('faqs')).toBeTrue();
      expect(component.isSectionOpen('forms')).toBeTrue();
    });
  });

  // ── Bulletins ───────────────────────────────────────────────

  describe('bulletins', () => {
    it('should display bulletin items', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const resources = guideData.relatedResources();
      if (resources.bulletins.length > 0) {
        expect(compiled.textContent).toContain(resources.bulletins[0].title);
      }
    });

    it('should hide bulletins when section is collapsed', () => {
      const firstBulletinTitle = guideData.relatedResources().bulletins[0]?.title;
      component.toggleSection('bulletins');
      fixture.detectChanges();
      if (firstBulletinTitle) {
        const compiled = fixture.nativeElement as HTMLElement;
        // Bulletins section is collapsed, individual bulletin links should not be visible
        const links = compiled.querySelectorAll('a[href]');
        const bulletinLink = Array.from(links).find(
          l => l.textContent?.includes(firstBulletinTitle)
        );
        expect(bulletinLink).toBeFalsy();
      }
    });
  });

  // ── FAQs (Accordion) ───────────────────────────────────────

  describe('FAQs accordion', () => {
    it('should display FAQ questions', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const faqs = guideData.relatedResources().faqs;
      if (faqs.length > 0) {
        expect(compiled.textContent).toContain(faqs[0].question);
      }
    });

    it('should start with all FAQs collapsed', () => {
      const faqs = guideData.relatedResources().faqs;
      faqs.forEach(faq => {
        expect(component.isFaqOpen(faq.id)).toBeFalse();
      });
    });

    it('should expand FAQ answer when toggled', () => {
      const faqs = guideData.relatedResources().faqs;
      if (faqs.length > 0) {
        component.toggleFaq(faqs[0].id);
        expect(component.isFaqOpen(faqs[0].id)).toBeTrue();
        fixture.detectChanges();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.textContent).toContain(faqs[0].answer);
      }
    });

    it('should collapse an expanded FAQ', () => {
      const faqs = guideData.relatedResources().faqs;
      if (faqs.length > 0) {
        component.toggleFaq(faqs[0].id);
        expect(component.isFaqOpen(faqs[0].id)).toBeTrue();
        component.toggleFaq(faqs[0].id);
        expect(component.isFaqOpen(faqs[0].id)).toBeFalse();
      }
    });

    it('should toggle FAQs independently', () => {
      const faqs = guideData.relatedResources().faqs;
      if (faqs.length >= 2) {
        component.toggleFaq(faqs[0].id);
        expect(component.isFaqOpen(faqs[0].id)).toBeTrue();
        expect(component.isFaqOpen(faqs[1].id)).toBeFalse();
      }
    });
  });

  // ── Forms ───────────────────────────────────────────────────

  describe('forms', () => {
    it('should display form items', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const forms = guideData.relatedResources().forms;
      if (forms.length > 0) {
        expect(compiled.textContent).toContain(forms[0].title);
      }
    });

    it('should display form numbers', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const forms = guideData.relatedResources().forms;
      if (forms.length > 0) {
        expect(compiled.textContent).toContain(forms[0].formNumber);
      }
    });
  });
});
